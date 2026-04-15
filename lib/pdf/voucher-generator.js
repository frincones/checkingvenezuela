/**
 * Voucher PDF generator.
 *
 * Uses the same pdf-lib toolkit and brand tokens as the quotations generator
 * via lib/pdf/shared.js. The visual language (primary/secondary colors,
 * footer with logo, policies block, bgMuted sections, secondary labels)
 * is intentionally identical so that both documents feel like parts of
 * the same Venezuela Voyages document system.
 *
 * Layout overview (single letter-size page, multi-page if overflow):
 *
 *   [ Header ] logo + VOUCHER + voucher number
 *   [ PARA / DETALLES ]  client · issue date · locator · validity
 *   [ Title + subtitle ]
 *   [ Pasajeros ] bgMuted card with name + ID per passenger
 *   [ Descripcion de los Servicios ]
 *       Alojamiento / Excursiones / Traslados / Alimentacion / Otros
 *   [ Observaciones ] bgMuted card w/ emergency contact + important notes
 *   [ Politicas y Condiciones ] (reused drawPolicies)
 *   [ Footer ] drawFooter with logo + contact info
 */

import { PDFDocument, StandardFonts } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";
import {
  PAGE_W, PAGE_H, PAD, MARGIN_R, CONTENT_W, FOOTER_H,
  C,
  sanitize, safe, rightText, hLine, wrap,
  drawRoundedRect,
  ensureSpace, drawFooter,
  drawPolicies,
} from "@/lib/pdf/shared";

// ── HELPERS ──

function formatDateEs(value) {
  if (!value) return "";
  try {
    const d = typeof value === "string" ? new Date(`${value}T12:00:00`) : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatDateLongEs(value) {
  if (!value) return "";
  try {
    const d = typeof value === "string" ? new Date(`${value}T12:00:00`) : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-VE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function pickClientName(voucher) {
  return (
    voucher?.lead?.contact_name ||
    voucher?.metadata?.customer_name ||
    (Array.isArray(voucher?.passengers) && voucher.passengers[0]?.full_name) ||
    "Cliente"
  );
}

function pickClientEmail(voucher) {
  return voucher?.lead?.contact_email || voucher?.metadata?.customer_email || "";
}

function pickClientPhone(voucher) {
  return voucher?.lead?.contact_phone || voucher?.metadata?.customer_phone || "";
}

// ── SECTION: Header (similar to drawSimpleHeader of quotations) ──

function drawVoucherHeader(page, voucher, fonts, logo) {
  let y = PAGE_H - 30;
  const lH = 90;
  const lS = lH / logo.height;
  const lW = logo.width * lS;
  page.drawImage(logo, { x: PAD, y: y - lH, width: lW, height: lH });

  rightText(page, "VOUCHER", MARGIN_R, y - 25, 9, fonts.reg, C.textMuted);
  const number = voucher.voucher_number || "N/A";
  rightText(
    page,
    number,
    MARGIN_R,
    y - 48,
    number.length > 14 ? 13 : 16,
    fonts.bold,
    C.primary,
  );
  rightText(
    page,
    (voucher.status || "draft").toUpperCase(),
    MARGIN_R,
    y - 66,
    8,
    fonts.bold,
    C.secondary,
  );

  y -= lH + 15;
  hLine(page, PAD, MARGIN_R, y, C.secondary, 2);

  const iy = y - 25;

  // PARA column
  safe(page, "PARA", { x: PAD, y: iy, size: 8, font: fonts.bold, color: C.textMuted });
  safe(page, pickClientName(voucher).substring(0, 35), {
    x: PAD,
    y: iy - 18,
    size: 11,
    font: fonts.bold,
    color: C.textPrimary,
  });
  const email = pickClientEmail(voucher);
  if (email) {
    safe(page, email.substring(0, 40), {
      x: PAD,
      y: iy - 34,
      size: 9,
      font: fonts.reg,
      color: C.textMuted,
    });
  }
  const phone = pickClientPhone(voucher);
  if (phone) {
    safe(page, phone.substring(0, 25), {
      x: PAD,
      y: iy - 48,
      size: 9,
      font: fonts.reg,
      color: C.textMuted,
    });
  }

  // DETALLES column
  const dx = PAGE_W - 230;
  safe(page, "DETALLES", { x: dx, y: iy, size: 8, font: fonts.bold, color: C.textMuted });

  const rows = [
    { l: "Emitido", v: formatDateLongEs(voucher.issue_date || voucher.created_at) },
    { l: "Localizador", v: voucher.locator_code || "—" },
  ];
  const acc = voucher?.services?.accommodation;
  if (acc?.check_in && acc?.check_out) {
    rows.push({
      l: "Vigencia",
      v: `${formatDateEs(acc.check_in)} - ${formatDateEs(acc.check_out)}`,
    });
  }
  rows.forEach((r, i) => {
    const ry = iy - 18 - i * 16;
    safe(page, r.l, { x: dx, y: ry, size: 9, font: fonts.reg, color: C.textMuted });
    rightText(page, r.v || "—", MARGIN_R, ry, 9, fonts.bold, C.textPrimary);
  });

  return iy - 90;
}

// ── SECTION: Title + subtitle ──

function drawVoucherTitle(doc, page, y, voucher, fonts, logo) {
  ({ page, y } = ensureSpace(doc, page, y, 60, fonts, logo));

  const title = voucher.title || "Voucher de Servicios Pre-pagados";
  safe(page, title, { x: PAD, y, size: 18, font: fonts.bold, color: C.textPrimary });
  y -= 22;

  const subtitle = voucher.subtitle;
  if (subtitle) {
    const subLines = wrap(subtitle, fonts.reg, 11, CONTENT_W);
    for (const ln of subLines.slice(0, 2)) {
      safe(page, ln, { x: PAD, y, size: 11, font: fonts.reg, color: C.textMuted });
      y -= 15;
    }
  }
  y -= 10;
  return { page, y };
}

// ── SECTION: Passengers ──

function drawPassengers(doc, page, y, voucher, fonts, logo) {
  const pax = Array.isArray(voucher.passengers) ? voucher.passengers : [];
  if (pax.length === 0) return { page, y };

  // Estimate height: header(26) + 32 per passenger + padding
  const estH = 30 + pax.length * 32 + 16;
  ({ page, y } = ensureSpace(doc, page, y, estH + 8, fonts, logo));

  // bgMuted card
  const cardTop = y + 6;
  const cardBottom = y - estH;
  drawRoundedRect(page, PAD, cardBottom, CONTENT_W, cardTop - cardBottom, 6, C.bgMuted);

  let ty = y - 12;

  safe(page, "DETALLES DEL PASAJERO", {
    x: PAD + 18,
    y: ty,
    size: 9,
    font: fonts.bold,
    color: C.secondary,
  });
  ty -= 22;

  pax.forEach((p, idx) => {
    const label = `Pasajero ${idx + 1}:`;
    safe(page, label, {
      x: PAD + 18,
      y: ty,
      size: 10,
      font: fonts.bold,
      color: C.textPrimary,
    });
    const name = (p.full_name || "").toString().toUpperCase();
    safe(page, name.substring(0, 60), {
      x: PAD + 18 + 70,
      y: ty,
      size: 10,
      font: fonts.reg,
      color: C.textPrimary,
    });
    ty -= 14;

    const idLine = `${p.id_type || ""} ${p.id_number || ""}`.trim();
    if (idLine) {
      safe(page, `ID:`, {
        x: PAD + 18,
        y: ty,
        size: 9,
        font: fonts.reg,
        color: C.textMuted,
      });
      safe(page, idLine.substring(0, 60), {
        x: PAD + 18 + 70,
        y: ty,
        size: 9,
        font: fonts.reg,
        color: C.textMuted,
      });
    }
    ty -= 18;
  });

  y = cardBottom - 18;
  return { page, y };
}

// ── SECTION: Services ──

function drawServiceLabel(page, text, y, fonts) {
  safe(page, text, { x: PAD, y, size: 9, font: fonts.bold, color: C.secondary });
}

function drawAccommodation(doc, page, y, services, fonts, logo) {
  const acc = services?.accommodation;
  if (!acc || (!acc.hotel_name && !acc.room_description && !acc.check_in)) {
    return { page, y };
  }

  ({ page, y } = ensureSpace(doc, page, y, 90, fonts, logo));
  drawServiceLabel(page, "ALOJAMIENTO", y, fonts);
  y -= 18;

  if (acc.hotel_name) {
    const nameLines = wrap(`Nombre: ${acc.hotel_name}`, fonts.bold, 10.5, CONTENT_W);
    for (const ln of nameLines.slice(0, 2)) {
      ({ page, y } = ensureSpace(doc, page, y, 14, fonts, logo));
      safe(page, ln, { x: PAD, y, size: 10.5, font: fonts.bold, color: C.textPrimary });
      y -= 14;
    }
  }
  if (acc.room_description) {
    const descLines = wrap(acc.room_description, fonts.reg, 10, CONTENT_W);
    for (const ln of descLines.slice(0, 3)) {
      ({ page, y } = ensureSpace(doc, page, y, 14, fonts, logo));
      safe(page, ln, { x: PAD, y, size: 10, font: fonts.reg, color: C.textPrimary });
      y -= 14;
    }
  }
  if (acc.check_in || acc.check_out) {
    ({ page, y } = ensureSpace(doc, page, y, 14, fonts, logo));
    const range = [formatDateEs(acc.check_in), formatDateEs(acc.check_out)]
      .filter(Boolean)
      .join(" al ");
    if (range) {
      safe(page, `Fechas: ${range}`, {
        x: PAD,
        y,
        size: 10,
        font: fonts.reg,
        color: C.textPrimary,
      });
      y -= 14;
    }
  }
  if (acc.days || acc.nights) {
    ({ page, y } = ensureSpace(doc, page, y, 14, fonts, logo));
    const d = acc.days ? `${acc.days} día${acc.days === 1 ? "" : "s"}` : "";
    const n = acc.nights ? `${acc.nights} noche${acc.nights === 1 ? "" : "s"}` : "";
    const label = [d, n].filter(Boolean).join(" / ");
    if (label) {
      safe(page, `Duración: ${label}`, {
        x: PAD,
        y,
        size: 10,
        font: fonts.reg,
        color: C.textPrimary,
      });
      y -= 14;
    }
  }
  if (acc.location) {
    ({ page, y } = ensureSpace(doc, page, y, 14, fonts, logo));
    safe(page, `Ubicación: ${acc.location}`, {
      x: PAD,
      y,
      size: 10,
      font: fonts.reg,
      color: C.textPrimary,
    });
    y -= 14;
  }

  y -= 10;
  return { page, y };
}

function drawExcursions(doc, page, y, services, fonts, logo) {
  const items = Array.isArray(services?.excursions) ? services.excursions : [];
  if (items.length === 0) return { page, y };

  ({ page, y } = ensureSpace(doc, page, y, 40, fonts, logo));
  drawServiceLabel(page, "EXCURSIONES", y, fonts);
  y -= 18;

  for (const item of items) {
    const included = item.included !== false;
    const marker = included ? "+" : "-";
    const color = included ? C.success : C.destructive;

    ({ page, y } = ensureSpace(doc, page, y, 16, fonts, logo));
    safe(page, marker, { x: PAD + 2, y, size: 11, font: fonts.bold, color });
    const titleLines = wrap(item.title || "", fonts.reg, 10, CONTENT_W - 22);
    for (let i = 0; i < titleLines.slice(0, 3).length; i++) {
      if (i > 0) {
        ({ page, y } = ensureSpace(doc, page, y, 14, fonts, logo));
      }
      safe(page, titleLines[i], {
        x: PAD + 18,
        y,
        size: 10,
        font: fonts.reg,
        color: C.textPrimary,
      });
      y -= 14;
    }
    if (item.note) {
      const noteLines = wrap(item.note, fonts.reg, 9, CONTENT_W - 22);
      for (const ln of noteLines.slice(0, 2)) {
        ({ page, y } = ensureSpace(doc, page, y, 13, fonts, logo));
        safe(page, ln, { x: PAD + 18, y, size: 9, font: fonts.reg, color: C.textMuted });
        y -= 13;
      }
    }
  }

  y -= 6;
  return { page, y };
}

function drawStringList(doc, page, y, label, list, fonts, logo) {
  const arr = Array.isArray(list) ? list : [];
  if (arr.length === 0) return { page, y };

  ({ page, y } = ensureSpace(doc, page, y, 40, fonts, logo));
  drawServiceLabel(page, label, y, fonts);
  y -= 18;

  for (const value of arr) {
    const lines = wrap(`-  ${value}`, fonts.reg, 10, CONTENT_W);
    for (const ln of lines.slice(0, 3)) {
      ({ page, y } = ensureSpace(doc, page, y, 14, fonts, logo));
      safe(page, ln, { x: PAD, y, size: 10, font: fonts.reg, color: C.textPrimary });
      y -= 14;
    }
  }

  y -= 6;
  return { page, y };
}

function drawMeals(doc, page, y, services, fonts, logo) {
  const meals = services?.meals;
  if (!meals) return { page, y };

  ({ page, y } = ensureSpace(doc, page, y, 40, fonts, logo));
  drawServiceLabel(page, "ALIMENTACION", y, fonts);
  y -= 18;

  const lines = wrap(meals, fonts.reg, 10, CONTENT_W);
  for (const ln of lines.slice(0, 6)) {
    ({ page, y } = ensureSpace(doc, page, y, 14, fonts, logo));
    safe(page, ln, { x: PAD, y, size: 10, font: fonts.reg, color: C.textPrimary });
    y -= 14;
  }

  y -= 6;
  return { page, y };
}

function drawServicesSection(doc, page, y, voucher, fonts, logo) {
  const services = voucher.services || {};
  const hasAny =
    services.accommodation ||
    (services.excursions?.length ?? 0) > 0 ||
    (services.transfers?.length ?? 0) > 0 ||
    services.meals ||
    (services.others?.length ?? 0) > 0;
  if (!hasAny) return { page, y };

  ({ page, y } = ensureSpace(doc, page, y, 40, fonts, logo));
  safe(page, "Descripción de los Servicios", {
    x: PAD,
    y,
    size: 15,
    font: fonts.bold,
    color: C.textPrimary,
  });
  y -= 22;

  ({ page, y } = drawAccommodation(doc, page, y, services, fonts, logo));
  ({ page, y } = drawExcursions(doc, page, y, services, fonts, logo));
  ({ page, y } = drawStringList(doc, page, y, "TRASLADOS", services.transfers, fonts, logo));
  ({ page, y } = drawMeals(doc, page, y, services, fonts, logo));
  ({ page, y } = drawStringList(doc, page, y, "OTROS", services.others, fonts, logo));

  return { page, y };
}

// ── SECTION: Observations ──

function drawObservations(doc, page, y, voucher, fonts, logo) {
  const parts = [];
  if (voucher.observations) parts.push({ kind: "text", value: voucher.observations });
  if (voucher.emergency_contact)
    parts.push({ kind: "label", label: "Contacto de emergencia", value: voucher.emergency_contact });
  if (voucher.important_notes)
    parts.push({ kind: "alert", value: voucher.important_notes });
  if (voucher.validity_notes)
    parts.push({ kind: "text", value: voucher.validity_notes });

  if (parts.length === 0) return { page, y };

  // Estimate height
  let estH = 36; // label + padding
  for (const p of parts) {
    if (p.kind === "label") estH += 16;
    else estH += 16 + Math.min(4, Math.ceil((p.value?.length || 0) / 90)) * 13;
  }
  estH += 24; // closing line

  ({ page, y } = ensureSpace(doc, page, y, estH + 12, fonts, logo));

  const cardTop = y + 6;
  const cardBottom = y - estH;
  drawRoundedRect(page, PAD, cardBottom, CONTENT_W, cardTop - cardBottom, 6, C.bgMuted);

  let ty = y - 12;
  safe(page, "OBSERVACIONES", {
    x: PAD + 18,
    y: ty,
    size: 9,
    font: fonts.bold,
    color: C.secondary,
  });
  ty -= 20;

  for (const p of parts) {
    if (p.kind === "label") {
      safe(page, `${p.label}:`, {
        x: PAD + 18,
        y: ty,
        size: 9.5,
        font: fonts.bold,
        color: C.textPrimary,
      });
      safe(page, ` ${p.value}`, {
        x: PAD + 18 + fonts.bold.widthOfTextAtSize(sanitize(`${p.label}:`), 9.5) + 4,
        y: ty,
        size: 9.5,
        font: fonts.reg,
        color: C.textPrimary,
      });
      ty -= 16;
    } else if (p.kind === "alert") {
      const lines = wrap(p.value, fonts.bold, 9.5, CONTENT_W - 36);
      for (const ln of lines.slice(0, 4)) {
        safe(page, ln, {
          x: PAD + 18,
          y: ty,
          size: 9.5,
          font: fonts.bold,
          color: C.destructive,
        });
        ty -= 13;
      }
      ty -= 3;
    } else {
      const lines = wrap(p.value, fonts.reg, 9.5, CONTENT_W - 36);
      for (const ln of lines.slice(0, 6)) {
        safe(page, ln, {
          x: PAD + 18,
          y: ty,
          size: 9.5,
          font: fonts.reg,
          color: C.textPrimary,
        });
        ty -= 13;
      }
      ty -= 3;
    }
  }

  // Closing line
  safe(page, "Disfrute su viaje con Venezuela Voyages.", {
    x: PAD + 18,
    y: ty,
    size: 10,
    font: fonts.bold,
    color: C.primary,
  });

  y = cardBottom - 18;
  return { page, y };
}

// ── MAIN GENERATOR ──

export async function generateVoucherPDF(voucher) {
  if (!voucher) throw new Error("Voucher requerido");

  const doc = await PDFDocument.create();

  doc.setTitle(`Voucher ${voucher.voucher_number || ""}`);
  doc.setAuthor("Venezuela Voyages");
  doc.setSubject(voucher.title || "Voucher de Servicios Pre-pagados");
  doc.setProducer("Venezuela Voyages PDF Engine");
  doc.setCreator("Venezuela Voyages");

  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { reg, bold };

  const logoBytes = readFileSync(
    join(process.cwd(), "public/images/venezuela-voyages-logo.png"),
  );
  const logo = await doc.embedPng(logoBytes);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  drawFooter(page, fonts, logo);

  let y = drawVoucherHeader(page, voucher, fonts, logo);
  ({ page, y } = drawVoucherTitle(doc, page, y, voucher, fonts, logo));
  ({ page, y } = drawPassengers(doc, page, y, voucher, fonts, logo));
  ({ page, y } = drawServicesSection(doc, page, y, voucher, fonts, logo));
  ({ page, y } = drawObservations(doc, page, y, voucher, fonts, logo));
  ({ page, y } = drawPolicies(doc, page, y, fonts, logo));

  return Buffer.from(await doc.save());
}
