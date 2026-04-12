/**
 * Storage helpers for voucher PDFs.
 *
 * Storage layout (reusing the existing 'documents' bucket from
 * supabase/migrations/002_crm_quotations_update.sql):
 *
 *   documents/
 *     vouchers/
 *       {YYYY}/
 *         {MM}/
 *           {voucherNumber}.pdf
 *
 * The bucket is public-read, so we always use getPublicUrl. This matches
 * the quotation PDF flow.
 */

import { createAdminClient } from "@/lib/db/supabase/server";

const BUCKET = "documents";

function buildPath(voucherNumber, date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const safe = String(voucherNumber || "voucher").replace(/[^A-Za-z0-9_-]+/g, "_");
  return `vouchers/${y}/${m}/${safe}.pdf`;
}

/**
 * Upload a voucher PDF buffer and return its public URL.
 * Uses upsert:true so regenerations overwrite the previous file in place.
 */
export async function uploadVoucherPDF(voucherNumber, pdfBytes) {
  const admin = createAdminClient();
  const path = buildPath(voucherNumber);

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (upErr) {
    throw new Error(`No se pudo subir el PDF del voucher: ${upErr.message}`);
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return { path, publicUrl: data?.publicUrl || null };
}

/**
 * Download an existing voucher PDF as Buffer. Returns null if it does not
 * exist in the bucket.
 */
export async function downloadVoucherPDF(path) {
  if (!path) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Extract the storage path from a public URL previously returned by
 * uploadVoucherPDF. Used when regenerating / deleting a cached PDF.
 */
export function pathFromPublicUrl(publicUrl) {
  if (!publicUrl) return null;
  const marker = `/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}
