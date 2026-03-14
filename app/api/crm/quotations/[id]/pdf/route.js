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
import {
  PDFDocument, rgb, StandardFonts,
  pushGraphicsState, popGraphicsState,
  moveTo, lineTo, closePath, clip, endPath,
  appendBezierCurve,
} from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";

// ── CONSTANTS ──

const PAGE_W = 612;
const PAGE_H = 792;
const PAD = 48;                          // horizontal padding (matches Pencil 48px)
const MARGIN_L = PAD;
const MARGIN_R = PAGE_W - PAD;
const CONTENT_W = MARGIN_R - MARGIN_L;   // 516
const FOOTER_H = 60;

// Brand colors
const C = {
  primary: rgb(10 / 255, 26 / 255, 68 / 255),
  secondary: rgb(242 / 255, 169 / 255, 59 / 255),
  accent: rgb(255 / 255, 210 / 255, 117 / 255),
  textPrimary: rgb(10 / 255, 26 / 255, 68 / 255),
  textMuted: rgb(123 / 255, 140 / 255, 163 / 255),
  bgMuted: rgb(243 / 255, 244 / 255, 246 / 255),
  border: rgb(232 / 255, 235 / 255, 240 / 255),
  white: rgb(1, 1, 1),
  white70: rgb(180 / 255, 180 / 255, 195 / 255),
  success: rgb(16 / 255, 185 / 255, 129 / 255),
  destructive: rgb(242 / 255, 55 / 255, 63 / 255),
  shadow: rgb(0, 0, 0),
};

// ── TEXT UTILITIES ──

function sanitize(text) {
  if (!text) return "";
  return String(text)
    .replace(/[\u2713\u2714]/g, "+").replace(/[\u2717\u2718]/g, "-")
    .replace(/[\u2605\u2606]/g, "*").replace(/\u2022/g, "-")
    .replace(/[\u2013\u2014]/g, "-").replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"').replace(/\u2026/g, "...")
    .replace(/[^\x00-\xFF]/g, "");
}

function fmt(amount, currency = "USD") {
  return new Intl.NumberFormat("es-VE", {
    style: "currency", currency, minimumFractionDigits: 2,
  }).format(amount || 0);
}

function safe(page, text, opts) {
  page.drawText(sanitize(text), opts);
}

function rightText(page, text, rightX, y, size, font, color) {
  const s = sanitize(text);
  page.drawText(s, { x: rightX - font.widthOfTextAtSize(s, size), y, size, font, color });
}

function centerText(page, text, centerX, y, size, font, color) {
  const s = sanitize(text);
  page.drawText(s, { x: centerX - font.widthOfTextAtSize(s, size) / 2, y, size, font, color });
}

function hLine(page, x1, x2, y, color, thickness = 0.5) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

function wrap(text, font, fontSize, maxW) {
  if (!text) return [];
  const words = sanitize(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, fontSize) > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ── IMAGE UTILITIES ──

async function fetchImg(url, timeoutMs = 8000) {
  if (!url) return null;
  try {
    const u = url.includes("unsplash.com") && !url.includes("w=")
      ? `${url}${url.includes("?") ? "&" : "?"}w=800&q=80` : url;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(u, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch { return null; }
}

async function embedImg(doc, bytes) {
  if (!bytes) return null;
  try { return await doc.embedJpg(bytes); } catch {
    try { return await doc.embedPng(bytes); } catch { return null; }
  }
}

// ── CLIPPING UTILITIES ──

/** Bezier control point factor for approximating quarter-circle arcs */
const K = 0.5522847498;

/**
 * Push a rounded rectangle clip path.
 * Uses cubic bezier curves at corners for smooth rounding.
 */
function clipRoundedRect(page, x, y, w, h, r) {
  if (r <= 0) {
    // Simple rectangle clip
    page.pushOperators(
      pushGraphicsState(),
      moveTo(x, y), lineTo(x + w, y), lineTo(x + w, y + h), lineTo(x, y + h),
      closePath(), clip(), endPath(),
    );
    return;
  }

  r = Math.min(r, w / 2, h / 2);

  page.pushOperators(
    pushGraphicsState(),
    // Start at bottom-left, just after corner
    moveTo(x + r, y),
    // Bottom edge → bottom-right corner
    lineTo(x + w - r, y),
    appendBezierCurve(x + w - r + K * r, y, x + w, y + r - K * r, x + w, y + r),
    // Right edge → top-right corner
    lineTo(x + w, y + h - r),
    appendBezierCurve(x + w, y + h - r + K * r, x + w - r + K * r, y + h, x + w - r, y + h),
    // Top edge → top-left corner
    lineTo(x + r, y + h),
    appendBezierCurve(x + r - K * r, y + h, x, y + h - r + K * r, x, y + h - r),
    // Left edge → bottom-left corner
    lineTo(x, y + r),
    appendBezierCurve(x, y + r - K * r, x + r - K * r, y, x + r, y),
    closePath(), clip(), endPath(),
  );
}

function restoreClip(page) {
  page.pushOperators(popGraphicsState());
}

/**
 * Draw image in "cover" mode, clipped to a rounded rectangle.
 * Optionally draws a subtle shadow behind the image.
 */
function drawClippedImage(page, image, x, y, w, h, radius = 0, shadow = false) {
  // Shadow (slightly offset, larger)
  if (shadow) {
    const sr = radius > 0 ? radius + 1 : 0;
    drawRoundedRect(page, x + 1, y - 2, w, h, sr, C.shadow, 0.08);
    drawRoundedRect(page, x, y - 1, w, h, sr, C.shadow, 0.04);
  }

  // Background fill (visible while image loads or if transparent)
  drawRoundedRect(page, x, y, w, h, radius, C.bgMuted, 1);

  // Clip to rounded rect
  clipRoundedRect(page, x, y, w, h, radius);

  // Calculate cover dimensions
  const imgAspect = image.width / image.height;
  const cellAspect = w / h;
  let dw, dh;
  if (imgAspect > cellAspect) { dh = h; dw = h * imgAspect; }
  else { dw = w; dh = w / imgAspect; }

  page.drawImage(image, {
    x: x + (w - dw) / 2, y: y + (h - dh) / 2, width: dw, height: dh,
  });

  restoreClip(page);
}

/**
 * Draw a filled rounded rectangle (no clipping, just visual).
 */
function drawRoundedRect(page, x, y, w, h, r, color, opacity = 1) {
  if (r <= 0) {
    page.drawRectangle({ x, y, width: w, height: h, color, opacity });
    return;
  }
  r = Math.min(r, w / 2, h / 2);

  // Use clip + fill approach: save state, set clip, fill full area, restore
  page.pushOperators(pushGraphicsState());
  page.pushOperators(
    moveTo(x + r, y),
    lineTo(x + w - r, y),
    appendBezierCurve(x + w - r + K * r, y, x + w, y + r - K * r, x + w, y + r),
    lineTo(x + w, y + h - r),
    appendBezierCurve(x + w, y + h - r + K * r, x + w - r + K * r, y + h, x + w - r, y + h),
    lineTo(x + r, y + h),
    appendBezierCurve(x + r - K * r, y + h, x, y + h - r + K * r, x, y + h - r),
    lineTo(x, y + r),
    appendBezierCurve(x, y + r - K * r, x + r - K * r, y, x + r, y),
    closePath(), clip(), endPath(),
  );
  page.drawRectangle({ x, y, width: w, height: h, color, opacity });
  page.pushOperators(popGraphicsState());
}

function ensureSpace(doc, page, y, need, fonts) {
  if (y - need < FOOTER_H + 10) {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    drawFooter(p, fonts);
    return { page: p, y: PAGE_H - 40 };
  }
  return { page, y };
}

// ── FOOTER (Pencil: primary bg, padding [32, 48]) ──

function drawFooter(page, fonts) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: FOOTER_H, color: C.primary });
  safe(page, "VENEZUELA VOYAGES", { x: PAD, y: 36, size: 10, font: fonts.bold, color: C.accent });
  safe(page, "Tu viaje comienza aqui", { x: PAD, y: 22, size: 9, font: fonts.reg, color: C.white70 });
  rightText(page, "info@venezuelavoyages.com", MARGIN_R, 38, 9, fonts.reg, C.white70);
  rightText(page, "+58 426 403 4052", MARGIN_R, 26, 9, fonts.reg, C.white70);
  rightText(page, "www.venezuelavoyages.com", MARGIN_R, 14, 9, fonts.reg, C.accent);
}

// ── HERO (Pencil: gradient 0→transparent, 0.6→#000000BB, 1.0→#000000EE) ──

async function drawHero(doc, page, item, fonts) {
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

  // Brand text top-left
  safe(page, "VENEZUELA", { x: PAD, y: PAGE_H - 26, size: 7, font: fonts.bold, color: C.accent });
  safe(page, "VOYAGES", { x: PAD, y: PAGE_H - 36, size: 7, font: fonts.bold, color: C.accent });

  // Large destination name at bottom
  const name = item.destination_data?.name || item.description || "";
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
  const cn = q.lead?.contact_name || q.metadata?.customer_name || "Cliente";
  safe(page, `Preparada para ${cn}`.substring(0, 50), {
    x: PAD, y: t2, size: 10, font: fonts.reg, color: C.textMuted,
  });

  const vd = q.valid_until
    ? new Date(q.valid_until).toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" })
    : "N/A";
  rightText(page, `Valida hasta ${vd}`, MARGIN_R, t1, 10, fonts.reg, C.textMuted);

  const pax = (q.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
  rightText(page, `${pax} pasajero${pax !== 1 ? "s" : ""}`, MARGIN_R, t2, 10, fonts.bold, C.textPrimary);

  return barY - 20;
}

// ── DESTINATION INFO (Pencil: padding [32, 48], gap 20) ──

function drawDestination(doc, page, y, item, fonts) {
  const dest = item.destination_data;
  if (!dest) return { page, y };

  ({ page, y } = ensureSpace(doc, page, y, 100, fonts));

  // Section title (Pencil: 24px → PDF ~18px)
  safe(page, "Sobre el Destino", { x: PAD, y, size: 18, font: fonts.bold, color: C.textPrimary });
  y -= 26;

  // Description (Pencil: 13px, lineHeight 1.6)
  if (dest.description) {
    const lines = wrap(dest.description, fonts.reg, 11, CONTENT_W);
    for (const ln of lines.slice(0, 6)) {
      ({ page, y } = ensureSpace(doc, page, y, 18, fonts));
      safe(page, ln, { x: PAD, y, size: 11, font: fonts.reg, color: C.textMuted });
      y -= 18; // lineHeight ~1.6
    }
  }

  // Highlight cards (Pencil: cornerRadius 8, padding 20, gap 16, bg-muted)
  const hl = dest.highlights;
  if (hl?.length > 0) {
    y -= 12;
    ({ page, y } = ensureSpace(doc, page, y, 55, fonts));

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

  y -= 16;
  return { page, y };
}

// ── GALLERY (Pencil: 3 cols, cornerRadius 4, gap 8, height 160) ──

async function drawGallery(doc, page, y, item, fonts) {
  const imgs = item.product_images;
  if (!imgs || imgs.length < 2) return { page, y };

  const urls = imgs.slice(1, 4); // Skip hero image
  if (urls.length < 1) return { page, y };

  const cellH = 115;
  ({ page, y } = ensureSpace(doc, page, y, cellH + 40, fonts));

  safe(page, "Galeria", { x: PAD, y, size: 18, font: fonts.bold, color: C.textPrimary });
  y -= 24;

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

function drawItinerary(doc, page, y, item, fonts) {
  const itin = item.product_details?.itinerary;
  if (!itin?.length) return { page, y };

  ({ page, y } = ensureSpace(doc, page, y, 70, fonts));
  safe(page, "Itinerario", { x: PAD, y, size: 18, font: fonts.bold, color: C.textPrimary });
  y -= 30;

  for (let i = 0; i < itin.length; i++) {
    const day = itin[i];
    ({ page, y } = ensureSpace(doc, page, y, 90, fonts));

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

    const title = day.title || day.day || `Dia ${i + 1}`;
    safe(page, title.substring(0, 55), { x: cX, y, size: 12, font: fonts.bold, color: C.textPrimary });
    y -= 18;

    const acts = day.activities || day.description;
    if (acts) {
      const txt = Array.isArray(acts) ? acts.join(" - ") : acts;
      const lines = wrap(txt, fonts.reg, 9, cW);
      for (const ln of lines.slice(0, 5)) {
        ({ page, y } = ensureSpace(doc, page, y, 13, fonts));
        safe(page, ln, { x: cX, y, size: 9, font: fonts.reg, color: C.textMuted });
        y -= 13;
      }
    }

    if (day.meals) {
      y -= 2;
      const meals = Array.isArray(day.meals) ? day.meals : [day.meals];
      ({ page, y } = ensureSpace(doc, page, y, 13, fonts));
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

function drawInclExcl(doc, page, y, item, fonts) {
  const inc = item.product_details?.includes;
  const exc = item.product_details?.not_includes;
  if (!inc?.length && !exc?.length) return { page, y };

  ({ page, y } = ensureSpace(doc, page, y, 80, fonts));

  const colGap = 35;
  const colW = (CONTENT_W - colGap) / 2;
  let lY = y, rY = y;

  if (inc?.length > 0) {
    safe(page, "QUE INCLUYE", { x: PAD, y: lY, size: 9, font: fonts.bold, color: C.success });
    lY -= 20;

    for (const it of inc.slice(0, 12)) {
      ({ page, lY } = (() => {
        const r = ensureSpace(doc, page, lY, 16, fonts);
        return { page: r.page, lY: r.y };
      })());

      safe(page, "+", { x: PAD + 2, y: lY, size: 10, font: fonts.bold, color: C.success });
      const lines = wrap(it, fonts.reg, 9.5, colW - 20);
      for (const ln of lines.slice(0, 2)) {
        safe(page, ln, { x: PAD + 18, y: lY, size: 9.5, font: fonts.reg, color: C.textPrimary });
        lY -= 14;
      }
    }
  }

  if (exc?.length > 0) {
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
  }

  y = Math.min(lY, rY) - 16;
  return { page, y };
}

// ── PROVIDER ──

function drawProvider(doc, page, y, item, fonts) {
  const p = item.provider_data;
  if (!p) return { page, y };
  ({ page, y } = ensureSpace(doc, page, y, 35, fonts));

  safe(page, "OPERADOR", { x: PAD, y, size: 9, font: fonts.bold, color: C.secondary });
  y -= 18;
  let line = p.name || "";
  if (p.rating) line += `  *  ${p.rating}`;
  safe(page, line.substring(0, 60), { x: PAD, y, size: 11, font: fonts.reg, color: C.textPrimary });
  y -= 22;
  return { page, y };
}

// ── RECOMMENDATIONS ──

function drawRecs(doc, page, y, item, fonts) {
  const recs = item.product_details?.recommendations;
  if (!recs?.length) return { page, y };
  ({ page, y } = ensureSpace(doc, page, y, 40, fonts));

  safe(page, "RECOMENDACIONES", { x: PAD, y, size: 9, font: fonts.bold, color: C.secondary });
  y -= 18;

  for (const rec of recs.slice(0, 8)) {
    ({ page, y } = ensureSpace(doc, page, y, 14, fonts));
    const lines = wrap(`-  ${rec}`, fonts.reg, 9.5, CONTENT_W);
    for (const ln of lines.slice(0, 2)) {
      safe(page, ln, { x: PAD, y, size: 9.5, font: fonts.reg, color: C.textPrimary });
      y -= 14;
    }
  }
  y -= 10;
  return { page, y };
}

// ── PRICE SECTION (Pencil: bg-muted, gap 16, large total 36px in secondary) ──

function drawPrice(doc, page, y, q, fonts) {
  const items = q.items || [];
  const rowsH = items.length * 26;
  const needed = 70 + rowsH + 80;
  ({ page, y } = ensureSpace(doc, page, y, needed, fonts));

  // Muted background
  const bgTop = y + 12;
  const bgBottom = y - needed + 20;
  page.drawRectangle({ x: 0, y: bgBottom, width: PAGE_W, height: bgTop - bgBottom, color: C.bgMuted });

  safe(page, "RESUMEN DE INVERSION", { x: PAD, y, size: 9, font: fonts.bold, color: C.textMuted });
  y -= 28;

  for (const item of items) {
    ({ page, y } = ensureSpace(doc, page, y, 24, fonts));
    let desc = sanitize(item.description || "").substring(0, 55);
    const qty = item.quantity || 1;
    if (qty > 1) desc += ` x ${qty}`;
    safe(page, desc, { x: PAD, y, size: 11, font: fonts.reg, color: C.textPrimary });
    rightText(page, fmt(item.total || 0, q.currency), MARGIN_R, y, 11, fonts.bold, C.textPrimary);
    y -= 26;
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
  ({ page, y } = ensureSpace(doc, page, y, 40, fonts));
  safe(page, "TOTAL", { x: PAD, y: y + 2, size: 12, font: fonts.bold, color: C.textPrimary });
  rightText(page, fmt(q.total, q.currency), MARGIN_R, y - 4, 26, fonts.bold, C.secondary);
  y -= 45;

  return { page, y };
}

// ── NOTES ──

function drawNotes(doc, page, y, q, fonts) {
  if (!q.customer_notes) return { page, y };
  ({ page, y } = ensureSpace(doc, page, y, 40, fonts));

  safe(page, "NOTAS", { x: PAD, y, size: 9, font: fonts.bold, color: C.textMuted });
  y -= 16;

  const lines = wrap(q.customer_notes.substring(0, 500), fonts.reg, 10, CONTENT_W);
  for (const ln of lines.slice(0, 8)) {
    ({ page, y } = ensureSpace(doc, page, y, 14, fonts));
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
  const cn = q.lead?.contact_name || q.metadata?.customer_name || "Cliente";
  const ce = q.lead?.contact_email || q.metadata?.customer_email || "";
  const cp = q.lead?.contact_phone || q.metadata?.customer_phone || "";
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
    safe(page, (it.description || "").substring(0, 38), { x: cD, y: y - 1, size: 9, font: fonts.reg, color: C.textPrimary });
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
  } else {
    for (const item of enriched) {
      let page = doc.addPage([PAGE_W, PAGE_H]);
      drawFooter(page, fonts);

      let y = await drawHero(doc, page, item, fonts);
      y = drawQuoteBar(page, y, q, fonts);
      ({ page, y } = drawDestination(doc, page, y, item, fonts));
      ({ page, y } = await drawGallery(doc, page, y, item, fonts));
      ({ page, y } = drawItinerary(doc, page, y, item, fonts));
      ({ page, y } = drawInclExcl(doc, page, y, item, fonts));
      ({ page, y } = drawProvider(doc, page, y, item, fonts));
      ({ page, y } = drawRecs(doc, page, y, item, fonts));

      if (y < 220) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        drawFooter(page, fonts);
        y = PAGE_H - 40;
      }
      ({ page, y } = drawPrice(doc, page, y, q, fonts));
      ({ page, y } = drawNotes(doc, page, y, q, fonts));
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
