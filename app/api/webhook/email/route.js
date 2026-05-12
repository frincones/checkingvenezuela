/**
 * Webhook endpoint para Resend events (inbound + tracking)
 * POST /api/webhook/email
 *
 * For `email.received` events, the handler now downloads each attachment from
 * Resend using the API key (the CDN URL is auth-only) and persists the bytes
 * to our private Supabase Storage bucket. The DB row stores `storage_path`
 * instead of the unusable `cdn.resend.app/...` URL.
 *
 * Idempotent under Resend retries: emails.resend_id has a UNIQUE index and we
 * upsert with ignoreDuplicates; attachment uploads use upsert=true.
 */

import { createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { randomUUID } from "crypto";
import { uploadInboundAttachment } from "@/lib/email/attachmentStorage";

// Vercel function: webhook may take longer than the default 10s when emails
// arrive with multiple large attachments (download from Resend + upload to
// Supabase Storage for each). 60s is the Hobby cap.
export const maxDuration = 60;

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function verifyWebhook(request, body) {
  if (!WEBHOOK_SECRET) return true; // skip verification in dev
  const wh = new Webhook(WEBHOOK_SECRET);
  const headers = {
    "svix-id": request.headers.get("svix-id"),
    "svix-timestamp": request.headers.get("svix-timestamp"),
    "svix-signature": request.headers.get("svix-signature"),
  };
  try {
    wh.verify(body, headers);
    return true;
  } catch {
    return false;
  }
}

async function fetchReceivedEmail(emailId) {
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchAttachments(emailId) {
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${emailId}/attachments`,
    { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

/**
 * Download one attachment from Resend (authenticated) and push it to Storage.
 * Returns a metadata object suitable for emails.attachments JSONB.
 *
 * If anything fails, returns a record with storage_path:null and an
 * ingest_error string — the parent email is still saved so we don't lose
 * the message body. The attachment can be retried later via a backfill job.
 */
async function persistOneAttachment({ att, emailRowId, index }) {
  const meta = {
    filename: att.filename || `attachment-${index}`,
    size: att.size ?? null,
    content_type: att.content_type || null,
  };

  if (!att.download_url) {
    return { ...meta, storage_path: null, ingest_error: "missing_download_url" };
  }

  try {
    const dl = await fetch(att.download_url, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
    if (!dl.ok) {
      return {
        ...meta,
        storage_path: null,
        ingest_error: `resend_download_${dl.status}`,
      };
    }
    const buf = Buffer.from(await dl.arrayBuffer());
    const { storage_path, size } = await uploadInboundAttachment({
      emailRowId,
      index,
      filename: meta.filename,
      contentType: meta.content_type,
      bytes: buf,
    });
    // Prefer the actual byte length we measured over Resend's claim
    return { ...meta, size: size ?? meta.size, storage_path };
  } catch (err) {
    console.error(
      "[webhook/email] attachment ingest failed",
      meta.filename,
      err?.message
    );
    return {
      ...meta,
      storage_path: null,
      ingest_error: String(err?.message || err).slice(0, 240),
    };
  }
}

export async function POST(request) {
  try {
    const rawBody = await request.text();

    if (!(await verifyWebhook(request, rawBody))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const { type, data } = event;
    const supabase = createAdminClient();

    switch (type) {
      case "email.received": {
        const emailId = data.email_id || data.id;
        const [fullEmail, attachments] = await Promise.all([
          fetchReceivedEmail(emailId),
          fetchAttachments(emailId),
        ]);

        const toEmails = Array.isArray(data.to)
          ? data.to.map((e) => (typeof e === "string" ? { email: e } : e))
          : [{ email: data.to }];

        // Check if this is a reply to an existing thread
        let threadId = null;
        if (fullEmail?.in_reply_to) {
          const { data: parent } = await supabase
            .from("emails")
            .select("thread_id, id")
            .eq("message_id", fullEmail.in_reply_to)
            .maybeSingle();
          if (parent) {
            threadId = parent.thread_id || parent.id;
          }
        }

        // Resolve mailbox by matching recipient address
        let mailboxId = null;
        const allRecipients = toEmails
          .map((e) => e.email?.toLowerCase())
          .filter(Boolean);
        if (allRecipients.length > 0) {
          const { data: mailbox } = await supabase
            .from("mailboxes")
            .select("id")
            .in("address", allRecipients)
            .limit(1)
            .maybeSingle();
          if (mailbox) mailboxId = mailbox.id;
        }

        // Pre-generate the row id so we can use it as the storage path
        // segment BEFORE the INSERT. This lets us persist attachments to a
        // deterministic location even if the INSERT later hits a UNIQUE
        // conflict (Resend retry) — the duplicate uploads are harmless
        // because upsert:true overwrites the same path.
        const emailRowId = randomUUID();

        // Download + upload each attachment in parallel. allSettled so a
        // single failure doesn't lose the rest of the email.
        const attachmentsMeta = attachments.length
          ? (
              await Promise.allSettled(
                attachments.map((att, index) =>
                  persistOneAttachment({ att, emailRowId, index })
                )
              )
            ).map((r, i) =>
              r.status === "fulfilled"
                ? r.value
                : {
                    filename: attachments[i]?.filename || `attachment-${i}`,
                    size: attachments[i]?.size ?? null,
                    content_type: attachments[i]?.content_type || null,
                    storage_path: null,
                    ingest_error: String(r.reason?.message || r.reason).slice(0, 240),
                  }
            )
          : [];

        // Idempotent insert: if a retry comes in for the same resend_id, the
        // partial UNIQUE index makes upsert(ignoreDuplicates:true) a no-op.
        const { error: insertErr } = await supabase
          .from("emails")
          .upsert(
            {
              id: emailRowId,
              resend_id: emailId,
              direction: "inbound",
              folder: "inbox",
              from_email: data.from || fullEmail?.from,
              from_name: data.from_name || null,
              to_emails: toEmails,
              cc: fullEmail?.cc || [],
              subject: data.subject || fullEmail?.subject,
              body_html: fullEmail?.html || null,
              body_text: fullEmail?.text || null,
              attachments: attachmentsMeta,
              status: "delivered",
              is_read: false,
              thread_id: threadId,
              in_reply_to: fullEmail?.in_reply_to || null,
              message_id: fullEmail?.message_id || null,
              mailbox_id: mailboxId,
            },
            { onConflict: "resend_id", ignoreDuplicates: true }
          );

        if (insertErr) {
          console.error("[webhook/email] insert failed", insertErr.message);
          // Re-raise so Resend retries the webhook
          return NextResponse.json(
            { error: "Insert failed" },
            { status: 500 }
          );
        }
        break;
      }

      case "email.delivered":
      case "email.bounced":
      case "email.opened": {
        const statusMap = {
          "email.delivered": "delivered",
          "email.bounced": "bounced",
          "email.opened": "opened",
        };
        const emailId = data.email_id || data.id;
        if (emailId) {
          await supabase
            .from("emails")
            .update({ status: statusMap[type], updated_at: new Date().toISOString() })
            .eq("resend_id", emailId);
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
