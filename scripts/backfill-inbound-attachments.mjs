#!/usr/bin/env node
/**
 * Backfill: descarga adjuntos LEGACY (con url:cdn.resend.app) desde la API
 * de Resend, los sube al bucket privado `email-attachments` y actualiza el
 * JSONB de la tabla `emails` para que el shape coincida con el de los
 * correos nuevos (storage_path en vez de url).
 *
 * Es idempotente:
 *   - Skip si att.storage_path ya existe.
 *   - Si Resend devuelve 404 (TTL purgado), marca el adjunto con
 *     ingest_error="expired_at_resend" y NO vuelve a intentar.
 *   - Re-ejecutar el script no reprocesa filas ya completadas.
 *
 * Uso:
 *   node --env-file=.env scripts/backfill-inbound-attachments.mjs [--dry-run] [--limit=50]
 *
 * Variables requeridas del .env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
 *
 * NOTA: este script toca PRODUCCIÓN (las env vars apuntan a la DB prod).
 * Recomendado correrlo primero con --dry-run para ver el reporte.
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
const LIMIT_ARG = args.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1], 10) : 200;

const BUCKET = "email-attachments";
const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sanitizeFilename(name) {
  if (!name) return "attachment";
  const base = String(name).replace(/[\\/]+/g, "_").replace(/[^\w.\- ]+/g, "_");
  return base.slice(0, 120) || "attachment";
}

function buildPath({ emailRowId, index, filename, createdAt }) {
  const d = createdAt ? new Date(createdAt) : new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const safe = sanitizeFilename(filename);
  return `inbound/${y}/${m}/${emailRowId}/${index}-${safe}`;
}

function isLegacy(att) {
  // Legacy = tiene url Resend pero no tiene storage_path ni se intentó.
  if (!att || typeof att !== "object") return false;
  if (att.storage_path) return false;
  if (att.ingest_error === "expired_at_resend") return false;
  const url = att.url || "";
  return /cdn\.resend\.app|api\.resend\.com/.test(url);
}

async function fetchEmailsWithLegacyAttachments() {
  // Pull liberal: 500 emails inbound; filtramos en cliente porque PostgREST
  // no expresa fácil "alguno de los items del JSONB tiene url" sin RPC.
  const { data, error } = await sb
    .from("emails")
    .select("id, created_at, attachments, resend_id")
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const candidates = (data || []).filter((e) =>
    Array.isArray(e.attachments) && e.attachments.some(isLegacy)
  );
  return candidates;
}

/**
 * Pide a la API de Resend la lista FRESCA de adjuntos del email.
 * Las URLs `cdn.resend.app` son signed con TTL corto — la URL vieja guardada
 * en la DB ya expiró. La API renueva la firma cada vez que se llama.
 *
 * Devuelve null si la API ya no conoce el email (genuinamente purgado).
 */
async function fetchFreshAttachments(resendEmailId) {
  if (!resendEmailId) return null;
  const r = await fetch(
    `https://api.resend.com/emails/receiving/${resendEmailId}/attachments`,
    { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } }
  );
  if (r.status === 404 || r.status === 410) return null;
  if (!r.ok) {
    throw new Error(`Resend API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  const json = await r.json();
  return Array.isArray(json.data) ? json.data : [];
}

async function processOneAttachment({ emailRowId, createdAt, att, index, freshUrl }) {
  if (!isLegacy(att)) {
    return { status: "skip", reason: "already_processed" };
  }

  if (DRY_RUN) {
    return { status: "would_process", filename: att.filename };
  }

  if (!freshUrl) {
    // No vino en la respuesta fresca de Resend (purgado).
    return { status: "expired", resendStatus: 404 };
  }

  // 1. Descargar usando la signed URL fresca. La firma viaja en el query
  //    string — NO mandamos Authorization Bearer porque algunos backends S3
  //    rechazan la combinación signed+Bearer.
  let resendStatus = 0;
  let buf;
  try {
    const r = await fetch(freshUrl);
    resendStatus = r.status;
    if (r.status === 404 || r.status === 410) {
      return { status: "expired", resendStatus };
    }
    if (!r.ok) {
      return { status: "fetch_error", resendStatus, body: (await r.text()).slice(0, 200) };
    }
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    return { status: "fetch_exception", message: e.message };
  }

  // 2. Subir al bucket
  const storage_path = buildPath({
    emailRowId,
    index,
    filename: att.filename,
    createdAt,
  });
  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(storage_path, buf, {
      contentType: att.content_type || "application/octet-stream",
      upsert: true,
    });
  if (upErr) {
    return { status: "upload_error", message: upErr.message };
  }

  return { status: "ok", storage_path, bytes: buf.byteLength };
}

/** Match fresh Resend attachments to DB attachments by filename+size, falling
 *  back to position when there are duplicates. Returns array aligned with
 *  the DB order, each entry either the fresh API record or null. */
function matchFreshToDb(dbAtts, freshAtts) {
  if (!Array.isArray(freshAtts)) return dbAtts.map(() => null);
  // Index fresh by (filename|size). Allow multiple per filename via array.
  const byKey = new Map();
  for (const f of freshAtts) {
    const k = `${f.filename || ""}|${f.size ?? ""}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(f);
  }
  return dbAtts.map((db, i) => {
    if (!isLegacy(db)) return null;
    const k = `${db.filename || ""}|${db.size ?? ""}`;
    const bucket = byKey.get(k);
    if (bucket && bucket.length) return bucket.shift();
    // Last resort: same index if it still exists
    return freshAtts[i] || null;
  });
}

async function updateEmailRow(emailRowId, newAttachments) {
  if (DRY_RUN) return;
  const { error } = await sb
    .from("emails")
    .update({ attachments: newAttachments, updated_at: new Date().toISOString() })
    .eq("id", emailRowId);
  if (error) throw error;
}

async function main() {
  const banner = DRY_RUN ? "[DRY-RUN]" : "[REAL]";
  console.log(`${banner} Backfill iniciado | LIMIT=${LIMIT} | bucket=${BUCKET}`);

  const emails = await fetchEmailsWithLegacyAttachments();
  console.log(`Encontrados ${emails.length} correos con adjuntos legacy.`);

  const totals = {
    emails_processed: 0,
    attachments_uploaded: 0,
    attachments_expired: 0,
    attachments_failed: 0,
    attachments_skipped_already: 0,
    bytes_uploaded: 0,
  };

  const processedEmails = emails.slice(0, LIMIT);
  for (const e of processedEmails) {
    console.log(`\nemail=${e.id}  created=${e.created_at}  resend_id=${e.resend_id}`);
    const newAtts = [];
    let dirty = false;

    // Pedir URLs frescas a Resend (las viejas guardadas en la DB ya expiraron)
    let freshList = null;
    if (!DRY_RUN && e.resend_id) {
      try {
        freshList = await fetchFreshAttachments(e.resend_id);
        if (freshList === null) {
          console.log("   ⚠️  Resend devolvió 404/410 para el email completo — todos los adjuntos quedan expirados.");
        }
      } catch (err) {
        console.log(`   ⚠️  Error pidiendo URLs frescas: ${err.message}`);
      }
    }
    const matched = matchFreshToDb(e.attachments, freshList || []);

    for (let i = 0; i < e.attachments.length; i++) {
      const att = e.attachments[i];

      if (!isLegacy(att)) {
        // Conservar tal cual (ya tiene storage_path o ya expiró)
        newAtts.push(att);
        if (att.storage_path) totals.attachments_skipped_already++;
        continue;
      }

      const fresh = matched[i];
      const freshUrl = fresh?.download_url;

      const res = await processOneAttachment({
        emailRowId: e.id,
        createdAt: e.created_at,
        att,
        index: i,
        freshUrl,
      });

      const tag = `   [${i}] ${(att.filename || "?").slice(0, 60)} → ${res.status}`;
      console.log(tag + (res.resendStatus ? ` (resend=${res.resendStatus})` : ""));

      if (res.status === "ok") {
        newAtts.push({
          filename: att.filename,
          size: res.bytes ?? att.size,
          content_type: att.content_type,
          storage_path: res.storage_path,
        });
        dirty = true;
        totals.attachments_uploaded++;
        totals.bytes_uploaded += res.bytes || 0;
      } else if (res.status === "expired") {
        newAtts.push({
          filename: att.filename,
          size: att.size,
          content_type: att.content_type,
          storage_path: null,
          ingest_error: "expired_at_resend",
        });
        dirty = true;
        totals.attachments_expired++;
      } else if (res.status === "would_process") {
        // dry-run
        newAtts.push(att);
      } else {
        // fetch_error / fetch_exception / upload_error → conservar legacy
        // (sin marcar expired) para que un próximo run pueda reintentar.
        newAtts.push(att);
        totals.attachments_failed++;
        console.log(`       reason: ${res.message || res.body || res.status}`);
      }
    }

    if (dirty) {
      await updateEmailRow(e.id, newAtts);
      totals.emails_processed++;
    }
  }

  console.log(`\n========== RESUMEN ==========`);
  console.log(`Modo:                 ${DRY_RUN ? "DRY-RUN (sin cambios)" : "REAL"}`);
  console.log(`Emails procesados:    ${totals.emails_processed}`);
  console.log(`Adjuntos subidos:     ${totals.attachments_uploaded}`);
  console.log(`Adjuntos expirados:   ${totals.attachments_expired}  (Resend devolvió 404/410 — TTL pasó)`);
  console.log(`Adjuntos saltados:    ${totals.attachments_skipped_already}  (ya tenían storage_path)`);
  console.log(`Adjuntos fallidos:    ${totals.attachments_failed}  (reintentables en próxima corrida)`);
  console.log(`Bytes subidos:        ${(totals.bytes_uploaded / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((e) => {
  console.error("Backfill fatal:", e);
  process.exit(1);
});
