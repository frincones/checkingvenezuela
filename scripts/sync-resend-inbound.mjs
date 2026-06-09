#!/usr/bin/env node
/**
 * Sync inbound emails from Resend → Supabase `emails` table.
 *
 * Use cases:
 *  - One-off backfill of emails that Resend received but our webhook never
 *    processed (e.g. the 307 apex→www redirect bug that ran from 2026-05-12
 *    to today, swallowing every inbound webhook delivery).
 *  - Safety net to run periodically if we ever suspect another gap.
 *
 * What it does:
 *  1. Loads the set of resend_id values we already have in DB (direction=inbound).
 *  2. Paginates GET https://api.resend.com/emails/receiving?after={cursor}
 *     in pages of 100 (most recent first).
 *  3. For each email NOT in DB:
 *       a. GET /emails/receiving/{id}     → full body (html/text/in_reply_to)
 *       b. GET /emails/receiving/{id}/attachments → fresh signed URLs
 *       c. For each attachment: fetch (no Authorization header — these are
 *          signed S3 URLs) → uploadInboundAttachment → bucket.
 *       d. INSERT row into `emails` with the same shape the webhook would build.
 *  4. Pagination stops when:
 *       - has_more=false from Resend
 *       - OR we hit an email whose resend_id is already in DB AND we've already
 *         processed at least one new one (the listing is sorted by date desc,
 *         so anything below a known id is also known).
 *
 * Idempotent — re-running is safe:
 *  - The UNIQUE INDEX on emails.resend_id prevents duplicate rows.
 *  - Storage upload uses upsert=true (same path overwrites).
 *
 * Flags:
 *   --dry-run    show what would be inserted without writing
 *   --max=N      hard cap on emails to process (default 500)
 *   --since=YYYY-MM-DD   only consider emails created on/after this date
 *                        (date filter is applied CLIENT-SIDE — the Resend
 *                        list endpoint doesn't accept a date param, so we
 *                        paginate down and stop when we cross the boundary)
 *
 * Run:
 *   node --env-file=.env scripts/sync-resend-inbound.mjs --dry-run
 *   node --env-file=.env scripts/sync-resend-inbound.mjs
 *   node --env-file=.env scripts/sync-resend-inbound.mjs --since=2026-05-11
 *
 * NOTE: This script writes to PRODUCTION (env vars point to prod). Always
 * run --dry-run first to see what it'll do.
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

for (const [k, v] of Object.entries({ SUPABASE_URL, SERVICE_KEY, RESEND_API_KEY })) {
  if (!v) {
    console.error(`Missing env var: ${k}`);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const MAX = (() => {
  const a = args.find((x) => x.startsWith("--max="));
  return a ? parseInt(a.split("=")[1], 10) : 500;
})();
const SINCE = (() => {
  const a = args.find((x) => x.startsWith("--since="));
  return a ? new Date(a.split("=")[1] + "T00:00:00Z") : null;
})();

const BUCKET = "email-attachments";
const PAGE_LIMIT = 100;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ----------------- helpers (mirror of app/api/webhook/email/route.js) -----------------

function sanitizeFilename(name) {
  if (!name) return "attachment";
  const base = String(name).replace(/[\\/]+/g, "_").replace(/[^\w.\- ]+/g, "_");
  return base.slice(0, 120) || "attachment";
}

function buildStoragePath({ emailRowId, index, filename, createdAt }) {
  const d = createdAt ? new Date(createdAt) : new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `inbound/${y}/${m}/${emailRowId}/${index}-${sanitizeFilename(filename)}`;
}

async function loadKnownResendIds() {
  // Cap at 5,000 — way more than we'd ever realistically have for inbound;
  // safety against the rare case of a runaway sync.
  const { data, error } = await sb
    .from("emails")
    .select("resend_id")
    .eq("direction", "inbound")
    .not("resend_id", "is", null)
    .limit(5000);
  if (error) throw error;
  return new Set((data || []).map((r) => r.resend_id));
}

async function resendList(after) {
  const url = new URL("https://api.resend.com/emails/receiving");
  url.searchParams.set("limit", String(PAGE_LIMIT));
  if (after) url.searchParams.set("after", after);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Resend list failed: HTTP ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function resendGetEmail(emailId) {
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function resendGetAttachments(emailId) {
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${emailId}/attachments`,
    { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

async function persistOneAttachment({ att, emailRowId, index, createdAt }) {
  const meta = {
    filename: att.filename || `attachment-${index}`,
    size: att.size ?? null,
    content_type: att.content_type || null,
  };

  if (!att.download_url) {
    return { ...meta, storage_path: null, ingest_error: "missing_download_url" };
  }

  try {
    // Signed S3 URL — do NOT send Authorization header; Resend re-signs each
    // call to /attachments, so we always get a fresh URL here.
    const dl = await fetch(att.download_url);
    if (!dl.ok) {
      return {
        ...meta,
        storage_path: null,
        ingest_error: `resend_download_${dl.status}`,
      };
    }
    const buf = Buffer.from(await dl.arrayBuffer());
    const storage_path = buildStoragePath({
      emailRowId,
      index,
      filename: meta.filename,
      createdAt,
    });
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(storage_path, buf, {
        contentType: meta.content_type || "application/octet-stream",
        upsert: true,
      });
    if (upErr) {
      return { ...meta, storage_path: null, ingest_error: `upload_${upErr.message}` };
    }
    return { ...meta, size: buf.byteLength, storage_path };
  } catch (err) {
    return {
      ...meta,
      storage_path: null,
      ingest_error: String(err?.message || err).slice(0, 240),
    };
  }
}

async function resolveMailboxId(toEmails) {
  const addrs = (toEmails || [])
    .map((e) => (typeof e === "string" ? e : e?.email))
    .filter(Boolean)
    .map((a) => a.toLowerCase());
  if (!addrs.length) return null;
  const { data } = await sb
    .from("mailboxes")
    .select("id")
    .in("address", addrs)
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

async function resolveThreadId(inReplyTo) {
  if (!inReplyTo) return null;
  const { data } = await sb
    .from("emails")
    .select("id, thread_id")
    .eq("message_id", inReplyTo)
    .maybeSingle();
  return data?.thread_id || data?.id || null;
}

async function syncOne(meta) {
  // `meta` is a row from the list endpoint
  if (DRY_RUN) return { status: "would_insert", id: meta.id };

  const [full, atts] = await Promise.all([
    resendGetEmail(meta.id),
    resendGetAttachments(meta.id),
  ]);

  const emailRowId = randomUUID();
  const createdAt = meta.created_at || full?.created_at;

  const attachmentsMeta = atts.length
    ? (
        await Promise.allSettled(
          atts.map((att, index) =>
            persistOneAttachment({ att, emailRowId, index, createdAt })
          )
        )
      ).map((r, i) =>
        r.status === "fulfilled"
          ? r.value
          : {
              filename: atts[i]?.filename || `attachment-${i}`,
              size: atts[i]?.size ?? null,
              content_type: atts[i]?.content_type || null,
              storage_path: null,
              ingest_error: String(r.reason?.message || r.reason).slice(0, 240),
            }
      )
    : [];

  const toEmails = Array.isArray(meta.to)
    ? meta.to.map((e) => (typeof e === "string" ? { email: e } : e))
    : [{ email: meta.to }];

  const mailboxId = await resolveMailboxId(toEmails);
  const threadId = await resolveThreadId(full?.in_reply_to);

  // Defensive: re-check the resend_id wasn't inserted concurrently. The
  // `known` set passed in from main() handles the same-run case; this guards
  // against another process (e.g. the webhook coming back online).
  // We use a plain INSERT instead of upsert(onConflict) because the
  // UNIQUE INDEX on emails.resend_id may not exist yet in some environments
  // (it ships as part of migration 20260506_email_attachments_bucket.sql,
  // which has been applied partially in some envs).
  const { data: existing } = await sb
    .from("emails")
    .select("id")
    .eq("resend_id", meta.id)
    .maybeSingle();
  if (existing) {
    return { status: "ok", id: meta.id, attachments_uploaded: 0, attachments_failed: 0, deduped: true };
  }

  const { error } = await sb.from("emails").insert({
    id: emailRowId,
    resend_id: meta.id,
    direction: "inbound",
    folder: "inbox",
    from_email: meta.from || full?.from,
    from_name: null,
    to_emails: toEmails,
    cc: full?.cc || meta.cc || [],
    subject: meta.subject || full?.subject,
    body_html: full?.html || null,
    body_text: full?.text || null,
    attachments: attachmentsMeta,
    status: "delivered",
    is_read: false,
    thread_id: threadId,
    in_reply_to: full?.in_reply_to || null,
    message_id: full?.message_id || meta.message_id || null,
    mailbox_id: mailboxId,
    created_at: createdAt || null,
  });

  if (error) {
    return { status: "insert_error", id: meta.id, message: error.message };
  }
  return {
    status: "ok",
    id: meta.id,
    attachments_uploaded: attachmentsMeta.filter((a) => a.storage_path).length,
    attachments_failed: attachmentsMeta.filter((a) => !a.storage_path).length,
  };
}

// ----------------- main -----------------

async function main() {
  const banner = DRY_RUN ? "[DRY-RUN]" : "[REAL]";
  console.log(
    `${banner} sync-resend-inbound | MAX=${MAX} | SINCE=${SINCE ? SINCE.toISOString() : "all"}`
  );

  const known = await loadKnownResendIds();
  console.log(`Already in DB: ${known.size} inbound emails.\n`);

  let after = undefined;
  let processed = 0;
  let inserted = 0;
  let skippedKnown = 0;
  let skippedSince = 0;
  let attachmentsUploaded = 0;
  let attachmentsFailed = 0;
  const failures = [];

  while (processed < MAX) {
    const page = await resendList(after);
    const items = page.data || [];
    if (!items.length) break;

    for (const item of items) {
      if (processed >= MAX) break;

      // SINCE filter (client-side; listing is desc by date — once we cross,
      // safe to stop pagination too).
      if (SINCE && new Date(item.created_at) < SINCE) {
        skippedSince++;
        console.log(`  ⏹  Reached SINCE boundary at ${item.created_at}`);
        return finalize();
      }

      if (known.has(item.id)) {
        skippedKnown++;
        continue;
      }

      processed++;
      const ts = item.created_at;
      const fromTo = `${item.from || "?"} → ${
        (Array.isArray(item.to) ? item.to[0] : item.to) || "?"
      }`;
      const subj = (item.subject || "").slice(0, 60);

      const res = await syncOne(item);

      if (res.status === "ok") {
        inserted++;
        attachmentsUploaded += res.attachments_uploaded;
        attachmentsFailed += res.attachments_failed;
        console.log(
          `  ✅ ${ts}  ${fromTo}  | ${subj}  | atts: ok=${res.attachments_uploaded} fail=${res.attachments_failed}`
        );
        known.add(item.id);
      } else if (res.status === "would_insert") {
        inserted++;
        console.log(`  📝 [dry] ${ts}  ${fromTo}  | ${subj}`);
      } else {
        failures.push({ id: item.id, reason: res.message });
        console.log(`  ❌ ${ts}  ${fromTo}  | ${subj}  | ${res.message}`);
      }

      // gentle pacing to avoid hitting Resend rate limits
      await new Promise((r) => setTimeout(r, 150));
    }

    if (!page.has_more) break;
    after = items[items.length - 1].id;
  }

  finalize();

  function finalize() {
    console.log(`\n========== SUMMARY ==========`);
    console.log(`Mode:                  ${DRY_RUN ? "DRY-RUN" : "REAL"}`);
    console.log(`Processed (new):       ${processed}`);
    console.log(`Inserted${DRY_RUN ? " (would)" : ""}:  ${inserted}`);
    console.log(`Skipped (already-in-DB): ${skippedKnown}`);
    if (SINCE) console.log(`Skipped (before SINCE): ${skippedSince}`);
    if (!DRY_RUN) {
      console.log(`Attachments uploaded:  ${attachmentsUploaded}`);
      console.log(`Attachments failed:    ${attachmentsFailed}`);
    }
    if (failures.length) {
      console.log(`\nFailures (${failures.length}):`);
      failures.forEach((f) => console.log(`  ${f.id}: ${f.reason}`));
    }
    console.log(`=============================`);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
