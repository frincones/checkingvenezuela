/**
 * API para generar y descargar PDF de cotizaciones
 *
 * GET /api/crm/quotations/[id]/pdf - Genera, guarda en Storage y retorna URL
 *
 * Modes:
 * - Simple: classic table PDF for manual items only
 * - Brochure: multi-page visual PDF when enriched items exist
 *
 * Design reference: Pencil "Pantalla 3 - PDF Brochure Preview"
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";
import {
  PDFDocument,
  rgb,
  StandardFonts,
  pushGraphicsState,
  popGraphicsState,
  moveTo,
  lineTo,
  closePath,
  clip,
  endPath,
} from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";

// ── CONSTANTS ──

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_L = 48;
const MARGIN_R = PAGE_W - 48;
const CONTENT_W = MARGIN_R - MARGIN_L;
const FOOTER_H = 60;

// Brand colors (from Pencil design variables)
const C = {
  primary: rgb(10 / 255, 26 / 255, 68 / 255),       // #0A1A44
  secondary: rgb(242 / 255, 169 / 255, 59 / 255),    // #F2A93B
  accent: rgb(255 / 255, 210 / 255, 117 / 255),      // #FFD275
  textPrimary: rgb(10 / 255, 26 / 255, 68 / 255),    // #0A1A44
  textMuted: rgb(123 / 255, 140 / 255, 163 / 255),   // #7B8CA3
  bgMuted: rgb(243 / 255, 244 / 255, 246 / 255),     // #F3F4F6
  border: rgb(232 / 255, 235 / 255, 240 / 255),      // #E8EBF0
  white: rgb(1, 1, 1),
  white70: rgb(180 / 255, 180 / 255, 180 / 255),
  success: rgb(16 / 255, 185 / 255, 129 / 255),      // #10b981
  destructive: rgb(242 / 255, 55 / 255, 63 / 255),   // #F2373F
  black50: rgb(0, 0, 0),
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
    if (font.widthOfTextAtSize(test, fontSize) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
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

/**
 * Draw an image clipped to a rectangle (CSS object-fit: cover).
 * Uses pdf-lib's graphics state operators for proper clipping.
 */
function drawClippedImage(page, image, x, y, w, h) {
  // Save graphics state & set clip rectangle
  page.pushOperators(
    pushGraphicsState(),
    moveTo(x, y),
    lineTo(x + w, y),
    lineTo(x + w, y + h),
    lineTo(x, y + h),
    closePath(),
    clip(),
    endPath(),
  );

  // Calculate "cover" dimensions (fill cell, overflow clipped)
  const imgAspect = image.width / image.height;
  const cellAspect = w / h;
  let dw, dh;
  if (imgAspect > cellAspect) {
    // Image wider than cell → match height, overflow width
    dh = h;
    dw = h * imgAspect;
  } else {
    // Image taller than cell → match width, overflow height
    dw = w;
    dh = w / imgAspect;
  }
  const ox = x + (w - dw) / 2;
  const oy = y + (h - dh) / 2;

  page.drawImage(image, { x: ox, y: oy, width: dw, height: dh });

  // Restore graphics state (removes clip)
  page.pushOperators(popGraphicsState());
}

function space(doc, page, y, need, fonts) {
  if (y - need < FOOTER_H + 10) {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    drawFooter(p, fonts);
    return { page: p, y: PAGE_H - 40 };
  }
  return { page, y };
}

// ── FOOTER (navy full-width bar — matches Pencil) ──

function drawFooter(page, fonts) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: FOOTER_H, color: C.primary });
  safe(page, "VENEZUELA VOYAGES", { x: MARGIN_L, y: 35, size: 10, font: fonts.bold, color: C.accent });
  safe(page, "Tu viaje comienza aqui", { x: MARGIN_L, y: 20, size: 9, font: fonts.reg, color: C.white70 });
  rightText(page, "info@venezuelavoyages.com", MARGIN_R, 38, 9, fonts.reg, C.white70);
  rightText(page, "+58 426 403 4052", MARGIN_R, 25, 9, fonts.reg, C.white70);
  rightText(page, "www.venezuelavoyages.com", MARGIN_R, 12, 9, fonts.reg, C.accent);
}

// ── BROCHURE SECTIONS ──

/**
 * HERO: Full-bleed image with gradient overlay + large title.
 * Pencil: 400px/800px = 50% of page height. PDF equivalent ~310px.
 */
async function drawHero(doc, page, item, fonts) {
  const heroUrl = item.product_images?.[0] || item.destination_data?.image_url;
  if (!heroUrl) return PAGE_H - 50;

  const bytes = await fetchImg(heroUrl);
  const image = await embedImg(doc, bytes);
  if (!image) return PAGE_H - 50;

  const heroH = 310;
  const heroY = PAGE_H - heroH;

  // Draw image clipped to hero area (full bleed, edge to edge)
  drawClippedImage(page, image, 0, heroY, PAGE_W, heroH);

  // Gradient overlay: transparent top → dark bottom (12 steps)
  for (let i = 0; i < 12; i++) {
    const opacity = (i / 12) * 0.88;
    page.drawRectangle({
      x: 0, y: heroY + (11 - i) * (heroH / 12),
      width: PAGE_W, height: heroH / 12 + 1,
      color: C.black50, opacity,
    });
  }

  // Small brand text top-left
  safe(page, "VENEZUELA", { x: MARGIN_L, y: PAGE_H - 28, size: 7, font: fonts.bold, color: C.accent });
  safe(page, "VOYAGES", { x: MARGIN_L, y: PAGE_H - 38, size: 7, font: fonts.bold, color: C.accent });

  // Large destination name at bottom of hero
  const name = item.destination_data?.name || item.description || "";
  safe(page, name.substring(0, 30), {
    x: MARGIN_L, y: heroY + 52, size: 30, font: fonts.bold, color: C.white,
  });

  // Subtitle
  const sub = item.destination_data?.tags?.[0]
    ? `${item.destination_data.tags[0]}, Venezuela` : "";
  if (sub) {
    safe(page, sub, { x: MARGIN_L, y: heroY + 32, size: 11, font: fonts.reg, color: C.white70 });
  }

  return heroY - 5;
}

/**
 * QUOTE INFO BAR: muted background, quote info left + validity right.
 * Pencil: quoteInfo section with bg-muted, 24px padding.
 */
function drawQuoteBar(page, y, q, fonts) {
  const barH = 50;
  const barY = y - barH;

  page.drawRectangle({ x: 0, y: barY, width: PAGE_W, height: barH, color: C.bgMuted });

  const t1 = barY + 30;
  const t2 = t1 - 16;

  safe(page, `Cotizacion ${q.quotation_number || "N/A"}`, {
    x: MARGIN_L, y: t1, size: 10, font: fonts.bold, color: C.textPrimary,
  });
  const cName = q.lead?.contact_name || q.metadata?.customer_name || "Cliente";
  safe(page, `Preparada para ${cName}`.substring(0, 50), {
    x: MARGIN_L, y: t2, size: 10, font: fonts.reg, color: C.textMuted,
  });

  const vDate = q.valid_until
    ? new Date(q.valid_until).toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" })
    : "N/A";
  rightText(page, `Valida hasta ${vDate}`, MARGIN_R, t1, 10, fonts.reg, C.textMuted);

  const pax = (q.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
  rightText(page, `${pax} pasajero${pax !== 1 ? "s" : ""}`, MARGIN_R, t2, 10, fonts.bold, C.textPrimary);

  return barY - 15;
}

/**
 * DESTINATION INFO: "Sobre el Destino" + description + highlight cards.
 * Pencil: 24px title, 13px desc, 4 highlight cards with muted bg.
 */
function drawDestination(doc, page, y, item, fonts) {
  const dest = item.destination_data;
  if (!dest) return { page, y };

  ({ page, y } = space(doc, page, y, 100, fonts));

  // Title
  safe(page, "Sobre el Destino", { x: MARGIN_L, y, size: 18, font: fonts.bold, color: C.textPrimary });
  y -= 24;

  // Description
  if (dest.description) {
    const lines = wrap(dest.description, fonts.reg, 11, CONTENT_W);
    for (const ln of lines.slice(0, 6)) {
      ({ page, y } = space(doc, page, y, 16, fonts));
      safe(page, ln, { x: MARGIN_L, y, size: 11, font: fonts.reg, color: C.textMuted });
      y -= 17;
    }
  }

  // Highlight cards (max 4, in a row)
  const hl = dest.highlights;
  if (hl?.length > 0) {
    y -= 8;
    ({ page, y } = space(doc, page, y, 50, fonts));

    const items = hl.slice(0, 4);
    const gap = 10;
    const cardW = (CONTENT_W - gap * (items.length - 1)) / items.length;
    const cardH = 40;

    for (let i = 0; i < items.length; i++) {
      const cx = MARGIN_L + i * (cardW + gap);
      page.drawRectangle({ x: cx, y: y - cardH, width: cardW, height: cardH, color: C.bgMuted });

      const txt = sanitize(items[i]);
      const tw = fonts.bold.widthOfTextAtSize(txt, 9);
      safe(page, txt, {
        x: cx + (cardW - tw) / 2, y: y - cardH / 2 - 4,
        size: 9, font: fonts.bold, color: C.textPrimary,
      });
    }
    y -= cardH + 10;
  }

  y -= 10;
  return { page, y };
}

/**
 * GALLERY: 3 images in a row with clipping.
 * Pencil: 3 columns, equal height ~160px, cornerRadius 4, gap 8.
 */
async function drawGallery(doc, page, y, item, fonts) {
  const imgs = item.product_images;
  if (!imgs || imgs.length < 2) return { page, y };

  // Skip first image (hero), take next 3
  const urls = imgs.slice(1, 4);
  if (urls.length < 1) return { page, y };

  const cellH = 120;
  ({ page, y } = space(doc, page, y, cellH + 35, fonts));

  safe(page, "Galeria", { x: MARGIN_L, y, size: 18, font: fonts.bold, color: C.textPrimary });
  y -= 22;

  // Fetch all in parallel
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
  const cellW = (CONTENT_W - gap * (cols - 1)) / cols;

  for (let j = 0; j < loaded.length; j++) {
    const x = MARGIN_L + j * (cellW + gap);
    const cellY = y - cellH;

    // Muted background (visible if image fails or is transparent)
    page.drawRectangle({ x, y: cellY, width: cellW, height: cellH, color: C.bgMuted });

    // Draw image CLIPPED to cell (cover mode)
    drawClippedImage(page, loaded[j], x, cellY, cellW, cellH);
  }

  y -= cellH + 15;
  return { page, y };
}

/**
 * ITINERARY: square day badges, "01"/"02", structured content.
 * Pencil: 48px badges, Day1=navy, Day2+=muted+border, title 14px, desc 12px.
 */
function drawItinerary(doc, page, y, item, fonts) {
  const itin = item.product_details?.itinerary;
  if (!itin?.length) return { page, y };

  ({ page, y } = space(doc, page, y, 70, fonts));
  safe(page, "Itinerario", { x: MARGIN_L, y, size: 18, font: fonts.bold, color: C.textPrimary });
  y -= 28;

  for (let i = 0; i < itin.length; i++) {
    const day = itin[i];
    ({ page, y } = space(doc, page, y, 85, fonts));

    // Square badge
    const bSz = 36;
    const bX = MARGIN_L;
    const bY = y - bSz + 10;

    if (i === 0) {
      page.drawRectangle({ x: bX, y: bY, width: bSz, height: bSz, color: C.primary });
    } else {
      page.drawRectangle({ x: bX, y: bY, width: bSz, height: bSz, color: C.bgMuted, borderColor: C.border, borderWidth: 1 });
    }

    const num = String(i + 1).padStart(2, "0");
    const nw = fonts.bold.widthOfTextAtSize(num, 14);
    safe(page, num, {
      x: bX + (bSz - nw) / 2, y: bY + (bSz - 14) / 2,
      size: 14, font: fonts.bold, color: i === 0 ? C.white : C.textPrimary,
    });

    // Content right of badge
    const cX = MARGIN_L + bSz + 16;
    const cW = CONTENT_W - bSz - 16;

    const title = day.title || day.day || `Dia ${i + 1}`;
    safe(page, title.substring(0, 55), { x: cX, y, size: 12, font: fonts.bold, color: C.textPrimary });
    y -= 16;

    // Activities
    const acts = day.activities || day.description;
    if (acts) {
      const txt = Array.isArray(acts) ? acts.join(" - ") : acts;
      const lines = wrap(txt, fonts.reg, 9.5, cW);
      for (const ln of lines.slice(0, 5)) {
        ({ page, y } = space(doc, page, y, 13, fonts));
        safe(page, ln, { x: cX, y, size: 9.5, font: fonts.reg, color: C.textMuted });
        y -= 13;
      }
    }

    // Meals
    if (day.meals) {
      const meals = Array.isArray(day.meals) ? day.meals : [day.meals];
      ({ page, y } = space(doc, page, y, 13, fonts));
      let mx = cX;
      for (const m of meals.slice(0, 4)) {
        const mt = sanitize(m);
        safe(page, mt, { x: mx, y, size: 9, font: fonts.reg, color: C.textMuted });
        mx += fonts.reg.widthOfTextAtSize(mt, 9) + 16;
      }
      y -= 14;
    }

    // Divider between days
    if (i < itin.length - 1) {
      y -= 4;
      hLine(page, MARGIN_L, MARGIN_R, y, C.border, 0.5);
      y -= 12;
    } else {
      y -= 8;
    }
  }

  return { page, y };
}

/**
 * INCLUDES / EXCLUDES: two columns, full text, check/x markers.
 * Pencil: "QUE INCLUYE" green / "NO INCLUYE" red, 13px text.
 */
function drawInclExcl(doc, page, y, item, fonts) {
  const inc = item.product_details?.includes;
  const exc = item.product_details?.not_includes;
  if (!inc?.length && !exc?.length) return { page, y };

  ({ page, y } = space(doc, page, y, 80, fonts));

  const colW = (CONTENT_W - 30) / 2;
  let lY = y, rY = y;

  // Left: Includes
  if (inc?.length > 0) {
    safe(page, "QUE INCLUYE", { x: MARGIN_L, y: lY, size: 9, font: fonts.bold, color: C.success });
    lY -= 18;

    for (const item of inc.slice(0, 12)) {
      ({ page, lY } = (() => {
        const r = space(doc, page, lY, 16, fonts);
        return { page: r.page, lY: r.y };
      })());

      safe(page, "+", { x: MARGIN_L, y: lY, size: 10, font: fonts.bold, color: C.success });
      const lines = wrap(item, fonts.reg, 10, colW - 18);
      for (const ln of lines.slice(0, 2)) {
        safe(page, ln, { x: MARGIN_L + 16, y: lY, size: 10, font: fonts.reg, color: C.textPrimary });
        lY -= 15;
      }
    }
  }

  // Right: Not Includes
  if (exc?.length > 0) {
    const rX = MARGIN_L + colW + 30;
    safe(page, "NO INCLUYE", { x: rX, y: rY, size: 9, font: fonts.bold, color: C.destructive });
    rY -= 18;

    for (const item of exc.slice(0, 10)) {
      safe(page, "x", { x: rX, y: rY, size: 10, font: fonts.bold, color: C.destructive });
      const lines = wrap(item, fonts.reg, 10, colW - 18);
      for (const ln of lines.slice(0, 2)) {
        safe(page, ln, { x: rX + 16, y: rY, size: 10, font: fonts.reg, color: C.textPrimary });
        rY -= 15;
      }
    }
  }

  y = Math.min(lY, rY) - 12;
  return { page, y };
}

/**
 * PROVIDER INFO
 */
function drawProvider(doc, page, y, item, fonts) {
  const p = item.provider_data;
  if (!p) return { page, y };
  ({ page, y } = space(doc, page, y, 30, fonts));

  safe(page, "OPERADOR", { x: MARGIN_L, y, size: 9, font: fonts.bold, color: C.secondary });
  y -= 18;
  let line = p.name || "";
  if (p.rating) line += `  *  ${p.rating}`;
  safe(page, line.substring(0, 60), { x: MARGIN_L, y, size: 11, font: fonts.reg, color: C.textPrimary });
  y -= 20;
  return { page, y };
}

/**
 * RECOMMENDATIONS
 */
function drawRecs(doc, page, y, item, fonts) {
  const recs = item.product_details?.recommendations;
  if (!recs?.length) return { page, y };
  ({ page, y } = space(doc, page, y, 40, fonts));

  safe(page, "RECOMENDACIONES", { x: MARGIN_L, y, size: 9, font: fonts.bold, color: C.secondary });
  y -= 18;

  for (const rec of recs.slice(0, 8)) {
    ({ page, y } = space(doc, page, y, 14, fonts));
    const lines = wrap(`-  ${rec}`, fonts.reg, 10, CONTENT_W);
    for (const ln of lines.slice(0, 2)) {
      safe(page, ln, { x: MARGIN_L, y, size: 10, font: fonts.reg, color: C.textPrimary });
      y -= 14;
    }
  }
  y -= 8;
  return { page, y };
}

/**
 * PRICE SECTION (brochure mode): clean rows + large total.
 * Pencil: "RESUMEN DE INVERSION", bg-muted, desc left + price right, large TOTAL in orange.
 */
function drawPrice(doc, page, y, q, fonts) {
  const items = q.items || [];
  const neededH = 60 + items.length * 26 + 80;
  ({ page, y } = space(doc, page, y, neededH, fonts));

  // Muted background
  const bgH = neededH + 10;
  page.drawRectangle({ x: 0, y: y - bgH + 20, width: PAGE_W, height: bgH, color: C.bgMuted });

  safe(page, "RESUMEN DE INVERSION", { x: MARGIN_L, y, size: 9, font: fonts.bold, color: C.textMuted });
  y -= 26;

  for (const item of items) {
    ({ page, y } = space(doc, page, y, 24, fonts));
    let desc = sanitize(item.description || "").substring(0, 55);
    const qty = item.quantity || 1;
    if (qty > 1) desc += ` x ${qty}`;
    safe(page, desc, { x: MARGIN_L, y, size: 11, font: fonts.reg, color: C.textPrimary });
    rightText(page, fmt(item.total || 0, q.currency), MARGIN_R, y, 11, fonts.bold, C.textPrimary);
    y -= 26;
  }

  // Extra charges
  if (q.taxes > 0) {
    safe(page, "Impuestos", { x: MARGIN_L, y, size: 11, font: fonts.reg, color: C.textMuted });
    rightText(page, fmt(q.taxes, q.currency), MARGIN_R, y, 11, fonts.bold, C.textMuted);
    y -= 24;
  }
  if (q.fees > 0) {
    safe(page, "Cargos adicionales", { x: MARGIN_L, y, size: 11, font: fonts.reg, color: C.textMuted });
    rightText(page, fmt(q.fees, q.currency), MARGIN_R, y, 11, fonts.bold, C.textMuted);
    y -= 24;
  }
  if (q.discount_amount > 0) {
    safe(page, "Descuento", { x: MARGIN_L, y, size: 11, font: fonts.reg, color: C.success });
    rightText(page, `-${fmt(q.discount_amount, q.currency)}`, MARGIN_R, y, 11, fonts.bold, C.success);
    y -= 24;
  }

  // Divider
  y -= 2;
  hLine(page, MARGIN_L, MARGIN_R, y + 6, C.secondary, 2);
  y -= 10;

  // TOTAL — large
  ({ page, y } = space(doc, page, y, 40, fonts));
  safe(page, "TOTAL", { x: MARGIN_L, y, size: 12, font: fonts.bold, color: C.textPrimary });
  rightText(page, fmt(q.total, q.currency), MARGIN_R, y - 6, 28, fonts.bold, C.secondary);
  y -= 45;

  return { page, y };
}

/**
 * NOTES
 */
function drawNotes(doc, page, y, q, fonts) {
  if (!q.customer_notes) return { page, y };
  ({ page, y } = space(doc, page, y, 40, fonts));

  safe(page, "NOTAS", { x: MARGIN_L, y, size: 9, font: fonts.bold, color: C.textMuted });
  y -= 16;

  const lines = wrap(q.customer_notes.substring(0, 500), fonts.reg, 10, CONTENT_W);
  for (const ln of lines.slice(0, 8)) {
    ({ page, y } = space(doc, page, y, 14, fonts));
    safe(page, ln, { x: MARGIN_L, y, size: 10, font: fonts.reg, color: C.textPrimary });
    y -= 14;
  }
  y -= 8;
  return { page, y };
}

// ── SIMPLE MODE (non-brochure) ──

function drawSimpleFooter(page, fonts) {
  const fy = 35;
  hLine(page, MARGIN_L, MARGIN_R, fy + 15, C.secondary, 1.5);
  safe(page, "Venezuela Voyages", { x: MARGIN_L, y: fy, size: 9, font: fonts.bold, color: C.primary });
  safe(page, "Explore Now", { x: MARGIN_L + 105, y: fy, size: 9, font: fonts.reg, color: C.secondary });
  safe(page, "www.venezuelavoyages.com  |  info@venezuelavoyages.com", {
    x: MARGIN_L, y: fy - 14, size: 8, font: fonts.reg, color: C.textMuted,
  });
}

function drawSimpleHeader(page, q, fonts, logo) {
  let y = PAGE_H - 30;
  const lH = 90, lS = lH / logo.height, lW = logo.width * lS;
  page.drawImage(logo, { x: MARGIN_L, y: y - lH, width: lW, height: lH });

  rightText(page, "COTIZACION", MARGIN_R, y - 25, 9, fonts.reg, C.textMuted);
  rightText(page, q.quotation_number || "N/A", MARGIN_R, y - 48, q.quotation_number?.length > 16 ? 13 : 16, fonts.bold, C.primary);
  rightText(page, (q.status || "borrador").toUpperCase(), MARGIN_R, y - 66, 8, fonts.bold, C.secondary);

  y -= lH + 15;
  hLine(page, MARGIN_L, MARGIN_R, y, C.secondary, 2);

  const iy = y - 25;
  safe(page, "PARA", { x: MARGIN_L, y: iy, size: 8, font: fonts.bold, color: C.textMuted });
  const cn = q.lead?.contact_name || q.metadata?.customer_name || "Cliente";
  const ce = q.lead?.contact_email || q.metadata?.customer_email || "";
  const cp = q.lead?.contact_phone || q.metadata?.customer_phone || "";
  safe(page, cn.substring(0, 35), { x: MARGIN_L, y: iy - 18, size: 11, font: fonts.bold, color: C.textPrimary });
  if (ce) safe(page, ce.substring(0, 40), { x: MARGIN_L, y: iy - 34, size: 9, font: fonts.reg, color: C.textMuted });
  if (cp) safe(page, cp.substring(0, 25), { x: MARGIN_L, y: iy - 48, size: 9, font: fonts.reg, color: C.textMuted });

  const dx = PAGE_W - 210;
  safe(page, "DETALLES", { x: dx, y: iy, size: 8, font: fonts.bold, color: C.textMuted });
  const rows = [
    { l: "Fecha", v: new Date(q.created_at).toLocaleDateString("es-VE") },
    { l: "Valida hasta", v: q.valid_until ? new Date(q.valid_until).toLocaleDateString("es-VE") : "N/A" },
    { l: "Moneda", v: q.currency || "USD" },
  ];
  rows.forEach((r, i) => {
    const ry = iy - 18 - i * 16;
    safe(page, r.l, { x: dx, y: ry, size: 9, font: fonts.reg, color: C.textMuted });
    rightText(page, r.v, MARGIN_R, ry, 9, fonts.bold, C.textPrimary);
  });

  return iy - 80;
}

function drawSimpleTable(doc, page, y, q, fonts) {
  ({ page, y } = space(doc, page, y, 120, fonts));
  hLine(page, MARGIN_L, MARGIN_R, y + 5, C.border, 0.5);

  page.drawRectangle({ x: MARGIN_L, y: y - 8, width: CONTENT_W, height: 22, color: C.primary });
  const cD = MARGIN_L + 10, cQ = MARGIN_L + 290, cU = MARGIN_L + 390, cT = MARGIN_R - 8;

  safe(page, "Descripcion", { x: cD, y: y - 2, size: 8, font: fonts.bold, color: C.white });
  rightText(page, "Cant.", cQ, y - 2, 8, fonts.bold, C.white);
  rightText(page, "P. Unit.", cU, y - 2, 8, fonts.bold, C.white);
  rightText(page, "Total", cT, y - 2, 8, fonts.bold, C.white);
  y -= 22;

  for (let i = 0; i < (q.items || []).length; i++) {
    ({ page, y } = space(doc, page, y, 22, fonts));
    if (i % 2 === 0) page.drawRectangle({ x: MARGIN_L, y: y - 8, width: CONTENT_W, height: 22, color: C.bgMuted });
    const it = q.items[i];
    safe(page, (it.description || "").substring(0, 38), { x: cD, y: y - 1, size: 9, font: fonts.reg, color: C.textPrimary });
    rightText(page, String(it.quantity || 1), cQ, y - 1, 9, fonts.reg, C.textPrimary);
    rightText(page, fmt(it.unit_price || 0, q.currency), cU, y - 1, 9, fonts.reg, C.textPrimary);
    rightText(page, fmt(it.total || 0, q.currency), cT, y - 1, 9, fonts.bold, C.textPrimary);
    y -= 22;
  }

  hLine(page, MARGIN_L, MARGIN_R, y, C.border, 0.5);
  y -= 20;
  hLine(page, PAGE_W / 2, MARGIN_R, y + 8, C.border, 0.5);
  y -= 5;

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

  const logoPath = join(process.cwd(), "public/images/venezuela-voyages-logo.png");
  const logoBytes = readFileSync(logoPath);
  const logo = await doc.embedPng(logoBytes);

  const items = q.items || [];
  const enriched = items.filter(i => i.inventory_id);

  if (enriched.length === 0) {
    // ── SIMPLE MODE ──
    let page = doc.addPage([PAGE_W, PAGE_H]);
    let y = drawSimpleHeader(page, q, fonts, logo);
    drawSimpleFooter(page, fonts);
    ({ page, y } = drawSimpleTable(doc, page, y, q, fonts));
    ({ page, y } = drawNotes(doc, page, y, q, fonts));
  } else {
    // ── BROCHURE MODE ──
    for (const item of enriched) {
      let page = doc.addPage([PAGE_W, PAGE_H]);
      drawFooter(page, fonts);

      // Hero (full bleed from top)
      let y = await drawHero(doc, page, item, fonts);

      // Quote info bar
      y = drawQuoteBar(page, y, q, fonts);

      // Sections
      ({ page, y } = drawDestination(doc, page, y, item, fonts));
      ({ page, y } = await drawGallery(doc, page, y, item, fonts));
      ({ page, y } = drawItinerary(doc, page, y, item, fonts));
      ({ page, y } = drawInclExcl(doc, page, y, item, fonts));
      ({ page, y } = drawProvider(doc, page, y, item, fonts));
      ({ page, y } = drawRecs(doc, page, y, item, fonts));

      // Price — new page if not enough room
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
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="cotizacion-${q.quotation_number}.pdf"`,
        "X-PDF-URL": urlData.publicUrl,
      },
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
