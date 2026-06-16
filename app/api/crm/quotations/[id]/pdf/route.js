/**
 * API para generar y descargar PDF de cotizaciones
 *
 * Design reference: Pencil "Pantalla 3 - PDF Brochure Preview"
 * Key design specs from Pencil:
 *   - Hero: gradient stops 0→transparent, 0.6→#000000BB, 1.0→#000000EE
 *   - Gallery images: cornerRadius 4, clip true, fill mode
 *   - Highlight cards: cornerRadius 8, padding 20, bg-muted
 *   - Section padding: [32, 48] (vertical, horizontal)
 *   - Day badges: 48×48, Day1=primary, Day2+=bg-muted+border
 *   - Price section: bg-muted, gap 16, large total in secondary color
 *   - Footer: primary bg, padding [32, 48]
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";
import {
  PAGE_W, PAGE_H, PAD, MARGIN_L, MARGIN_R, CONTENT_W, FOOTER_H,
  C,
  sanitize, fmt, safe, rightText, centerText, hLine, wrap,
  fetchImg, embedImg,
  clipRoundedRect, restoreClip, drawClippedImage, drawRoundedRect,
  ensureSpace, drawFooter,
  drawPolicies,
} from "@/lib/pdf/shared";

// ── HERO (Pencil: gradient 0→transparent, 0.6→#000000BB, 1.0→#000000EE) ──

async function drawHero(doc, page, item, fonts, logoImage) {
  const url = item.product_images?.[0] || item.destination_data?.image_url;
  if (!url) return PAGE_H - 50;

  const bytes = await fetchImg(url);
  const image = await embedImg(doc, bytes);
  if (!image) return PAGE_H - 50;

  const heroH = 300;
  const heroY = PAGE_H - heroH;

  // Draw image clipped to hero area (full bleed)
  clipRoundedRect(page, 0, heroY, PAGE_W, heroH, 0);
  const imgA = image.width / image.height;
  let dw = PAGE_W, dh = PAGE_W / imgA;
  if (dh < heroH) { dh = heroH; dw = heroH * imgA; }
  page.drawImage(image, { x: (PAGE_W - dw) / 2, y: heroY, width: dw, height: dh });
  restoreClip(page);

  // Dark overlay only at the bottom for text legibility (no gradient)
  page.drawRectangle({
    x: 0, y: heroY, width: PAGE_W, height: heroH * 0.35,
    color: C.shadow, opacity: 0.55,
  });

  // Logo top-left
  const logoH = 50;
  const logoScale = logoH / logoImage.height;
  const logoW = logoImage.width * logoScale;
  page.drawImage(logoImage, { x: PAD, y: PAGE_H - logoH - 16, width: logoW, height: logoH });

  // Large destination name at bottom — coerce to string in case the inventory
  // row stores a non-string (e.g. number) in destination_data.name.
  const name = String(item.destination_data?.name || item.description || "");
  safe(page, name.substring(0, 28), { x: PAD, y: heroY + 48, size: 28, font: fonts.bold, color: C.white });

  // Subtitle
  const sub = item.destination_data?.tags?.[0]
    ? `${item.destination_data.tags[0]}, Venezuela` : "";
  if (sub) safe(page, sub, { x: PAD, y: heroY + 30, size: 11, font: fonts.reg, color: C.white70 });

  return heroY - 5;
}

// ── QUOTE INFO BAR (Pencil: bg-muted, padding [24, 48]) ──

function drawQuoteBar(page, y, q, fonts) {
  const barH = 52;
  const barY = y - barH;

  page.drawRectangle({ x: 0, y: barY, width: PAGE_W, height: barH, color: C.bgMuted });

  const t1 = barY + 32, t2 = t1 - 16;

  safe(page, `Cotizacion ${q.quotation_number || "N/A"}`, {
    x: PAD, y: t1, size: 10, font: fonts.bold, color: C.textPrimary,
  });
  const cn = String(q.lead?.contact_name || q.metadata?.customer_name || "Cliente");
  safe(page, `Preparada para ${cn}`.substring(0, 50), {
    x: PAD, y: t2, size: 10, font: fonts.reg, color: C.textMuted,
  });

  const vd = q.valid_until
    ? new Date(q.valid_until).toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" })
    : "N/A";
  rightText(page, `Valida hasta ${vd}`, MARGIN_R, t1, 10, fonts.reg, C.textMuted);

  const pax = q.metadata?.passengers || (q.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
  rightText(page, `${pax} pasajero${pax !== 1 ? "s" : ""}`, MARGIN_R, t2, 10, fonts.bold, C.textPrimary);

  return barY - 20;
}

// ── DESTINATION INFO (Pencil: padding [32, 48], gap 20) ──

function drawDestination(doc, page, y, item, fonts, logoImage) {
  const dest = item.destination_data;
  if (!dest) return { page, y };

  ({ page, y } = ensureSpace(doc, page, y, 100, fonts, logoImage));

  // Section title (Pencil: 24px → PDF ~18px)
  safe(page, "Sobre el Destino", { x: PAD, y, size: 18, font: fonts.bold, color: C.textPrimary });
  y -= 26;

  // Description — prefer cultural_description from metadata if available
  const descText = dest.metadata?.cultural_description || dest.description;
  if (descText) {
    const lines = wrap(descText, fonts.reg, 11, CONTENT_W);
    for (const ln of lines.slice(0, 8)) {
      ({ page, y } = ensureSpace(doc, page, y, 18, fonts, logoImage));
      safe(page, ln, { x: PAD, y, size: 11, font: fonts.reg, color: C.textMuted });
      y -= 18; // lineHeight ~1.6
    }
  }

  // Highlight cards (Pencil: cornerRadius 8, padding 20, gap 16, bg-muted)
  const hl = dest.highlights;
  if (hl?.length > 0) {
    y -= 12;
    // Lookahead: highlights (72px) + gallery (~155px) should stay together
    const hasGallery = item.product_images?.length >= 2;
    const neededForBoth = 72 + (hasGallery ? 160 : 0);
    ({ page, y } = ensureSpace(doc, page, y, neededForBoth, fonts, logoImage));

    const items = hl.slice(0, 4);
    const gap = 12;
    const cw = (CONTENT_W - gap * (items.length - 1)) / items.length;
    const ch = 48;

    for (let i = 0; i < items.length; i++) {
      const cx = PAD + i * (cw + gap);
      // Rounded card background
      drawRoundedRect(page, cx, y - ch, cw, ch, 6, C.bgMuted);

      // Centered text
      const t = sanitize(items[i]);
      centerText(page, t, cx + cw / 2, y - ch / 2 - 4, 9, fonts.bold, C.textPrimary);
    }
    y -= ch + 12;
  }

  // Must-see places from metadata (if available)
  const places = dest.metadata?.must_see_places;
  if (places?.length > 0) {
    y -= 4;
    ({ page, y } = ensureSpace(doc, page, y, 30, fonts, logoImage));
    safe(page, "LUGARES IMPRESCINDIBLES", { x: PAD, y, size: 9, font: fonts.bold, color: C.secondary });
    y -= 18;
    for (const p of places.slice(0, 6)) {
      ({ page, y } = ensureSpace(doc, page, y, 14, fonts, logoImage));
      safe(page, `-  ${sanitize(p.name || "")}`, { x: PAD, y, size: 9.5, font: fonts.bold, color: C.textPrimary });
      y -= 14;
      if (p.description) {
        const pLines = wrap(p.description, fonts.reg, 9, CONTENT_W - 16);
        for (const ln of pLines.slice(0, 2)) {
          ({ page, y } = ensureSpace(doc, page, y, 13, fonts, logoImage));
          safe(page, ln, { x: PAD + 16, y, size: 9, font: fonts.reg, color: C.textMuted });
          y -= 13;
        }
      }
    }
    y -= 8;
  }

  // Practical info from metadata (if available)
  const pInfo = dest.metadata?.practical_info;
  if (pInfo && (pInfo.climate || pInfo.currency || pInfo.how_to_get_there)) {
    ({ page, y } = ensureSpace(doc, page, y, 30, fonts, logoImage));
    safe(page, "INFORMACION PRACTICA", { x: PAD, y, size: 9, font: fonts.bold, color: C.secondary });
    y -= 18;
    const infoItems = [
      { label: "Clima", val: pInfo.climate },
      { label: "Moneda", val: pInfo.currency },
      { label: "Como llegar", val: pInfo.how_to_get_there },
      { label: "Transporte", val: pInfo.local_transport },
      { label: "Consejo", val: pInfo.useful_tips },
    ];
    for (const item of infoItems) {
      if (!item.val) continue;
      ({ page, y } = ensureSpace(doc, page, y, 14, fonts, logoImage));
      safe(page, `${item.label}:`, { x: PAD, y, size: 9, font: fonts.bold, color: C.textPrimary });
      const iLines = wrap(item.val, fonts.reg, 9, CONTENT_W - 80);
      const firstLine = iLines[0] || "";
      safe(page, firstLine, { x: PAD + 75, y, size: 9, font: fonts.reg, color: C.textMuted });
      y -= 14;
      for (const ln of iLines.slice(1, 3)) {
        ({ page, y } = ensureSpace(doc, page, y, 13, fonts, logoImage));
        safe(page, ln, { x: PAD + 75, y, size: 9, font: fonts.reg, color: C.textMuted });
        y -= 13;
      }
    }
    y -= 8;
  }

  y -= 16;
  return { page, y };
}

// ── GALLERY (Pencil: 3 cols, cornerRadius 4, gap 8, height 160) ──

async function drawGallery(doc, page, y, item, fonts, logoImage) {
  const imgs = item.product_images;
  if (!imgs || imgs.length < 2) return { page, y };

  const urls = imgs.slice(1, 4); // Skip hero image
  if (urls.length < 1) return { page, y };

  const cellH = 115;
  ({ page, y } = ensureSpace(doc, page, y, cellH + 40, fonts, logoImage));

  y -= 4;

  const results = await Promise.allSettled(urls.map(u => fetchImg(u)));
  const loaded = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      const img = await embedImg(doc, r.value);
      if (img) loaded.push(img);
    }
  }
  if (loaded.length === 0) return { page, y };

  const gap = 8;
  const cols = loaded.length;
  const cw = (CONTENT_W - gap * (cols - 1)) / cols;

  for (let j = 0; j < loaded.length; j++) {
    const x = PAD + j * (cw + gap);
    // Rounded corners + shadow
    drawClippedImage(page, loaded[j], x, y - cellH, cw, cellH, 5, true);
  }

  y -= cellH + 20;
  return { page, y };
}

// ── ITINERARY (Pencil: badges 48×48, gap 20, divider #E8EBF0) ──

function drawItinerary(doc, page, y, item, fonts, logoImage) {
  const itin = item.product_details?.itinerary;
  if (!itin?.length) return { page, y };

  ({ page, y } = ensureSpace(doc, page, y, 70, fonts, logoImage));
  safe(page, "Itinerario", { x: PAD, y, size: 18, font: fonts.bold, color: C.textPrimary });
  y -= 30;

  for (let i = 0; i < itin.length; i++) {
    const day = itin[i];
    // Estimate space: title(18) + activities(~5 lines * 13) + meals(14) + divider(24)
    const actCount = Array.isArray(day.activities) ? Math.min(day.activities.join(" - ").split(/\s+/).length / 8, 5) : 2;
    const estH = 18 + actCount * 13 + (day.meals ? 16 : 0) + 24;
    ({ page, y } = ensureSpace(doc, page, y, Math.max(90, estH), fonts, logoImage));

    // Badge (Pencil: 48×48, cornerRadius implicit ~4)
    const bSz = 40;
    const bX = PAD, bY = y - bSz + 10;

    if (i === 0) {
      drawRoundedRect(page, bX, bY, bSz, bSz, 4, C.primary);
    } else {
      drawRoundedRect(page, bX, bY, bSz, bSz, 4, C.bgMuted);
      // Border effect: draw slightly smaller white inside, then muted on top
      page.drawRectangle({ x: bX + 0.5, y: bY + 0.5, width: bSz - 1, height: bSz - 1, borderColor: C.border, borderWidth: 1, color: C.bgMuted });
    }

    const num = String(i + 1).padStart(2, "0");
    const nw = fonts.bold.widthOfTextAtSize(num, 15);
    safe(page, num, {
      x: bX + (bSz - nw) / 2, y: bY + (bSz - 15) / 2,
      size: 15, font: fonts.bold, color: i === 0 ? C.white : C.textPrimary,
    });

    // Content (Pencil: title 14px medium, desc 12px, meals 11px)
    const cX = PAD + bSz + 18;
    const cW = CONTENT_W - bSz - 18;

    // day.day is a numeric index (1, 2, …) in the inventory schema, so the
    // previous chain `day.title || day.day || …` could resolve to a number
    // when day.title was empty — which then blew up at .substring() with
    // "TypeError: m.substring is not a function" (m being the minified
    // name of `title` in the production bundle).
    const title = day.title
      ? String(day.title)
      : `Día ${day.day || i + 1}`;
    safe(page, title.substring(0, 55), { x: cX, y, size: 12, font: fonts.bold, color: C.textPrimary });
    y -= 18;

    const acts = day.activities || day.description;
    if (acts) {
      const txt = Array.isArray(acts) ? acts.join(" - ") : acts;
      const lines = wrap(txt, fonts.reg, 9, cW);
      for (const ln of lines.slice(0, 5)) {
        ({ page, y } = ensureSpace(doc, page, y, 13, fonts, logoImage));
        safe(page, ln, { x: cX, y, size: 9, font: fonts.reg, color: C.textMuted });
        y -= 13;
      }
    }

    if (day.meals) {
      y -= 2;
      const meals = Array.isArray(day.meals) ? day.meals : [day.meals];
      ({ page, y } = ensureSpace(doc, page, y, 13, fonts, logoImage));
      let mx = cX;
      for (const m of meals.slice(0, 4)) {
        const mt = sanitize(m);
        safe(page, mt, { x: mx, y, size: 8.5, font: fonts.reg, color: C.textMuted });
        mx += fonts.reg.widthOfTextAtSize(mt, 8.5) + 14;
      }
      y -= 14;
    }

    // Divider (Pencil: #E8EBF0, height 1)
    if (i < itin.length - 1) {
      y -= 8;
      hLine(page, PAD, MARGIN_R, y, C.border, 0.5);
      y -= 16;
    } else {
      y -= 10;
    }
  }

  return { page, y };
}

// ── INCLUDES / EXCLUDES (Pencil: gap 40 between columns, gap 12 between items) ──

function drawInclExcl(doc, page, y, item, fonts, logoImage) {
  const inc = item.product_details?.includes;
  const exc = item.product_details?.not_includes;
  if (!inc?.length && !exc?.length) return { page, y };

  // Try two-column layout if both fit on current page, otherwise render sequentially
  const colGap = 35;
  const colW = (CONTENT_W - colGap) / 2;

  // Estimate total height for both columns
  const incH = inc?.length ? 20 + inc.slice(0, 12).length * 16 : 0;
  const excH = exc?.length ? 20 + exc.slice(0, 10).length * 16 : 0;
  const maxColH = Math.max(incH, excH);
  const twoColFits = y - maxColH - 30 > FOOTER_H + 10;

  if (twoColFits && inc?.length && exc?.length) {
    // Two-column layout — both fit on current page
    ({ page, y } = ensureSpace(doc, page, y, maxColH + 30, fonts, logoImage));

    let lY = y, rY = y;

    safe(page, "QUE INCLUYE", { x: PAD, y: lY, size: 9, font: fonts.bold, color: C.success });
    lY -= 20;
    for (const it of inc.slice(0, 12)) {
      safe(page, "+", { x: PAD + 2, y: lY, size: 10, font: fonts.bold, color: C.success });
      const lines = wrap(it, fonts.reg, 9.5, colW - 20);
      for (const ln of lines.slice(0, 2)) {
        safe(page, ln, { x: PAD + 18, y: lY, size: 9.5, font: fonts.reg, color: C.textPrimary });
        lY -= 14;
      }
    }

    const rX = PAD + colW + colGap;
    safe(page, "NO INCLUYE", { x: rX, y: rY, size: 9, font: fonts.bold, color: C.destructive });
    rY -= 20;
    for (const it of exc.slice(0, 10)) {
      safe(page, "x", { x: rX + 2, y: rY, size: 10, font: fonts.bold, color: C.destructive });
      const lines = wrap(it, fonts.reg, 9.5, colW - 20);
      for (const ln of lines.slice(0, 2)) {
        safe(page, ln, { x: rX + 18, y: rY, size: 9.5, font: fonts.reg, color: C.textPrimary });
        rY -= 14;
      }
    }

    y = Math.min(lY, rY) - 16;
  } else {
    // Sequential layout — render includes then excludes with proper page breaks
    if (inc?.length > 0) {
      ({ page, y } = ensureSpace(doc, page, y, 40, fonts, logoImage));
      safe(page, "QUE INCLUYE", { x: PAD, y, size: 9, font: fonts.bold, color: C.success });
      y -= 20;

      for (const it of inc.slice(0, 12)) {
        ({ page, y } = ensureSpace(doc, page, y, 16, fonts, logoImage));
        safe(page, "+", { x: PAD + 2, y, size: 10, font: fonts.bold, color: C.success });
        const lines = wrap(it, fonts.reg, 9.5, CONTENT_W - 20);
        for (const ln of lines.slice(0, 2)) {
          safe(page, ln, { x: PAD + 18, y, size: 9.5, font: fonts.reg, color: C.textPrimary });
          y -= 14;
        }
      }
      y -= 10;
    }

    if (exc?.length > 0) {
      ({ page, y } = ensureSpace(doc, page, y, 40, fonts, logoImage));
      safe(page, "NO INCLUYE", { x: PAD, y, size: 9, font: fonts.bold, color: C.destructive });
      y -= 20;

      for (const it of exc.slice(0, 10)) {
        ({ page, y } = ensureSpace(doc, page, y, 16, fonts, logoImage));
        safe(page, "x", { x: PAD + 2, y, size: 10, font: fonts.bold, color: C.destructive });
        const lines = wrap(it, fonts.reg, 9.5, CONTENT_W - 20);
        for (const ln of lines.slice(0, 2)) {
          safe(page, ln, { x: PAD + 18, y, size: 9.5, font: fonts.reg, color: C.textPrimary });
          y -= 14;
        }
      }
      y -= 6;
    }
  }

  return { page, y };
}

// ── PROVIDER ──

function drawProvider(doc, page, y, item, fonts, logoImage) {
  const p = item.provider_data;
  if (!p) return { page, y };
  ({ page, y } = ensureSpace(doc, page, y, 35, fonts, logoImage));

  safe(page, "OPERADOR", { x: PAD, y, size: 9, font: fonts.bold, color: C.secondary });
  y -= 18;
  let line = String(p.name || "");
  if (p.rating) line += `  *  ${p.rating}`;
  safe(page, line.substring(0, 60), { x: PAD, y, size: 11, font: fonts.reg, color: C.textPrimary });
  y -= 22;
  return { page, y };
}

// ── RECOMMENDATIONS ──

function drawRecs(doc, page, y, item, fonts, logoImage) {
  const recs = item.product_details?.recommendations;
  if (!recs?.length) return { page, y };
  ({ page, y } = ensureSpace(doc, page, y, 40, fonts, logoImage));

  safe(page, "RECOMENDACIONES", { x: PAD, y, size: 9, font: fonts.bold, color: C.secondary });
  y -= 18;

  for (const rec of recs.slice(0, 8)) {
    ({ page, y } = ensureSpace(doc, page, y, 14, fonts, logoImage));
    const lines = wrap(`-  ${rec}`, fonts.reg, 9.5, CONTENT_W);
    for (const ln of lines.slice(0, 2)) {
      safe(page, ln, { x: PAD, y, size: 9.5, font: fonts.reg, color: C.textPrimary });
      y -= 14;
    }
  }
  y -= 10;
  return { page, y };
}

// ── TRAVEL DETAILS (dates + passengers) ──

function drawTravelDetails(doc, page, y, q, fonts, logoImage) {
  const meta = q.metadata || {};
  const startDate = meta.start_date;
  const endDate = meta.end_date;
  const passengers = meta.passengers;

  if (!startDate && !endDate && !passengers) return { page, y };

  ({ page, y } = ensureSpace(doc, page, y, 60, fonts, logoImage));

  safe(page, "DETALLES DEL VIAJE", { x: PAD, y, size: 9, font: fonts.bold, color: C.secondary });
  y -= 20;

  const fmtDate = (d) => {
    if (!d) return null;
    return new Date(d + "T12:00:00").toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" });
  };

  if (startDate && endDate) {
    safe(page, `Del ${fmtDate(startDate)} al ${fmtDate(endDate)}`, {
      x: PAD, y, size: 11, font: fonts.reg, color: C.textPrimary,
    });
    y -= 18;
  } else if (startDate) {
    safe(page, `Fecha: ${fmtDate(startDate)}`, {
      x: PAD, y, size: 11, font: fonts.reg, color: C.textPrimary,
    });
    y -= 18;
  }

  if (passengers) {
    safe(page, `${passengers} pasajero${passengers !== 1 ? "s" : ""}`, {
      x: PAD, y, size: 11, font: fonts.reg, color: C.textPrimary,
    });
    y -= 18;
  }

  y -= 10;
  return { page, y };
}

// ── SPECIAL CONDITIONS ──

function drawConditions(doc, page, y, q, fonts, logoImage) {
  const conditions = q.metadata?.special_conditions;
  if (!conditions) return { page, y };

  ({ page, y } = ensureSpace(doc, page, y, 40, fonts, logoImage));

  safe(page, "CONDICIONES ESPECIALES", { x: PAD, y, size: 9, font: fonts.bold, color: C.secondary });
  y -= 16;

  // metadata is JSONB without type enforcement — coerce just in case.
  const lines = wrap(String(conditions).substring(0, 500), fonts.reg, 10, CONTENT_W);
  for (const ln of lines.slice(0, 10)) {
    ({ page, y } = ensureSpace(doc, page, y, 14, fonts, logoImage));
    safe(page, ln, { x: PAD, y, size: 10, font: fonts.reg, color: C.textPrimary });
    y -= 14;
  }
  y -= 10;
  return { page, y };
}

// ── PRICE SECTION (Pencil: bg-muted, gap 16, large total 36px in secondary) ──

function drawPrice(doc, page, y, q, fonts, logoImage) {
  const items = q.items || [];
  const addlServices = q.metadata?.additional_services || [];
  const rowsH = (items.length + addlServices.length) * 26;
  const needed = 70 + rowsH + 80;
  ({ page, y } = ensureSpace(doc, page, y, needed, fonts, logoImage));

  // Muted background
  const bgTop = y + 12;
  const bgBottom = y - needed + 20;
  page.drawRectangle({ x: 0, y: bgBottom, width: PAGE_W, height: bgTop - bgBottom, color: C.bgMuted });

  safe(page, "RESUMEN DE INVERSION", { x: PAD, y, size: 9, font: fonts.bold, color: C.textMuted });
  y -= 28;

  for (const item of items) {
    ({ page, y } = ensureSpace(doc, page, y, 24, fonts, logoImage));
    let desc = sanitize(item.description || "").substring(0, 55);
    const qty = item.quantity || 1;
    if (qty > 1) desc += ` x ${qty}`;
    safe(page, desc, { x: PAD, y, size: 11, font: fonts.reg, color: C.textPrimary });
    rightText(page, fmt(item.total || 0, q.currency), MARGIN_R, y, 11, fonts.bold, C.textPrimary);
    y -= 26;
  }

  // Additional services
  if (addlServices.length > 0) {
    y -= 4;
    safe(page, "Servicios Adicionales", { x: PAD, y, size: 9, font: fonts.bold, color: C.textMuted });
    y -= 22;
    for (const svc of addlServices) {
      ({ page, y } = ensureSpace(doc, page, y, 24, fonts, logoImage));
      safe(page, sanitize(svc.description || "Servicio").substring(0, 55), { x: PAD, y, size: 11, font: fonts.reg, color: C.textPrimary });
      rightText(page, fmt(parseFloat(svc.price) || 0, q.currency), MARGIN_R, y, 11, fonts.bold, C.textPrimary);
      y -= 26;
    }
  }

  if (q.taxes > 0) {
    safe(page, "Impuestos", { x: PAD, y, size: 11, font: fonts.reg, color: C.textMuted });
    rightText(page, fmt(q.taxes, q.currency), MARGIN_R, y, 11, fonts.bold, C.textMuted);
    y -= 24;
  }
  if (q.fees > 0) {
    safe(page, "Cargos adicionales", { x: PAD, y, size: 11, font: fonts.reg, color: C.textMuted });
    rightText(page, fmt(q.fees, q.currency), MARGIN_R, y, 11, fonts.bold, C.textMuted);
    y -= 24;
  }
  if (q.discount_amount > 0) {
    safe(page, "Descuento", { x: PAD, y, size: 11, font: fonts.reg, color: C.success });
    rightText(page, `-${fmt(q.discount_amount, q.currency)}`, MARGIN_R, y, 11, fonts.bold, C.success);
    y -= 24;
  }

  // Divider (Pencil: secondary color, height 2)
  y -= 4;
  hLine(page, PAD, MARGIN_R, y + 6, C.secondary, 2);
  y -= 12;

  // TOTAL row (Pencil: 14px label, 36px value in secondary → PDF ~28px)
  ({ page, y } = ensureSpace(doc, page, y, 40, fonts, logoImage));
  safe(page, "TOTAL", { x: PAD, y: y + 2, size: 12, font: fonts.bold, color: C.textPrimary });
  rightText(page, fmt(q.total, q.currency), MARGIN_R, y - 4, 26, fonts.bold, C.secondary);
  y -= 45;

  return { page, y };
}

// ── NOTES ──

function drawNotes(doc, page, y, q, fonts, logoImage) {
  if (!q.customer_notes) return { page, y };
  ({ page, y } = ensureSpace(doc, page, y, 40, fonts, logoImage));

  safe(page, "NOTAS", { x: PAD, y, size: 9, font: fonts.bold, color: C.textMuted });
  y -= 16;

  // customer_notes column is TEXT, but historically some rows have been
  // populated with numbers via admin tools — coerce defensively.
  const lines = wrap(String(q.customer_notes).substring(0, 500), fonts.reg, 10, CONTENT_W);
  for (const ln of lines.slice(0, 8)) {
    ({ page, y } = ensureSpace(doc, page, y, 14, fonts, logoImage));
    safe(page, ln, { x: PAD, y, size: 10, font: fonts.reg, color: C.textPrimary });
    y -= 14;
  }
  y -= 8;
  return { page, y };
}

// ── SIMPLE MODE (non-brochure: traditional header + table) ──

function drawSimpleFooter(page, fonts) {
  const fy = 35;
  hLine(page, PAD, MARGIN_R, fy + 15, C.secondary, 1.5);
  safe(page, "Venezuela Voyages", { x: PAD, y: fy, size: 9, font: fonts.bold, color: C.primary });
  safe(page, "Explore Now", { x: PAD + 105, y: fy, size: 9, font: fonts.reg, color: C.secondary });
  safe(page, "www.venezuelavoyages.com  |  info@venezuelavoyages.com", {
    x: PAD, y: fy - 14, size: 8, font: fonts.reg, color: C.textMuted,
  });
}

function drawSimpleHeader(page, q, fonts, logo) {
  let y = PAGE_H - 30;
  const lH = 90, lS = lH / logo.height, lW = logo.width * lS;
  page.drawImage(logo, { x: PAD, y: y - lH, width: lW, height: lH });

  rightText(page, "COTIZACION", MARGIN_R, y - 25, 9, fonts.reg, C.textMuted);
  rightText(page, q.quotation_number || "N/A", MARGIN_R, y - 48, q.quotation_number?.length > 16 ? 13 : 16, fonts.bold, C.primary);
  rightText(page, (q.status || "borrador").toUpperCase(), MARGIN_R, y - 66, 8, fonts.bold, C.secondary);

  y -= lH + 15;
  hLine(page, PAD, MARGIN_R, y, C.secondary, 2);

  const iy = y - 25;
  safe(page, "PARA", { x: PAD, y: iy, size: 8, font: fonts.bold, color: C.textMuted });
  // Customer contact fields come from lead OR JSONB metadata; both paths can
  // arrive non-string (e.g. phone stored as integer). Coerce uniformly.
  const cn = String(q.lead?.contact_name || q.metadata?.customer_name || "Cliente");
  const ce = String(q.lead?.contact_email || q.metadata?.customer_email || "");
  const cp = String(q.lead?.contact_phone || q.metadata?.customer_phone || "");
  safe(page, cn.substring(0, 35), { x: PAD, y: iy - 18, size: 11, font: fonts.bold, color: C.textPrimary });
  if (ce) safe(page, ce.substring(0, 40), { x: PAD, y: iy - 34, size: 9, font: fonts.reg, color: C.textMuted });
  if (cp) safe(page, cp.substring(0, 25), { x: PAD, y: iy - 48, size: 9, font: fonts.reg, color: C.textMuted });

  const dx = PAGE_W - 210;
  safe(page, "DETALLES", { x: dx, y: iy, size: 8, font: fonts.bold, color: C.textMuted });
  [
    { l: "Fecha", v: new Date(q.created_at).toLocaleDateString("es-VE") },
    { l: "Valida hasta", v: q.valid_until ? new Date(q.valid_until).toLocaleDateString("es-VE") : "N/A" },
    { l: "Moneda", v: q.currency || "USD" },
  ].forEach((r, i) => {
    const ry = iy - 18 - i * 16;
    safe(page, r.l, { x: dx, y: ry, size: 9, font: fonts.reg, color: C.textMuted });
    rightText(page, r.v, MARGIN_R, ry, 9, fonts.bold, C.textPrimary);
  });

  return iy - 80;
}

function drawSimpleTable(doc, page, y, q, fonts) {
  ({ page, y } = ensureSpace(doc, page, y, 120, fonts));
  hLine(page, PAD, MARGIN_R, y + 5, C.border, 0.5);

  page.drawRectangle({ x: PAD, y: y - 8, width: CONTENT_W, height: 22, color: C.primary });
  const cD = PAD + 10, cQ = PAD + 290, cU = PAD + 390, cT = MARGIN_R - 8;
  safe(page, "Descripcion", { x: cD, y: y - 2, size: 8, font: fonts.bold, color: C.white });
  rightText(page, "Cant.", cQ, y - 2, 8, fonts.bold, C.white);
  rightText(page, "P. Unit.", cU, y - 2, 8, fonts.bold, C.white);
  rightText(page, "Total", cT, y - 2, 8, fonts.bold, C.white);
  y -= 22;

  for (let i = 0; i < (q.items || []).length; i++) {
    ({ page, y } = ensureSpace(doc, page, y, 22, fonts));
    if (i % 2 === 0) page.drawRectangle({ x: PAD, y: y - 8, width: CONTENT_W, height: 22, color: C.bgMuted });
    const it = q.items[i];
    safe(page, String(it.description || "").substring(0, 38), { x: cD, y: y - 1, size: 9, font: fonts.reg, color: C.textPrimary });
    rightText(page, String(it.quantity || 1), cQ, y - 1, 9, fonts.reg, C.textPrimary);
    rightText(page, fmt(it.unit_price || 0, q.currency), cU, y - 1, 9, fonts.reg, C.textPrimary);
    rightText(page, fmt(it.total || 0, q.currency), cT, y - 1, 9, fonts.bold, C.textPrimary);
    y -= 22;
  }

  hLine(page, PAD, MARGIN_R, y, C.border, 0.5);
  y -= 25;

  const tr = (l, v, c = C.textMuted) => {
    rightText(page, l, PAGE_W / 2 + 55, y, 9, fonts.reg, c);
    rightText(page, v, MARGIN_R, y, 9, fonts.reg, c);
    y -= 18;
  };
  tr("Subtotal", fmt(q.subtotal, q.currency));
  if (q.taxes > 0) tr("Impuestos", fmt(q.taxes, q.currency));
  if (q.fees > 0) tr("Cargos", fmt(q.fees, q.currency));
  if (q.discount_amount > 0) tr("Descuento", `-${fmt(q.discount_amount, q.currency)}`, C.destructive);

  y -= 4;
  const bx = PAGE_W / 2 - 5;
  page.drawRectangle({ x: bx, y: y - 6, width: MARGIN_R - bx, height: 28, color: C.primary });
  safe(page, "TOTAL", { x: bx + 15, y: y + 4, size: 11, font: fonts.bold, color: C.white });
  rightText(page, fmt(q.total, q.currency), MARGIN_R - 8, y + 4, 11, fonts.bold, C.accent);
  y -= 40;
  return { page, y };
}

// ── MAIN GENERATOR ──

async function generatePDF(q) {
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { reg, bold };

  const logoBytes = readFileSync(join(process.cwd(), "public/images/venezuela-voyages-logo.png"));
  const logo = await doc.embedPng(logoBytes);

  const items = q.items || [];
  const enriched = items.filter(i => i.inventory_id);

  if (enriched.length === 0) {
    let page = doc.addPage([PAGE_W, PAGE_H]);
    let y = drawSimpleHeader(page, q, fonts, logo);
    drawSimpleFooter(page, fonts);
    ({ page, y } = drawSimpleTable(doc, page, y, q, fonts));
    ({ page, y } = drawNotes(doc, page, y, q, fonts));
    ({ page, y } = drawPolicies(doc, page, y, fonts));
  } else {
    for (const item of enriched) {
      let page = doc.addPage([PAGE_W, PAGE_H]);
      drawFooter(page, fonts, logo);

      let y = await drawHero(doc, page, item, fonts, logo);
      y = drawQuoteBar(page, y, q, fonts);
      ({ page, y } = drawTravelDetails(doc, page, y, q, fonts, logo));
      ({ page, y } = drawDestination(doc, page, y, item, fonts, logo));
      ({ page, y } = await drawGallery(doc, page, y, item, fonts, logo));
      ({ page, y } = drawItinerary(doc, page, y, item, fonts, logo));
      ({ page, y } = drawInclExcl(doc, page, y, item, fonts, logo));
      ({ page, y } = drawRecs(doc, page, y, item, fonts, logo));

      // Always start price summary on a fresh last page
      page = doc.addPage([PAGE_W, PAGE_H]);
      drawFooter(page, fonts, logo);
      y = PAGE_H - 40;
      ({ page, y } = drawPrice(doc, page, y, q, fonts, logo));
      ({ page, y } = drawConditions(doc, page, y, q, fonts, logo));
      ({ page, y } = drawNotes(doc, page, y, q, fonts, logo));
      ({ page, y } = drawPolicies(doc, page, y, fonts, logo));
    }
  }

  return Buffer.from(await doc.save());
}

// ── ROUTE HANDLERS ──

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createAdminClient();
    const { data: q, error } = await admin
      .from("quotations")
      .select("*, lead:leads(id, contact_name, contact_email, contact_phone, interest_type)")
      .eq("id", id).single();
    if (error || !q) return NextResponse.json({ error: "Cotizacion no encontrada" }, { status: 404 });

    const pdf = await generatePDF(q);
    const fileName = `quotations/${q.quotation_number}.pdf`;

    const { error: upErr } = await admin.storage.from("documents").upload(fileName, pdf, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      console.error("Upload error:", upErr);
      return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="cotizacion-${q.quotation_number}.pdf"` } });
    }

    const { data: urlData } = admin.storage.from("documents").getPublicUrl(fileName);
    await admin.from("quotations").update({ pdf_url: urlData.publicUrl, updated_at: new Date().toISOString() }).eq("id", id);

    return new NextResponse(pdf, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="cotizacion-${q.quotation_number}.pdf"`, "X-PDF-URL": urlData.publicUrl },
    });
  } catch (error) {
    console.error("PDF error:", error);
    return NextResponse.json({ error: "Error al generar el PDF: " + error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createAdminClient();
    const { data: q, error } = await admin
      .from("quotations")
      .select("*, lead:leads(id, contact_name, contact_email, contact_phone, interest_type)")
      .eq("id", id).single();
    if (error || !q) return NextResponse.json({ error: "Cotizacion no encontrada" }, { status: 404 });

    const pdf = await generatePDF(q);
    const fileName = `quotations/${q.quotation_number}.pdf`;

    const { data: upData, error: upErr } = await admin.storage.from("documents").upload(fileName, pdf, { contentType: "application/pdf", upsert: true });
    if (upErr) return NextResponse.json({ error: "Error al subir el PDF: " + upErr.message }, { status: 500 });

    const { data: urlData } = admin.storage.from("documents").getPublicUrl(fileName);
    await admin.from("quotations").update({ pdf_url: urlData.publicUrl, updated_at: new Date().toISOString() }).eq("id", id);

    return NextResponse.json({ success: true, pdf_url: urlData.publicUrl, file_path: upData.path });
  } catch (error) {
    console.error("PDF error:", error);
    return NextResponse.json({ error: "Error al generar el PDF: " + error.message }, { status: 500 });
  }
}
