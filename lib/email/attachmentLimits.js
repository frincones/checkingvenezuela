/**
 * Attachment size validation for email providers.
 *
 * Resend limit: 40 MB total per email (attachments included).
 * Mailjet limit: 15 MB total per email.
 *
 * Base64 encoding adds ~33% overhead, so the effective binary limit
 * before encoding is lower than the raw API cap.
 */

// Raw API limits (bytes)
export const RESEND_MAX_BYTES = 40 * 1024 * 1024; // 40 MB
export const MAILJET_MAX_BYTES = 15 * 1024 * 1024; // 15 MB

// Safe binary limit accounting for Base64 overhead (×1.33)
export const RESEND_SAFE_BINARY_LIMIT = 30 * 1024 * 1024; // ~30 MB → ~40 MB after b64
export const MAILJET_SAFE_BINARY_LIMIT = 11 * 1024 * 1024; // ~11 MB → ~15 MB after b64

/**
 * Validate attachment sizes before sending.
 *
 * @param {Array} attachments – array of objects with a `.size` (bytes) or
 *   `.content` (string/Buffer whose `.length` is checked).
 * @param {"resend"|"mailjet"} provider
 * @returns {{ ok: boolean, error?: string, totalBytes: number, limitBytes: number }}
 */
export function validateAttachmentSize(attachments = [], provider = "resend") {
  const limit =
    provider === "mailjet" ? MAILJET_SAFE_BINARY_LIMIT : RESEND_SAFE_BINARY_LIMIT;

  let totalBytes = 0;

  for (const att of attachments) {
    // Support multiple shapes: { size }, { content: Buffer|string }, raw Buffer
    const bytes =
      att.size ??
      (att.content ? (Buffer.isBuffer(att.content) ? att.content.length : att.content.length) : 0) ??
      (att.Base64Content ? Math.ceil((att.Base64Content.length * 3) / 4) : 0);

    totalBytes += bytes;
  }

  if (totalBytes > limit) {
    const limitMB = (limit / (1024 * 1024)).toFixed(0);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      error: `Los adjuntos (${totalMB} MB) exceden el límite de ${limitMB} MB. Reduce el tamaño de los archivos o envía menos adjuntos.`,
      totalBytes,
      limitBytes: limit,
    };
  }

  return { ok: true, totalBytes, limitBytes: limit };
}

/**
 * Format bytes to a human-readable string.
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
