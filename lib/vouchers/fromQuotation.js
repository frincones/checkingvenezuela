/**
 * Maps a quotation object to voucher form defaults.
 *
 * This is a best-effort heuristic: quotation items/metadata don't follow
 * a strict schema, so the extraction functions try multiple fields/patterns
 * and return sensible defaults. The agent is always expected to review and
 * complete the prefilled form.
 */

import { emptyVoucherDefaults } from "@/lib/vouchers/schema";

/**
 * @param {object} q – Supabase quotation row with lead join
 * @returns {object} – defaultValues for VoucherForm
 */
export function quotationToVoucherPrefill(q) {
  if (!q) return emptyVoucherDefaults();

  const meta = q.metadata || {};
  const items = q.items || [];
  const base = emptyVoucherDefaults();

  return {
    ...base,
    // CRM links
    lead_id: q.lead_id || null,
    quotation_id: q.id,
    advisor_id: q.advisor_id || null,
    locator_code: q.quotation_number || "",

    // Passengers — best effort from metadata
    passengers: buildPassengersFromMetadata(meta) || base.passengers,

    // Services
    services: {
      accommodation: extractAccommodation(items, meta),
      excursions: extractExcursions(items),
      transfers: extractTransfers(items, meta),
      meals: meta.meals_description || "",
      others: extractOthers(items, meta),
    },

    // Dates
    issue_date: new Date().toISOString().slice(0, 10),

    // Observations
    observations: meta.special_conditions || "",
    important_notes: meta.important_notes || "",
    validity_notes: buildValidity(meta),
    emergency_contact: base.emergency_contact,
  };
}

// ── Helpers ──

function buildPassengersFromMetadata(meta) {
  // Quotation metadata might have passenger_names or passengers_info
  const names = meta.passenger_names || meta.passengers_info || [];
  if (Array.isArray(names) && names.length > 0) {
    return names.map((n) => {
      if (typeof n === "string") {
        return { full_name: n.toUpperCase(), id_type: "CI", id_number: "" };
      }
      return {
        full_name: (n.name || n.full_name || "").toUpperCase(),
        id_type: n.id_type || "CI",
        id_number: n.id_number || "",
      };
    });
  }

  // Fallback: customer name as single passenger
  const cn = meta.customer_name;
  if (cn) {
    return [{ full_name: cn.toUpperCase(), id_type: "CI", id_number: "" }];
  }

  return null;
}

function extractAccommodation(items, meta) {
  // Try to find a hotel/package item
  const hit = items.find(
    (i) =>
      i.product_type === "package" ||
      i.product_type === "hotel" ||
      /hotel|posada|campamento|alojamiento/i.test(i.description || ""),
  );

  const acc = {
    hotel_name: "",
    room_description: "",
    check_in: meta.start_date || "",
    check_out: meta.end_date || "",
    nights: 0,
    days: 0,
    location: "",
  };

  if (hit) {
    acc.hotel_name = hit.description || hit.product_details?.name || "";
    acc.room_description = hit.product_details?.room_type || "";
    acc.location =
      hit.destination_data?.name || hit.product_details?.destination || "";
  }

  // Calculate days/nights
  if (acc.check_in && acc.check_out) {
    try {
      const d1 = new Date(`${acc.check_in}T12:00:00`);
      const d2 = new Date(`${acc.check_out}T12:00:00`);
      const diffMs = d2.getTime() - d1.getTime();
      if (diffMs > 0) {
        acc.nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
        acc.days = acc.nights + 1;
      }
    } catch {
      // ignore
    }
  }

  return acc;
}

function extractExcursions(items) {
  const excursions = [];

  for (const item of items) {
    const itin = item.product_details?.itinerary || [];
    for (const day of itin) {
      const dayActs = Array.isArray(day.activities) ? day.activities : [];
      for (const a of dayActs) {
        const title = typeof a === "string" ? a : a.title || a.name || String(a);
        if (title.trim()) {
          excursions.push({ title: title.trim(), included: true, note: "" });
        }
      }
    }

    // Also check product_details.includes as excursion-like items
    const includes = item.product_details?.includes || [];
    for (const inc of includes) {
      const s = typeof inc === "string" ? inc : String(inc);
      if (/excursi|tour|paseo|visita/i.test(s)) {
        excursions.push({ title: s.trim(), included: true, note: "" });
      }
    }
  }

  // Deduplicate by title
  const seen = new Set();
  return excursions.filter((e) => {
    const key = e.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractTransfers(items, meta) {
  const transfers = [];

  if (meta.transfers_included) {
    if (Array.isArray(meta.transfers_included)) {
      transfers.push(...meta.transfers_included);
    } else if (typeof meta.transfers_included === "string") {
      transfers.push(meta.transfers_included);
    }
  }

  for (const item of items) {
    const includes = item.product_details?.includes || [];
    for (const inc of includes) {
      const s = typeof inc === "string" ? inc : String(inc);
      if (/traslado|transfer|aeropuerto|lancha/i.test(s)) {
        transfers.push(s.trim());
      }
    }
  }

  // Deduplicate
  return [...new Set(transfers.filter(Boolean))];
}

function extractOthers(items, meta) {
  const others = [];

  if (Array.isArray(meta.additional_inclusions)) {
    others.push(...meta.additional_inclusions.map(String));
  }

  for (const item of items) {
    const includes = item.product_details?.includes || [];
    for (const inc of includes) {
      const s = typeof inc === "string" ? inc : String(inc);
      // Skip items that are excursions/transfers/meals — already extracted
      if (
        /excursi|tour|paseo|visita|traslado|transfer|aeropuerto|lancha|desayuno|almuerzo|cena|comida/i.test(
          s,
        )
      ) {
        continue;
      }
      // Skip items that look like accommodation
      if (/hotel|posada|campamento|alojamiento|habitaci/i.test(s)) continue;
      if (s.trim()) others.push(s.trim());
    }
  }

  return [...new Set(others)];
}

function buildValidity(meta) {
  if (meta.start_date && meta.end_date) {
    return `Este voucher es válido únicamente para los servicios especificados y en las fechas indicadas (${meta.start_date} al ${meta.end_date}).`;
  }
  return "Este voucher es válido únicamente para los servicios especificados y en las fechas indicadas.";
}
