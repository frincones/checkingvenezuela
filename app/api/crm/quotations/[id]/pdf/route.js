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
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";

// ── CONSTANTS ──

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_L = 48;
const MARGIN_R = PAGE_W - 48;
const CONTENT_W = MARGIN_R - MARGIN_L;
const FOOTER_ZONE = 80; // reserve bottom for footer

// Brand colors (from Pencil design variables)
const COLORS = {
  primary: rgb(10 / 255, 26 / 255, 68 / 255),       // #0A1A44 navy
  secondary: rgb(242 / 255, 169 / 255, 59 / 255),    // #F2A93B orange
  accent: rgb(255 / 255, 210 / 255, 117 / 255),      // #FFD275 gold
  textPrimary: rgb(10 / 255, 26 / 255, 68 / 255),    // #0A1A44
  textMuted: rgb(123 / 255, 140 / 255, 163 / 255),   // #7B8CA3
  bgMuted: rgb(243 / 255, 244 / 255, 246 / 255),     // #F3F4F6
  border: rgb(232 / 255, 235 / 255, 240 / 255),      // #E8EBF0
  white: rgb(1, 1, 1),
  success: rgb(16 / 255, 185 / 255, 129 / 255),      // #10b981
  destructive: rgb(242 / 255, 55 / 255, 63 / 255),   // #F2373F
  darkText: rgb(30 / 255, 30 / 255, 30 / 255),
  grayText: rgb(120 / 255, 120 / 255, 120 / 255),
  lightGray: rgb(245 / 255, 245 / 255, 245 / 255),
  borderGray: rgb(220 / 255, 220 / 255, 220 / 255),
  white70: rgb(180 / 255, 180 / 255, 180 / 255),     // approximation of white 70%
};

// ── UTILITIES ──

function sanitize(text) {
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

function formatCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function drawLine(page, x1, x2, y, color, thickness = 0.5) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

function drawTextRight(page, text, rightX, yPos, size, font, color) {
  const safe = sanitize(text);
  const tw = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, { x: rightX - tw, y: yPos, size, font, color });
}

function safeDrawText(page, text, options) {
  page.drawText(sanitize(text), options);
}

function wrapText(text, font, fontSize, maxWidth) {
  if (!text) return [];
  const words = sanitize(text).split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

async function fetchImageBytes(url, timeoutMs = 5000) {
  if (!url) return null;
  try {
    const fetchUrl = url.includes("unsplash.com") && !url.includes("w=")
      ? `${url}${url.includes("?") ? "&" : "?"}w=800&q=80`
      : url;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(fetchUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

async function embedImage(pdfDoc, imageBytes) {
  if (!imageBytes) return null;
  try {
    return await pdfDoc.embedJpg(imageBytes);
  } catch {
    try {
      return await pdfDoc.embedPng(imageBytes);
    } catch {
      return null;
    }
  }
}

function ensureSpace(pdfDoc, page, y, requiredSpace, fonts) {
  if (y - requiredSpace < FOOTER_ZONE) {
    const newPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawBrochureFooter(newPage, fonts);
    return { page: newPage, y: PAGE_H - 50 };
  }
  return { page, y };
}

// ── BROCHURE FOOTER (navy full-width bar) ──

function drawBrochureFooter(page, fonts) {
  const footerH = 60;
  const footerY = 0;

  // Navy background bar
  page.drawRectangle({
    x: 0, y: footerY, width: PAGE_W, height: footerH,
    color: COLORS.primary,
  });

  // Left: Brand name + tagline
  safeDrawText(page, "VENEZUELA VOYAGES", {
    x: MARGIN_L, y: footerY + 35, size: 10, font: fonts.bold, color: COLORS.accent,
  });
  safeDrawText(page, "Tu viaje comienza aqui", {
    x: MARGIN_L, y: footerY + 20, size: 9, font: fonts.regular, color: COLORS.white70,
  });

  // Right: Contact info
  drawTextRight(page, "info@venezuelavoyages.com", MARGIN_R, footerY + 38, 9, fonts.regular, COLORS.white70);
  drawTextRight(page, "+58 426 403 4052", MARGIN_R, footerY + 25, 9, fonts.regular, COLORS.white70);
  drawTextRight(page, "www.venezuelavoyages.com", MARGIN_R, footerY + 12, 9, fonts.regular, COLORS.accent);
}

// Simple mode footer (for non-brochure)
function drawSimpleFooter(page, fonts) {
  const footerY = 35;
  drawLine(page, MARGIN_L, MARGIN_R, footerY + 15, COLORS.secondary, 1.5);
  safeDrawText(page, "Venezuela Voyages", {
    x: MARGIN_L, y: footerY, size: 9, font: fonts.bold, color: COLORS.primary,
  });
  safeDrawText(page, "Explore Now", {
    x: MARGIN_L + 105, y: footerY, size: 9, font: fonts.regular, color: COLORS.secondary,
  });
  safeDrawText(page, "www.venezuelavoyages.com  |  info@venezuelavoyages.com", {
    x: MARGIN_L, y: footerY - 14, size: 8, font: fonts.regular, color: COLORS.textMuted,
  });
}

// ── BROCHURE SECTIONS ──

/**
 * Hero: Full-width image with gradient overlay and large title at bottom
 * Matches Pencil: 400px hero with gradient from transparent to dark, large title
 */
async function drawHeroSection(pdfDoc, page, y, item, fonts) {
  const heroUrl = item.product_images?.[0] || item.destination_data?.image_url;
  if (!heroUrl) return { page, y };

  const imageBytes = await fetchImageBytes(heroUrl, 8000);
  const image = await embedImage(pdfDoc, imageBytes);
  if (!image) return { page, y };

  // Full-width hero, proportionally ~300px for PDF (400px in 800px design = 50%)
  const heroH = 300;
  const heroY = PAGE_H - heroH;

  // Draw image full-bleed (edge to edge)
  const imgAspect = image.width / image.height;
  let drawW = PAGE_W;
  let drawH = PAGE_W / imgAspect;
  if (drawH < heroH) {
    drawH = heroH;
    drawW = heroH * imgAspect;
  }
  const offsetX = (PAGE_W - drawW) / 2;

  page.drawImage(image, {
    x: offsetX, y: heroY, width: drawW, height: drawH,
  });

  // Gradient overlay: dark at bottom, transparent at top (simulated with layered rectangles)
  const gradientSteps = 12;
  const stepH = heroH / gradientSteps;
  for (let i = 0; i < gradientSteps; i++) {
    const opacity = (i / gradientSteps) * 0.85; // from 0 to 0.85 opacity
    page.drawRectangle({
      x: 0, y: heroY + (gradientSteps - 1 - i) * stepH,
      width: PAGE_W, height: stepH + 1,
      color: rgb(0, 0, 0), opacity,
    });
  }

  // Small logo text at top-left (like Pencil heroLogo)
  safeDrawText(page, "VENEZUELA", {
    x: MARGIN_L, y: PAGE_H - 30, size: 8, font: fonts.bold, color: COLORS.accent,
  });
  safeDrawText(page, "VOYAGES", {
    x: MARGIN_L, y: PAGE_H - 40, size: 8, font: fonts.bold, color: COLORS.accent,
  });

  // Large destination name at bottom of hero
  const destName = item.destination_data?.name || item.description || "";
  const destSubtitle = item.destination_data?.name
    ? (item.destination_data?.tags?.[0] ? `${item.destination_data.tags[0]}, Venezuela` : "Venezuela")
    : "";

  // Main title - large
  safeDrawText(page, destName.substring(0, 30), {
    x: MARGIN_L, y: heroY + 55, size: 32, font: fonts.bold, color: COLORS.white,
  });

  // Subtitle
  if (destSubtitle) {
    safeDrawText(page, destSubtitle, {
      x: MARGIN_L, y: heroY + 35, size: 12, font: fonts.regular, color: COLORS.white70,
    });
  }

  return { page, y: heroY - 5 };
}

/**
 * Quote info bar: compact bar with quotation info (replaces traditional header)
 * Matches Pencil: muted background, quote# + client left, validity + passengers right
 */
function drawQuoteInfoBar(page, y, quotation, fonts) {
  const barH = 45;
  const barY = y - barH;

  // Muted background
  page.drawRectangle({
    x: 0, y: barY, width: PAGE_W, height: barH,
    color: COLORS.bgMuted,
  });

  const padX = MARGIN_L;
  const textY1 = barY + barH - 15;
  const textY2 = textY1 - 16;

  // Left: Quotation number + client name
  const quotNum = quotation.quotation_number || "N/A";
  safeDrawText(page, `Cotizacion ${quotNum}`, {
    x: padX, y: textY1, size: 10, font: fonts.bold, color: COLORS.textPrimary,
  });

  const customerName = quotation.lead?.contact_name || quotation.metadata?.customer_name || "Cliente";
  safeDrawText(page, `Preparada para ${customerName}`.substring(0, 50), {
    x: padX, y: textY2, size: 10, font: fonts.regular, color: COLORS.textMuted,
  });

  // Right: Validity + passengers
  const validUntil = quotation.valid_until
    ? new Date(quotation.valid_until).toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" })
    : "N/A";
  drawTextRight(page, `Valida hasta ${validUntil}`, MARGIN_R, textY1, 10, fonts.regular, COLORS.textMuted);

  // Count passengers from items quantity
  const totalPax = (quotation.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
  if (totalPax > 0) {
    drawTextRight(page, `${totalPax} pasajero${totalPax > 1 ? "s" : ""}`, MARGIN_R, textY2, 10, fonts.bold, COLORS.textPrimary);
  }

  return barY - 10;
}

/**
 * Destination info with large title and highlight cards
 * Matches Pencil: "Sobre el Destino" 24px, description 13px, 4 highlight cards with icons
 */
function drawDestinationInfo(pdfDoc, page, y, item, fonts) {
  const dest = item.destination_data;
  if (!dest) return { page, y };

  ({ page, y } = ensureSpace(pdfDoc, page, y, 120, fonts));

  // Section title - large
  safeDrawText(page, "Sobre el Destino", {
    x: MARGIN_L, y, size: 18, font: fonts.bold, color: COLORS.textPrimary,
  });
  y -= 24;

  // Description - larger text with more line height
  if (dest.description) {
    const lines = wrapText(dest.description, fonts.regular, 11, CONTENT_W);
    for (const line of lines.slice(0, 8)) {
      ({ page, y } = ensureSpace(pdfDoc, page, y, 18, fonts));
      safeDrawText(page, line, {
        x: MARGIN_L, y, size: 11, font: fonts.regular, color: COLORS.textMuted,
      });
      y -= 18;
    }
  }

  // Highlight cards (4 in a row, with background)
  if (dest.highlights?.length > 0) {
    y -= 10;
    ({ page, y } = ensureSpace(pdfDoc, page, y, 55, fonts));

    const highlights = dest.highlights.slice(0, 4);
    const cardGap = 12;
    const cardW = (CONTENT_W - cardGap * (highlights.length - 1)) / highlights.length;
    const cardH = 50;

    for (let i = 0; i < highlights.length; i++) {
      const cardX = MARGIN_L + i * (cardW + cardGap);

      // Card background
      page.drawRectangle({
        x: cardX, y: y - cardH, width: cardW, height: cardH,
        color: COLORS.bgMuted,
        borderColor: COLORS.border,
        borderWidth: 0,
      });

      // Rounded corners (simulated with filled rectangle)
      // Highlight text centered
      const hText = sanitize(highlights[i]);
      const textW = fonts.bold.widthOfTextAtSize(hText, 10);
      const textX = cardX + (cardW - textW) / 2;

      safeDrawText(page, hText, {
        x: textX, y: y - cardH + 18, size: 10, font: fonts.bold, color: COLORS.textPrimary,
      });
    }
    y -= cardH + 10;
  }

  y -= 10;
  return { page, y };
}

/**
 * Photo gallery: 3 images in a row
 * Matches Pencil: 3 columns, rounded corners, 160px tall
 */
async function drawPhotoGallery(pdfDoc, page, y, item, fonts) {
  const images = item.product_images;
  if (!images || images.length < 2) return { page, y };

  // Skip first image (used as hero), take next 3
  const galleryUrls = images.slice(1, 4);
  if (galleryUrls.length < 1) return { page, y };

  const galleryH = 120; // PDF proportional to 160px in 800px design
  ({ page, y } = ensureSpace(pdfDoc, page, y, galleryH + 40, fonts));

  // Section title
  safeDrawText(page, "Galeria", {
    x: MARGIN_L, y, size: 18, font: fonts.bold, color: COLORS.textPrimary,
  });
  y -= 20;

  // Fetch images in parallel
  const results = await Promise.allSettled(
    galleryUrls.map((url) => fetchImageBytes(url))
  );
  const loadedImages = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      const img = await embedImage(pdfDoc, result.value);
      if (img) loadedImages.push(img);
    }
  }

  if (loadedImages.length === 0) return { page, y };

  // 3-column grid (or fewer if less images)
  const gap = 8;
  const cols = loadedImages.length;
  const cellW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cellH = galleryH;

  for (let j = 0; j < loadedImages.length; j++) {
    const img = loadedImages[j];
    const x = MARGIN_L + j * (cellW + gap);

    // Background
    page.drawRectangle({
      x, y: y - cellH, width: cellW, height: cellH, color: COLORS.bgMuted,
    });

    // Scale image to fill cell (cover mode)
    const imgAspect = img.width / img.height;
    let drawW = cellW;
    let drawH = cellW / imgAspect;
    if (drawH < cellH) {
      drawH = cellH;
      drawW = cellH * imgAspect;
    }
    const offsetX = (cellW - drawW) / 2;
    const offsetY = (cellH - drawH) / 2;

    page.drawImage(img, {
      x: x + offsetX, y: y - cellH + offsetY, width: drawW, height: drawH,
    });
  }
  y -= cellH + 15;

  return { page, y };
}

/**
 * Itinerary: square day badges, "01"/"02" format, larger text
 * Matches Pencil: 48px square badges, navy Day 1, muted Day 2+, title 14px, desc 12px
 */
function drawItinerary(pdfDoc, page, y, item, fonts) {
  const itinerary = item.product_details?.itinerary;
  if (!itinerary || itinerary.length === 0) return { page, y };

  ({ page, y } = ensureSpace(pdfDoc, page, y, 80, fonts));

  // Section title
  safeDrawText(page, "Itinerario", {
    x: MARGIN_L, y, size: 18, font: fonts.bold, color: COLORS.textPrimary,
  });
  y -= 28;

  for (let i = 0; i < itinerary.length; i++) {
    const day = itinerary[i];
    ({ page, y } = ensureSpace(pdfDoc, page, y, 80, fonts));

    // Square day number badge (36x36 for PDF)
    const badgeSize = 36;
    const badgeX = MARGIN_L;
    const badgeY = y - badgeSize + 10;

    // Day 1: navy fill, Day 2+: muted fill with border
    if (i === 0) {
      page.drawRectangle({
        x: badgeX, y: badgeY, width: badgeSize, height: badgeSize,
        color: COLORS.primary,
      });
    } else {
      page.drawRectangle({
        x: badgeX, y: badgeY, width: badgeSize, height: badgeSize,
        color: COLORS.bgMuted,
        borderColor: COLORS.border, borderWidth: 1,
      });
    }

    // Day number centered in badge ("01", "02")
    const dayNum = String(i + 1).padStart(2, "0");
    const numW = fonts.bold.widthOfTextAtSize(dayNum, 14);
    safeDrawText(page, dayNum, {
      x: badgeX + (badgeSize - numW) / 2,
      y: badgeY + (badgeSize - 14) / 2,
      size: 14, font: fonts.bold,
      color: i === 0 ? COLORS.white : COLORS.textPrimary,
    });

    // Content area to the right of badge
    const contentX = MARGIN_L + badgeSize + 16;
    const contentW = CONTENT_W - badgeSize - 16;

    // Day title
    const dayTitle = day.title || day.day || `Dia ${i + 1}`;
    safeDrawText(page, dayTitle.substring(0, 60), {
      x: contentX, y, size: 12, font: fonts.bold, color: COLORS.textPrimary,
    });
    y -= 16;

    // Activities description
    const activities = day.activities || day.description;
    if (activities) {
      const actText = Array.isArray(activities) ? activities.join(" - ") : activities;
      const lines = wrapText(actText, fonts.regular, 10, contentW);
      for (const line of lines.slice(0, 4)) {
        ({ page, y } = ensureSpace(pdfDoc, page, y, 14, fonts));
        safeDrawText(page, line, {
          x: contentX, y, size: 10, font: fonts.regular, color: COLORS.textMuted,
        });
        y -= 14;
      }
    }

    // Meals with icon-like prefix
    if (day.meals) {
      const mealsArr = Array.isArray(day.meals) ? day.meals : [day.meals];
      ({ page, y } = ensureSpace(pdfDoc, page, y, 14, fonts));
      let mealX = contentX;
      for (const meal of mealsArr.slice(0, 4)) {
        const mealText = sanitize(meal);
        const mealW = fonts.regular.widthOfTextAtSize(mealText, 9);
        // Dot separator before text
        safeDrawText(page, mealText, {
          x: mealX, y, size: 9, font: fonts.regular, color: COLORS.textMuted,
        });
        mealX += mealW + 16;
      }
      y -= 14;
    }

    // Divider between days (not after last)
    if (i < itinerary.length - 1) {
      y -= 6;
      drawLine(page, MARGIN_L, MARGIN_R, y, COLORS.border, 0.5);
      y -= 14;
    } else {
      y -= 10;
    }
  }

  y -= 5;
  return { page, y };
}

/**
 * Includes/Excludes: full text, proper markers
 * Matches Pencil: "QUE INCLUYE" green / "NO INCLUYE" red, check/X markers, 13px text, no truncation
 */
function drawIncludesExcludes(pdfDoc, page, y, item, fonts) {
  const includes = item.product_details?.includes;
  const notIncludes = item.product_details?.not_includes;
  if (!includes?.length && !notIncludes?.length) return { page, y };

  ({ page, y } = ensureSpace(pdfDoc, page, y, 80, fonts));

  // Two columns layout
  const colW = (CONTENT_W - 30) / 2;
  const startY = y;
  let leftY = startY;
  let rightY = startY;

  // Left: Includes
  if (includes?.length > 0) {
    safeDrawText(page, "QUE INCLUYE", {
      x: MARGIN_L, y: leftY, size: 9, font: fonts.bold, color: COLORS.success,
    });
    leftY -= 18;

    for (const inc of includes.slice(0, 10)) {
      ({ page, leftY } = (() => {
        const result = ensureSpace(pdfDoc, page, leftY, 16, fonts);
        return { page: result.page, leftY: result.y };
      })());

      // Green check marker
      safeDrawText(page, "+", {
        x: MARGIN_L, y: leftY, size: 11, font: fonts.bold, color: COLORS.success,
      });
      // Full text, wrapped if needed
      const incLines = wrapText(inc, fonts.regular, 10, colW - 20);
      for (const line of incLines.slice(0, 2)) {
        safeDrawText(page, line, {
          x: MARGIN_L + 16, y: leftY, size: 10, font: fonts.regular, color: COLORS.textPrimary,
        });
        leftY -= 15;
      }
    }
  }

  // Right: Not Includes
  if (notIncludes?.length > 0) {
    const rightX = MARGIN_L + colW + 30;
    safeDrawText(page, "NO INCLUYE", {
      x: rightX, y: rightY, size: 9, font: fonts.bold, color: COLORS.destructive,
    });
    rightY -= 18;

    for (const exc of notIncludes.slice(0, 10)) {
      // Red X marker
      safeDrawText(page, "x", {
        x: rightX, y: rightY, size: 11, font: fonts.bold, color: COLORS.destructive,
      });
      // Full text, wrapped if needed
      const excLines = wrapText(exc, fonts.regular, 10, colW - 20);
      for (const line of excLines.slice(0, 2)) {
        safeDrawText(page, line, {
          x: rightX + 16, y: rightY, size: 10, font: fonts.regular, color: COLORS.textPrimary,
        });
        rightY -= 15;
      }
    }
  }

  y = Math.min(leftY, rightY) - 15;
  return { page, y };
}

/**
 * Provider info
 */
function drawProviderInfo(pdfDoc, page, y, item, fonts) {
  const provider = item.provider_data;
  if (!provider) return { page, y };

  ({ page, y } = ensureSpace(pdfDoc, page, y, 30, fonts));

  safeDrawText(page, "OPERADOR", {
    x: MARGIN_L, y, size: 9, font: fonts.bold, color: COLORS.secondary,
  });
  y -= 18;

  let provLine = provider.name || "";
  if (provider.rating) provLine += `  *  ${provider.rating}`;
  safeDrawText(page, provLine.substring(0, 60), {
    x: MARGIN_L, y, size: 11, font: fonts.regular, color: COLORS.textPrimary,
  });
  y -= 20;

  return { page, y };
}

/**
 * Recommendations
 */
function drawRecommendations(pdfDoc, page, y, item, fonts) {
  const recs = item.product_details?.recommendations;
  if (!recs?.length) return { page, y };

  ({ page, y } = ensureSpace(pdfDoc, page, y, 40, fonts));

  safeDrawText(page, "RECOMENDACIONES", {
    x: MARGIN_L, y, size: 9, font: fonts.bold, color: COLORS.secondary,
  });
  y -= 18;

  for (const rec of recs.slice(0, 6)) {
    ({ page, y } = ensureSpace(pdfDoc, page, y, 16, fonts));
    const lines = wrapText(`-  ${rec}`, fonts.regular, 10, CONTENT_W);
    for (const line of lines.slice(0, 2)) {
      safeDrawText(page, line, {
        x: MARGIN_L, y, size: 10, font: fonts.regular, color: COLORS.textPrimary,
      });
      y -= 14;
    }
  }

  y -= 10;
  return { page, y };
}

// ── PRICE SECTION (modern clean layout) ──

/**
 * Price section: clean rows with large total
 * Matches Pencil: "RESUMEN DE INVERSION" title, description + price rows, divider, large TOTAL in orange
 */
function drawPriceSection(pdfDoc, page, y, quotation, fonts) {
  ({ page, y } = ensureSpace(pdfDoc, page, y, 160, fonts));

  // Muted background for entire price section
  const sectionH = 40 + (quotation.items || []).length * 24 + 70;
  const sectionY = y - sectionH + 20;

  page.drawRectangle({
    x: 0, y: sectionY, width: PAGE_W, height: sectionH,
    color: COLORS.bgMuted,
  });

  // Section title
  safeDrawText(page, "RESUMEN DE INVERSION", {
    x: MARGIN_L, y, size: 9, font: fonts.bold, color: COLORS.textMuted,
  });
  y -= 24;

  // Item rows
  const items = quotation.items || [];
  for (const item of items) {
    ({ page, y } = ensureSpace(pdfDoc, page, y, 24, fonts));

    const desc = sanitize(item.description || "").substring(0, 55);
    const qty = item.quantity || 1;
    const total = item.total || 0;

    // Description on left
    let rowDesc = desc;
    if (qty > 1) rowDesc += ` x ${qty}`;

    safeDrawText(page, rowDesc, {
      x: MARGIN_L, y, size: 11, font: fonts.regular, color: COLORS.textPrimary,
    });

    // Price on right
    drawTextRight(page, formatCurrency(total, quotation.currency), MARGIN_R, y, 11, fonts.bold, COLORS.textPrimary);
    y -= 24;
  }

  // Additional charges
  if (quotation.taxes > 0) {
    safeDrawText(page, "Impuestos", {
      x: MARGIN_L, y, size: 11, font: fonts.regular, color: COLORS.textMuted,
    });
    drawTextRight(page, formatCurrency(quotation.taxes, quotation.currency), MARGIN_R, y, 11, fonts.bold, COLORS.textMuted);
    y -= 24;
  }
  if (quotation.fees > 0) {
    safeDrawText(page, "Cargos adicionales", {
      x: MARGIN_L, y, size: 11, font: fonts.regular, color: COLORS.textMuted,
    });
    drawTextRight(page, formatCurrency(quotation.fees, quotation.currency), MARGIN_R, y, 11, fonts.bold, COLORS.textMuted);
    y -= 24;
  }
  if (quotation.discount_amount > 0) {
    safeDrawText(page, "Descuento", {
      x: MARGIN_L, y, size: 11, font: fonts.regular, color: COLORS.success,
    });
    drawTextRight(page, `-${formatCurrency(quotation.discount_amount, quotation.currency)}`, MARGIN_R, y, 11, fonts.bold, COLORS.success);
    y -= 24;
  }

  // Divider
  y -= 4;
  drawLine(page, MARGIN_L, MARGIN_R, y + 8, COLORS.secondary, 2);
  y -= 8;

  // TOTAL row - large
  ({ page, y } = ensureSpace(pdfDoc, page, y, 40, fonts));

  safeDrawText(page, "TOTAL", {
    x: MARGIN_L, y, size: 12, font: fonts.bold, color: COLORS.textPrimary,
  });

  // Large total amount in orange/secondary
  const totalStr = formatCurrency(quotation.total, quotation.currency);
  drawTextRight(page, totalStr, MARGIN_R, y - 4, 26, fonts.bold, COLORS.secondary);

  y -= 40;
  return { page, y };
}

// ── SIMPLE MODE: Price table (traditional table for non-brochure) ──

function drawSimplePriceTable(pdfDoc, page, y, quotation, fonts) {
  ({ page, y } = ensureSpace(pdfDoc, page, y, 120, fonts));

  drawLine(page, MARGIN_L, MARGIN_R, y + 5, COLORS.borderGray, 0.5);

  // Table header
  page.drawRectangle({
    x: MARGIN_L, y: y - 8, width: CONTENT_W, height: 22, color: COLORS.primary,
  });

  const colDescX = MARGIN_L + 10;
  const colQtyRight = MARGIN_L + 290;
  const colUnitRight = MARGIN_L + 390;
  const colTotalRight = MARGIN_R - 8;

  safeDrawText(page, "Descripcion", {
    x: colDescX, y: y - 2, size: 8, font: fonts.bold, color: COLORS.white,
  });
  drawTextRight(page, "Cant.", colQtyRight, y - 2, 8, fonts.bold, COLORS.white);
  drawTextRight(page, "P. Unit.", colUnitRight, y - 2, 8, fonts.bold, COLORS.white);
  drawTextRight(page, "Total", colTotalRight, y - 2, 8, fonts.bold, COLORS.white);

  y -= 22;

  const items = quotation.items || [];
  for (let i = 0; i < items.length; i++) {
    ({ page, y } = ensureSpace(pdfDoc, page, y, 22, fonts));

    if (i % 2 === 0) {
      page.drawRectangle({
        x: MARGIN_L, y: y - 8, width: CONTENT_W, height: 22, color: COLORS.lightGray,
      });
    }

    const item = items[i];
    const description = (item.description || "").substring(0, 38);
    safeDrawText(page, description, {
      x: colDescX, y: y - 1, size: 9, font: fonts.regular, color: COLORS.darkText,
    });
    drawTextRight(page, String(item.quantity || 1), colQtyRight, y - 1, 9, fonts.regular, COLORS.darkText);
    drawTextRight(page, formatCurrency(item.unit_price || 0, quotation.currency), colUnitRight, y - 1, 9, fonts.regular, COLORS.darkText);
    drawTextRight(page, formatCurrency(item.total || 0, quotation.currency), colTotalRight, y - 1, 9, fonts.bold, COLORS.darkText);
    y -= 22;
  }

  drawLine(page, MARGIN_L, MARGIN_R, y, COLORS.borderGray, 0.5);

  // Totals
  y -= 20;
  drawLine(page, PAGE_W / 2, MARGIN_R, y + 8, COLORS.borderGray, 0.5);
  y -= 5;

  const drawTotalRow = (label, value, color = COLORS.grayText) => {
    drawTextRight(page, label, PAGE_W / 2 + 55, y, 9, fonts.regular, color);
    drawTextRight(page, value, MARGIN_R, y, 9, fonts.regular, color);
    y -= 18;
  };

  drawTotalRow("Subtotal", formatCurrency(quotation.subtotal, quotation.currency));
  if (quotation.taxes > 0) drawTotalRow("Impuestos", formatCurrency(quotation.taxes, quotation.currency));
  if (quotation.fees > 0) drawTotalRow("Cargos", formatCurrency(quotation.fees, quotation.currency));
  if (quotation.discount_amount > 0) {
    drawTotalRow("Descuento", `-${formatCurrency(quotation.discount_amount, quotation.currency)}`, COLORS.destructive);
  }

  // Total highlight bar
  y -= 4;
  const totalBarX = PAGE_W / 2 - 5;
  page.drawRectangle({
    x: totalBarX, y: y - 6, width: MARGIN_R - totalBarX, height: 28, color: COLORS.primary,
  });
  safeDrawText(page, "TOTAL", {
    x: totalBarX + 15, y: y + 4, size: 11, font: fonts.bold, color: COLORS.white,
  });
  drawTextRight(page, formatCurrency(quotation.total, quotation.currency), MARGIN_R - 8, y + 4, 11, fonts.bold, COLORS.accent);

  y -= 40;
  return { page, y };
}

// ── SIMPLE MODE HEADER ──

function drawSimpleHeader(page, quotation, fonts, logoImage) {
  let y = PAGE_H - 30;

  const logoH = 90;
  const logoScale = logoH / logoImage.height;
  const logoW = logoImage.width * logoScale;
  page.drawImage(logoImage, {
    x: MARGIN_L, y: y - logoH, width: logoW, height: logoH,
  });

  drawTextRight(page, "COTIZACION", MARGIN_R, y - 25, 9, fonts.regular, COLORS.grayText);
  const quotNum = quotation.quotation_number || "N/A";
  const quotNumSize = quotNum.length > 16 ? 13 : 16;
  drawTextRight(page, quotNum, MARGIN_R, y - 48, quotNumSize, fonts.bold, COLORS.primary);
  const status = (quotation.status || "borrador").toUpperCase();
  drawTextRight(page, status, MARGIN_R, y - 66, 8, fonts.bold, COLORS.secondary);

  y = y - logoH - 15;
  drawLine(page, MARGIN_L, MARGIN_R, y, COLORS.secondary, 2);

  const infoTopY = y - 25;

  safeDrawText(page, "PARA", {
    x: MARGIN_L, y: infoTopY, size: 8, font: fonts.bold, color: COLORS.grayText,
  });

  const customerName = quotation.lead?.contact_name || quotation.metadata?.customer_name || "Cliente";
  const customerEmail = quotation.lead?.contact_email || quotation.metadata?.customer_email || "";
  const customerPhone = quotation.lead?.contact_phone || quotation.metadata?.customer_phone || "";

  safeDrawText(page, customerName.substring(0, 35), {
    x: MARGIN_L, y: infoTopY - 18, size: 11, font: fonts.bold, color: COLORS.darkText,
  });
  if (customerEmail) {
    safeDrawText(page, customerEmail.substring(0, 40), {
      x: MARGIN_L, y: infoTopY - 34, size: 9, font: fonts.regular, color: COLORS.grayText,
    });
  }
  if (customerPhone) {
    safeDrawText(page, customerPhone.substring(0, 25), {
      x: MARGIN_L, y: infoTopY - 48, size: 9, font: fonts.regular, color: COLORS.grayText,
    });
  }

  const detailLabelX = PAGE_W - 210;
  safeDrawText(page, "DETALLES", {
    x: detailLabelX, y: infoTopY, size: 8, font: fonts.bold, color: COLORS.grayText,
  });

  const detailRows = [
    { label: "Fecha", value: new Date(quotation.created_at).toLocaleDateString("es-VE") },
    { label: "Valida hasta", value: quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString("es-VE") : "N/A" },
    { label: "Moneda", value: quotation.currency || "USD" },
  ];

  detailRows.forEach((row, i) => {
    const rowY = infoTopY - 18 - i * 16;
    safeDrawText(page, row.label, {
      x: detailLabelX, y: rowY, size: 9, font: fonts.regular, color: COLORS.grayText,
    });
    drawTextRight(page, row.value, MARGIN_R, rowY, 9, fonts.bold, COLORS.darkText);
  });

  return infoTopY - 80;
}

// ── NOTES SECTION ──

function drawNotes(pdfDoc, page, y, quotation, fonts) {
  if (!quotation.customer_notes) return { page, y };

  ({ page, y } = ensureSpace(pdfDoc, page, y, 40, fonts));

  safeDrawText(page, "NOTAS", {
    x: MARGIN_L, y, size: 9, font: fonts.bold, color: COLORS.textMuted,
  });
  y -= 16;

  const noteLines = wrapText(quotation.customer_notes.substring(0, 500), fonts.regular, 10, CONTENT_W);
  for (const line of noteLines.slice(0, 8)) {
    ({ page, y } = ensureSpace(pdfDoc, page, y, 14, fonts));
    safeDrawText(page, line, {
      x: MARGIN_L, y, size: 10, font: fonts.regular, color: COLORS.textPrimary,
    });
    y -= 14;
  }

  y -= 10;
  return { page, y };
}

// ── MAIN GENERATOR ──

async function generateQuotationPDF(quotation) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };

  // Load logo (for simple mode)
  const logoPath = join(process.cwd(), "public/images/venezuela-voyages-logo.png");
  const logoBytes = readFileSync(logoPath);
  const logoImage = await pdfDoc.embedPng(logoBytes);

  // Detect mode: brochure if any item has inventory_id
  const items = quotation.items || [];
  const enrichedItems = items.filter((i) => i.inventory_id);
  const isBrochure = enrichedItems.length > 0;

  if (!isBrochure) {
    // ── SIMPLE MODE: classic table PDF ──
    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = drawSimpleHeader(page, quotation, fonts, logoImage);
    drawSimpleFooter(page, fonts);
    ({ page, y } = drawSimplePriceTable(pdfDoc, page, y, quotation, fonts));
    ({ page, y } = drawNotes(pdfDoc, page, y, quotation, fonts));
  } else {
    // ── BROCHURE MODE ──
    for (let i = 0; i < enrichedItems.length; i++) {
      const item = enrichedItems[i];

      // Page 1: Hero full-bleed
      let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      drawBrochureFooter(page, fonts);

      let y = PAGE_H;

      // Hero section (full-bleed from top)
      ({ page, y } = await drawHeroSection(pdfDoc, page, y, item, fonts));

      // Quote info bar
      y = drawQuoteInfoBar(page, y, quotation, fonts);

      // Destination info
      ({ page, y } = drawDestinationInfo(pdfDoc, page, y, item, fonts));

      // Photo gallery
      ({ page, y } = await drawPhotoGallery(pdfDoc, page, y, item, fonts));

      // Itinerary
      ({ page, y } = drawItinerary(pdfDoc, page, y, item, fonts));

      // Includes/Excludes
      ({ page, y } = drawIncludesExcludes(pdfDoc, page, y, item, fonts));

      // Provider info
      ({ page, y } = drawProviderInfo(pdfDoc, page, y, item, fonts));

      // Recommendations
      ({ page, y } = drawRecommendations(pdfDoc, page, y, item, fonts));

      // Price section (new page if not enough space)
      if (y < 250) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        drawBrochureFooter(page, fonts);
        y = PAGE_H - 50;
      }

      ({ page, y } = drawPriceSection(pdfDoc, page, y, quotation, fonts));
      ({ page, y } = drawNotes(pdfDoc, page, y, quotation, fonts));
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// ── ROUTE HANDLERS ──

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: quotation, error } = await adminClient
      .from("quotations")
      .select(
        `
        *,
        lead:leads(
          id,
          contact_name,
          contact_email,
          contact_phone,
          interest_type
        )
      `
      )
      .eq("id", id)
      .single();

    if (error || !quotation) {
      return NextResponse.json(
        { error: "Cotizacion no encontrada" },
        { status: 404 }
      );
    }

    const pdfBuffer = await generateQuotationPDF(quotation);
    const fileName = `quotations/${quotation.quotation_number}.pdf`;

    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from("documents")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="cotizacion-${quotation.quotation_number}.pdf"`,
        },
      });
    }

    const { data: urlData } = adminClient.storage
      .from("documents")
      .getPublicUrl(fileName);

    await adminClient
      .from("quotations")
      .update({
        pdf_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="cotizacion-${quotation.quotation_number}.pdf"`,
        "X-PDF-URL": urlData.publicUrl,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Error al generar el PDF: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: quotation, error } = await adminClient
      .from("quotations")
      .select(
        `
        *,
        lead:leads(
          id,
          contact_name,
          contact_email,
          contact_phone,
          interest_type
        )
      `
      )
      .eq("id", id)
      .single();

    if (error || !quotation) {
      return NextResponse.json(
        { error: "Cotizacion no encontrada" },
        { status: 404 }
      );
    }

    const pdfBuffer = await generateQuotationPDF(quotation);
    const fileName = `quotations/${quotation.quotation_number}.pdf`;

    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from("documents")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      return NextResponse.json(
        { error: "Error al subir el PDF: " + uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = adminClient.storage
      .from("documents")
      .getPublicUrl(fileName);

    await adminClient
      .from("quotations")
      .update({
        pdf_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      pdf_url: urlData.publicUrl,
      file_path: uploadData.path,
    });
  } catch (error) {
    console.error("Error generating and saving PDF:", error);
    return NextResponse.json(
      { error: "Error al generar y guardar el PDF: " + error.message },
      { status: 500 }
    );
  }
}
