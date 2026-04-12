"use server";

/**
 * Server Actions for vouchers CRUD.
 *
 * All actions:
 *  - Require an authenticated user (via createClient / auth.getUser).
 *  - Write through the admin client to bypass RLS uniformly.
 *  - Return { success, data?, error? } objects — never throw across the
 *    action boundary.
 *  - Call revalidatePath on the dashboard routes they affect.
 */

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import {
  voucherCreateSchema,
  voucherUpdateSchema,
  voucherCancelSchema,
} from "@/lib/vouchers/schema";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

function normalizeError(err, fallback = "Error desconocido") {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  return err.message || err.details || fallback;
}

/**
 * Normalize payload: drop empty strings on optional fields, coerce nulls.
 */
function cleanPayload(input) {
  const out = { ...input };
  const nullableStrings = [
    "subtitle",
    "locator_code",
    "observations",
    "emergency_contact",
    "important_notes",
    "validity_notes",
  ];
  for (const key of nullableStrings) {
    if (out[key] === "") out[key] = null;
  }
  // Strip empty string uuid relations
  for (const key of ["lead_id", "quotation_id", "advisor_id", "provider_id"]) {
    if (out[key] === "" || out[key] === undefined) out[key] = null;
  }
  return out;
}

// ── CREATE ──

export async function createVoucherAction(input) {
  const user = await requireUser();
  if (!user) return { success: false, error: "No autorizado" };

  const parsed = voucherCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Datos inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const payload = cleanPayload(parsed.data);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("vouchers")
    .insert({
      ...payload,
      created_by: user.id,
    })
    .select("id, voucher_number")
    .single();

  if (error) {
    return { success: false, error: normalizeError(error, "No se pudo crear el voucher") };
  }

  revalidatePath("/dashboard/vouchers");
  return { success: true, data };
}

// ── UPDATE ──

export async function updateVoucherAction(id, input) {
  const user = await requireUser();
  if (!user) return { success: false, error: "No autorizado" };
  if (!id) return { success: false, error: "ID requerido" };

  const parsed = voucherUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Datos inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const admin = createAdminClient();

  // Prevent editing cancelled vouchers
  const { data: existing, error: fetchErr } = await admin
    .from("vouchers")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { success: false, error: normalizeError(fetchErr) };
  if (!existing) return { success: false, error: "Voucher no encontrado" };
  if (existing.status === "cancelled") {
    return { success: false, error: "No se puede editar un voucher cancelado" };
  }

  const payload = cleanPayload(parsed.data);

  const { data, error } = await admin
    .from("vouchers")
    .update(payload)
    .eq("id", id)
    .select("id, voucher_number, status, pdf_stale")
    .single();

  if (error) {
    return { success: false, error: normalizeError(error, "No se pudo actualizar el voucher") };
  }

  revalidatePath("/dashboard/vouchers");
  revalidatePath(`/dashboard/vouchers/${id}`);
  return { success: true, data };
}

// ── DELETE (only drafts) ──

export async function deleteVoucherAction(id) {
  const user = await requireUser();
  if (!user) return { success: false, error: "No autorizado" };
  if (!id) return { success: false, error: "ID requerido" };

  const admin = createAdminClient();

  const { data: existing, error: fetchErr } = await admin
    .from("vouchers")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { success: false, error: normalizeError(fetchErr) };
  if (!existing) return { success: false, error: "Voucher no encontrado" };

  if (existing.status !== "draft") {
    return {
      success: false,
      error: "Solo se pueden eliminar vouchers en estado borrador. Usa 'Cancelar' en su lugar.",
    };
  }

  const { error } = await admin.from("vouchers").delete().eq("id", id);
  if (error) return { success: false, error: normalizeError(error) };

  revalidatePath("/dashboard/vouchers");
  return { success: true };
}

// ── CANCEL ──

export async function cancelVoucherAction(id, input) {
  const user = await requireUser();
  if (!user) return { success: false, error: "No autorizado" };
  if (!id) return { success: false, error: "ID requerido" };

  const parsed = voucherCancelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Razón requerida",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("vouchers")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: parsed.data.reason,
    })
    .eq("id", id);

  if (error) return { success: false, error: normalizeError(error) };

  revalidatePath("/dashboard/vouchers");
  revalidatePath(`/dashboard/vouchers/${id}`);
  return { success: true };
}

// ── REACTIVATE (cancelled -> issued) ──

export async function reactivateVoucherAction(id) {
  const user = await requireUser();
  if (!user) return { success: false, error: "No autorizado" };
  if (!id) return { success: false, error: "ID requerido" };

  const admin = createAdminClient();
  const { data: existing, error: fetchErr } = await admin
    .from("vouchers")
    .select("id, status, pdf_url")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { success: false, error: normalizeError(fetchErr) };
  if (!existing) return { success: false, error: "Voucher no encontrado" };
  if (existing.status !== "cancelled") {
    return { success: false, error: "Solo se pueden reactivar vouchers cancelados" };
  }

  // Reactivate as draft if no PDF ever existed, otherwise as issued with stale pdf
  const nextStatus = existing.pdf_url ? "issued" : "draft";
  const { error } = await admin
    .from("vouchers")
    .update({
      status: nextStatus,
      cancelled_at: null,
      cancellation_reason: null,
      pdf_stale: true,
    })
    .eq("id", id);

  if (error) return { success: false, error: normalizeError(error) };

  revalidatePath("/dashboard/vouchers");
  revalidatePath(`/dashboard/vouchers/${id}`);
  return { success: true };
}
