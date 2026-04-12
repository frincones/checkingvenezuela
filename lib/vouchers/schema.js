/**
 * Zod schemas for voucher validation.
 *
 * Used by:
 *  - Server Actions (lib/vouchers/actions.js)
 *  - API routes (app/api/vouchers/*)
 *  - Client forms (app/(pages)/dashboard/vouchers/_components/VoucherForm.jsx)
 */

import { z } from "zod";

// ── Primitive fragments ──

export const passengerSchema = z.object({
  full_name: z.string().trim().min(1, "Nombre requerido").max(200),
  id_type: z
    .enum(["PP", "CI", "DNI", "RIF", "Otro"], {
      errorMap: () => ({ message: "Tipo de identificación inválido" }),
    })
    .default("CI"),
  id_number: z.string().trim().min(1, "Número de identificación requerido").max(50),
  nationality: z.string().trim().max(80).optional().or(z.literal("")),
});

export const accommodationSchema = z
  .object({
    hotel_name: z.string().trim().max(300).optional().or(z.literal("")),
    room_description: z.string().trim().max(1000).optional().or(z.literal("")),
    check_in: z.string().trim().optional().or(z.literal("")),
    check_out: z.string().trim().optional().or(z.literal("")),
    nights: z.coerce.number().int().min(0).max(365).optional(),
    days: z.coerce.number().int().min(0).max(365).optional(),
    location: z.string().trim().max(300).optional().or(z.literal("")),
  })
  .partial()
  .optional();

export const excursionSchema = z.object({
  title: z.string().trim().min(1, "Título requerido").max(500),
  included: z.boolean().default(true),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const servicesSchema = z.object({
  accommodation: accommodationSchema.nullable().optional(),
  excursions: z.array(excursionSchema).default([]),
  transfers: z.array(z.string().trim().min(1).max(500)).default([]),
  meals: z.string().trim().max(2000).optional().or(z.literal("")),
  others: z.array(z.string().trim().min(1).max(500)).default([]),
});

// ── Base voucher schema (shared between create & update) ──

const voucherCoreFields = {
  title: z
    .string()
    .trim()
    .min(1, "Título requerido")
    .max(200)
    .default("Voucher de Servicios Pre-pagados"),
  subtitle: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal(""))
    .default("Su puerta de entrada a experiencias inolvidables en Venezuela"),
  locator_code: z.string().trim().max(50).optional().or(z.literal("")),
  issue_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)")
    .optional(),

  lead_id: z.string().uuid().nullable().optional(),
  quotation_id: z.string().uuid().nullable().optional(),
  advisor_id: z.string().uuid().nullable().optional(),
  provider_id: z.string().uuid().nullable().optional(),
  provider_snapshot: z.record(z.any()).nullable().optional(),

  passengers: z.array(passengerSchema).min(1, "Debe incluir al menos un pasajero"),
  services: servicesSchema,

  observations: z.string().trim().max(5000).optional().or(z.literal("")),
  emergency_contact: z.string().trim().max(50).optional().or(z.literal("")),
  important_notes: z.string().trim().max(5000).optional().or(z.literal("")),
  validity_notes: z.string().trim().max(5000).optional().or(z.literal("")),

  metadata: z.record(z.any()).optional(),
};

export const voucherCreateSchema = z.object(voucherCoreFields);

// For updates, all fields optional (PATCH semantics)
export const voucherUpdateSchema = z
  .object({
    title: voucherCoreFields.title.optional(),
    subtitle: voucherCoreFields.subtitle.optional(),
    locator_code: voucherCoreFields.locator_code,
    issue_date: voucherCoreFields.issue_date,
    lead_id: voucherCoreFields.lead_id,
    quotation_id: voucherCoreFields.quotation_id,
    advisor_id: voucherCoreFields.advisor_id,
    provider_id: voucherCoreFields.provider_id,
    provider_snapshot: voucherCoreFields.provider_snapshot,
    passengers: voucherCoreFields.passengers.optional(),
    services: voucherCoreFields.services.optional(),
    observations: voucherCoreFields.observations,
    emergency_contact: voucherCoreFields.emergency_contact,
    important_notes: voucherCoreFields.important_notes,
    validity_notes: voucherCoreFields.validity_notes,
    metadata: voucherCoreFields.metadata,
  })
  .strict();

// ── Status / cancellation helpers ──

export const voucherStatusSchema = z.enum(["draft", "issued", "sent", "cancelled"]);

export const voucherCancelSchema = z.object({
  reason: z.string().trim().min(3, "Razón requerida").max(1000),
});

export const voucherSendSchema = z.object({
  recipient_email: z.string().email("Email inválido"),
  recipient_name: z.string().trim().max(200).optional().or(z.literal("")),
  custom_message: z.string().trim().max(2000).optional().or(z.literal("")),
});

// ── Defaults helper (used by forms) ──

export function emptyVoucherDefaults() {
  return {
    title: "Voucher de Servicios Pre-pagados",
    subtitle: "Su puerta de entrada a experiencias inolvidables en Venezuela",
    locator_code: "",
    issue_date: new Date().toISOString().slice(0, 10),
    lead_id: null,
    quotation_id: null,
    advisor_id: null,
    provider_id: null,
    provider_snapshot: null,
    passengers: [{ full_name: "", id_type: "CI", id_number: "" }],
    services: {
      accommodation: {
        hotel_name: "",
        room_description: "",
        check_in: "",
        check_out: "",
        nights: 0,
        days: 0,
        location: "",
      },
      excursions: [],
      transfers: [],
      meals: "",
      others: [],
    },
    observations: "",
    emergency_contact: "+58 426-4034052",
    important_notes: "",
    validity_notes: "",
    metadata: {},
  };
}
