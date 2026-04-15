/**
 * Shared PDF utilities for Venezuela Voyages documents.
 *
 * Extracted from app/api/crm/quotations/[id]/pdf/route.js to be reused by
 * both the quotations generator and the new vouchers generator. Keeping all
 * the generic building blocks (constants, colors, text/image/clipping
 * helpers, footer, policies) in a single module guarantees a consistent
 * visual identity across PDFs.
 *
 * IMPORTANT: Behavior must remain byte-for-byte identical to the original
 * helpers. Any change here affects both the quotations and the vouchers PDFs.
 */

import {
  rgb,
  pushGraphicsState,
  popGraphicsState,
  moveTo,
  lineTo,
  closePath,
  clip,
  endPath,
  appendBezierCurve,
} from "pdf-lib";

// ── CONSTANTS ──

export const PAGE_W = 612;
export const PAGE_H = 792;
export const PAD = 48; // horizontal padding (matches Pencil 48px)
export const MARGIN_L = PAD;
export const MARGIN_R = PAGE_W - PAD;
export const CONTENT_W = MARGIN_R - MARGIN_L; // 516
export const FOOTER_H = 60;

// Brand colors
export const C = {
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

export function sanitize(text) {
  if (!text) return "";
  return String(text)
    .replace(/[\u2713\u2714]/g, "+")
    .replace(/[\u2717\u2718]/g, "-")
    .replace(/[\u2605\u2606]/g, "*")
    .replace(/\u2022/g, "-")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\x00-\xFF]/g, "");
}

export function fmt(amount, currency = "USD") {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

export function safe(page, text, opts) {
  page.drawText(sanitize(text), opts);
}

export function rightText(page, text, rightX, y, size, font, color) {
  const s = sanitize(text);
  page.drawText(s, { x: rightX - font.widthOfTextAtSize(s, size), y, size, font, color });
}

export function centerText(page, text, centerX, y, size, font, color) {
  const s = sanitize(text);
  page.drawText(s, { x: centerX - font.widthOfTextAtSize(s, size) / 2, y, size, font, color });
}

export function hLine(page, x1, x2, y, color, thickness = 0.5) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

export function wrap(text, font, fontSize, maxW) {
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

export async function fetchImg(url, timeoutMs = 8000) {
  if (!url) return null;
  try {
    const u =
      url.includes("unsplash.com") && !url.includes("w=")
        ? `${url}${url.includes("?") ? "&" : "?"}w=800&q=80`
        : url;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(u, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function embedImg(doc, bytes) {
  if (!bytes) return null;
  try {
    return await doc.embedJpg(bytes);
  } catch {
    try {
      return await doc.embedPng(bytes);
    } catch {
      return null;
    }
  }
}

// ── CLIPPING UTILITIES ──

/** Bezier control point factor for approximating quarter-circle arcs */
export const K = 0.5522847498;

/**
 * Push a rounded rectangle clip path.
 * Uses cubic bezier curves at corners for smooth rounding.
 */
export function clipRoundedRect(page, x, y, w, h, r) {
  if (r <= 0) {
    // Simple rectangle clip
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
    closePath(),
    clip(),
    endPath(),
  );
}

export function restoreClip(page) {
  page.pushOperators(popGraphicsState());
}

/**
 * Draw image in "cover" mode, clipped to a rounded rectangle.
 * Optionally draws a subtle shadow behind the image.
 */
export function drawClippedImage(page, image, x, y, w, h, radius = 0, shadow = false) {
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
  if (imgAspect > cellAspect) {
    dh = h;
    dw = h * imgAspect;
  } else {
    dw = w;
    dh = w / imgAspect;
  }

  page.drawImage(image, {
    x: x + (w - dw) / 2,
    y: y + (h - dh) / 2,
    width: dw,
    height: dh,
  });

  restoreClip(page);
}

/**
 * Draw a filled rounded rectangle (no clipping, just visual).
 */
export function drawRoundedRect(page, x, y, w, h, r, color, opacity = 1) {
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
    closePath(),
    clip(),
    endPath(),
  );
  page.drawRectangle({ x, y, width: w, height: h, color, opacity });
  page.pushOperators(popGraphicsState());
}

// ── PAGE MANAGEMENT ──

/**
 * Ensure there is enough vertical space for the next block. If not, adds a
 * new page, draws the footer on it and returns fresh coordinates.
 */
export function ensureSpace(doc, page, y, need, fonts, logoImage) {
  if (y - need < FOOTER_H + 10) {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    drawFooter(p, fonts, logoImage);
    return { page: p, y: PAGE_H - 40 };
  }
  return { page, y };
}

// ── FOOTER (Pencil: primary bg, padding [32, 48]) ──

export function drawFooter(page, fonts, logoImage) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: FOOTER_H, color: C.primary });

  // Logo instead of text
  if (logoImage) {
    const lH = 32;
    const lS = lH / logoImage.height;
    const lW = logoImage.width * lS;
    page.drawImage(logoImage, { x: PAD, y: (FOOTER_H - lH) / 2, width: lW, height: lH });
  } else {
    safe(page, "VENEZUELA VOYAGES", { x: PAD, y: 36, size: 10, font: fonts.bold, color: C.accent });
    safe(page, "Tu viaje comienza aqui", { x: PAD, y: 22, size: 9, font: fonts.reg, color: C.white70 });
  }

  rightText(page, "info@venezuelavoyages.com", MARGIN_R, 38, 9, fonts.reg, C.white70);
  rightText(page, "+58 426 403 4052", MARGIN_R, 26, 9, fonts.reg, C.white70);
  rightText(page, "www.venezuelavoyages.com", MARGIN_R, 14, 9, fonts.reg, C.accent);
}

// ── POLICIES ──

export function drawPolicies(doc, page, y, fonts, logoImage) {
  ({ page, y } = ensureSpace(doc, page, y, 120, fonts, logoImage));

  y -= 8;
  hLine(page, PAD, MARGIN_R, y + 6, C.border, 0.5);
  y -= 16;

  safe(page, "POLITICAS Y CONDICIONES", { x: PAD, y, size: 9, font: fonts.bold, color: C.textMuted });
  y -= 18;

  const policies = [
    { label: "Politica de Devolucion y Reembolso", url: "venezuelavoyages.com/return-policy" },
    { label: "Politicas de Seguridad", url: "venezuelavoyages.com/security-policy" },
    { label: "Terminos y Condiciones", url: "venezuelavoyages.com/terms-of-service" },
    { label: "Politica de Privacidad", url: "venezuelavoyages.com/privacy-policy" },
  ];

  for (const p of policies) {
    ({ page, y } = ensureSpace(doc, page, y, 16, fonts, logoImage));
    safe(page, `-  ${p.label}`, { x: PAD, y, size: 9, font: fonts.reg, color: C.textPrimary });
    rightText(page, p.url, MARGIN_R, y, 8, fonts.reg, C.secondary);
    y -= 16;
  }

  y -= 8;
  return { page, y };
}
