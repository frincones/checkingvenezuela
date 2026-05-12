/**
 * Storage helpers for inbound email attachments.
 *
 * Layout (private bucket — see supabase/migrations/20260506_email_attachments_bucket.sql):
 *
 *   email-attachments/
 *     inbound/
 *       {YYYY}/
 *         {MM}/
 *           {emailRowId}/
 *             {index}-{safeFilename}
 *
 * The bucket is PRIVATE. Reads happen ONLY via `createSignedUrl` issued by
 * server-side handlers AFTER they verify the user session. Never use
 * `getPublicUrl` here — it would return a 400 since the bucket is not public.
 *
 * This mirrors the pattern of `lib/vouchers/storage.js` but adapted to a
 * private bucket. Outbound attachments (composer-uploaded) are NOT in scope
 * for this fix — they remain as in-memory buffers passed directly to Resend.
 */

import { createAdminClient } from "@/lib/db/supabase/server";

const BUCKET = "email-attachments";
const DEFAULT_TTL_SECONDS = 60;

/** Sanitize a filename so it's safe to use in a storage path. */
function sanitizeFilename(name) {
  if (!name) return "attachment";
  // Strip directory traversal + unsafe chars; cap to 120 chars to leave room.
  const base = String(name).replace(/[\\/]+/g, "_").replace(/[^\w.\- ]+/g, "_");
  return base.slice(0, 120) || "attachment";
}

/** Build the storage path for an inbound attachment. */
function buildInboundPath({ emailRowId, index, filename, date = new Date() }) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const safe = sanitizeFilename(filename);
  return `inbound/${y}/${m}/${emailRowId}/${index}-${safe}`;
}

/**
 * Upload one inbound attachment to the private bucket. Idempotent
 * (upsert=true), so a webhook retry overwrites the same path safely.
 *
 * @param {object} args
 * @param {string} args.emailRowId  - the UUID of the row in `emails` this
 *                                    attachment belongs to (not the Resend id)
 * @param {number} args.index       - zero-based position within the email's
 *                                    attachments array
 * @param {string} args.filename
 * @param {string} args.contentType - MIME type (best-effort; bucket validates)
 * @param {Buffer|Uint8Array|ArrayBuffer} args.bytes
 * @returns {Promise<{ storage_path: string, size: number }>}
 * @throws if the upload fails
 */
export async function uploadInboundAttachment({
  emailRowId,
  index,
  filename,
  contentType,
  bytes,
}) {
  if (!emailRowId) throw new Error("uploadInboundAttachment: emailRowId required");
  if (bytes == null) throw new Error("uploadInboundAttachment: bytes required");

  const admin = createAdminClient();
  const storage_path = buildInboundPath({ emailRowId, index, filename });

  const body = bytes instanceof Buffer ? bytes : Buffer.from(bytes);

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(storage_path, body, {
      contentType: contentType || "application/octet-stream",
      upsert: true,
    });

  if (error) {
    // Surface the underlying message so the webhook can log + retry.
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return { storage_path, size: body.byteLength };
}

/**
 * Generate a short-lived signed download URL for an attachment.
 *
 * Caller MUST verify the user has access to the email before calling this.
 *
 * @param {string} storage_path - path returned by uploadInboundAttachment
 * @param {number} [ttlSeconds=60] - URL lifetime; 60s is enough for a click
 * @param {string} [downloadAs] - optional filename for Content-Disposition
 * @returns {Promise<string|null>} signed URL, or null if Supabase rejected
 */
export async function getInboundSignedUrl(
  storage_path,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  downloadAs = undefined
) {
  if (!storage_path) return null;
  const admin = createAdminClient();
  const opts = downloadAs ? { download: downloadAs } : undefined;
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storage_path, ttlSeconds, opts);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Exported for tests / scripts; do not use from app code directly. */
export const _internals = { BUCKET, buildInboundPath, sanitizeFilename };
