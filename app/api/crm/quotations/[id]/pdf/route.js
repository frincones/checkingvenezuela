/**
 * API para generar y descargar PDF de cotizaciones
 *
 * GET /api/crm/quotations/[id]/pdf - Genera, guarda en Storage y retorna URL
 *
 * Modes:
 * - Simple: classic table PDF for manual items only
 * - Brochure: multi-page visual PDF when enriched items exist
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";

// ── CONSTANTS ──

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_L = 50;
const MARGIN_R = PAGE_W - 50;
const CONTENT_W = MARGIN_R - MARGIN_L;
const FOOTER_ZONE = 70; // reserve bottom for footer

// Brand colors
const COLORS = {
  navy: rgb(10 / 255, 26 / 255, 68 / 255),
  orange: rgb(242 / 255, 169 / 255, 59 / 255),
  gold: rgb(255 / 255, 210 / 255, 117 / 255),
  darkText: rgb(30 / 255, 30 / 255, 30 / 255),
  grayText: rgb(120 / 255, 120 / 255, 120 / 255),
  lightGray: rgb(245 / 255, 245 / 255, 245 / 255),
  borderGray: rgb(220 / 255, 220 / 255, 220 / 255),
  white: rgb(1, 1, 1),
  red: rgb(220 / 255, 50 / 255, 50 / 255),
  green: rgb(34 / 255, 139 / 255, 34 / 255),
  softNavy: rgb(10 / 255, 26 / 255, 68 / 255),
};

// ── UTILITIES ──

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
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - tw, y: yPos, size, font, color });
}

/**
 * Wraps text into lines that fit within maxWidth
 */
function wrapText(text, font, fontSize, maxWidth) {
  if (!text) return [];
  const words = text.split(/\s+/);
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

/**
 * Fetches image bytes from a URL with timeout
 */
async function fetchImageBytes(url, timeoutMs = 5000) {
  if (!url) return null;
  try {
    // Optimize Unsplash images
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

/**
 * Embeds image bytes into PDF doc (tries jpg then png)
 */
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

/**
 * Returns a new page if y is too low, otherwise returns current page
 */
function ensureSpace(pdfDoc, page, y, requiredSpace, fonts) {
  if (y - requiredSpace < FOOTER_ZONE) {
    const newPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawPageFooter(newPage, fonts);
    return { page: newPage, y: PAGE_H - 50 };
  }
  return { page, y };
}

// ── SHARED COMPONENTS ──

function drawPageFooter(page, fonts) {
  const footerY = 35;
  drawLine(page, MARGIN_L, MARGIN_R, footerY + 15, COLORS.orange, 1.5);
  page.drawText("Venezuela Voyages", {
    x: MARGIN_L, y: footerY, size: 9, font: fonts.bold, color: COLORS.navy,
  });
  page.drawText("Explore Now", {
    x: MARGIN_L + 105, y: footerY, size: 9, font: fonts.regular, color: COLORS.orange,
  });
  page.drawText("www.venezuelavoyages.com  |  info@venezuelavoyages.com", {
    x: MARGIN_L, y: footerY - 14, size: 8, font: fonts.regular, color: COLORS.grayText,
  });
}

// ── BROCHURE SECTION RENDERERS ──
// Each returns { page, y } so they can chain and span pages

async function drawHeroSection(pdfDoc, page, y, item, fonts, logoImage) {
  const heroUrl = item.product_images?.[0] || item.destination_data?.image_url;
  if (!heroUrl) return { page, y };

  const imageBytes = await fetchImageBytes(heroUrl);
  const image = await embedImage(pdfDoc, imageBytes);
  if (!image) return { page, y };

  const heroH = 200;
  ({ page, y } = ensureSpace(pdfDoc, page, y, heroH + 20, fonts));

  const imgAspect = image.width / image.height;
  const drawW = CONTENT_W;
  const drawH = Math.min(heroH, drawW / imgAspect);

  // Draw image
  page.drawRectangle({
    x: MARGIN_L, y: y - drawH, width: drawW, height: drawH,
    color: COLORS.lightGray,
  });
  page.drawImage(image, {
    x: MARGIN_L, y: y - drawH, width: drawW, height: drawH,
  });

  // Overlay gradient bar at bottom of image
  page.drawRectangle({
    x: MARGIN_L, y: y - drawH, width: drawW, height: 40,
    color: rgb(0, 0, 0), opacity: 0.5,
  });

  // Destination name overlay
  const destName = item.destination_data?.name || item.description;
  if (destName) {
    page.drawText(destName.substring(0, 50), {
      x: MARGIN_L + 15, y: y - drawH + 14, size: 16, font: fonts.bold, color: COLORS.white,
    });
  }

  y -= drawH + 15;
  return { page, y };
}

function drawDestinationInfo(pdfDoc, page, y, item, fonts) {
  const dest = item.destination_data;
  if (!dest) return { page, y };

  ({ page, y } = ensureSpace(pdfDoc, page, y, 80, fonts));

  // Section title
  page.drawText("SOBRE EL DESTINO", {
    x: MARGIN_L, y, size: 8, font: fonts.bold, color: COLORS.orange,
  });
  y -= 18;

  // Description
  if (dest.description) {
    const lines = wrapText(dest.description, fonts.regular, 9, CONTENT_W);
    for (const line of lines.slice(0, 6)) {
      ({ page, y } = ensureSpace(pdfDoc, page, y, 14, fonts));
      page.drawText(line, {
        x: MARGIN_L, y, size: 9, font: fonts.regular, color: COLORS.darkText,
      });
      y -= 14;
    }
  }

  // Highlights as tags
  if (dest.highlights?.length > 0) {
    y -= 5;
    ({ page, y } = ensureSpace(pdfDoc, page, y, 20, fonts));
    let tagX = MARGIN_L;
    for (const highlight of dest.highlights.slice(0, 6)) {
      const tagText = `  ${highlight}  `;
      const tagW = fonts.regular.widthOfTextAtSize(tagText, 8) + 8;
      if (tagX + tagW > MARGIN_R) {
        tagX = MARGIN_L;
        y -= 18;
        ({ page, y } = ensureSpace(pdfDoc, page, y, 18, fonts));
      }
      page.drawRectangle({
        x: tagX, y: y - 4, width: tagW, height: 16,
        color: COLORS.lightGray, borderColor: COLORS.borderGray, borderWidth: 0.5,
      });
      page.drawText(tagText, {
        x: tagX + 4, y: y, size: 8, font: fonts.regular, color: COLORS.navy,
      });
      tagX += tagW + 6;
    }
    y -= 18;
  }

  y -= 10;
  return { page, y };
}

async function drawPhotoGallery(pdfDoc, page, y, item, fonts) {
  const images = item.product_images;
  if (!images || images.length < 2) return { page, y };

  // Take up to 4 images (skip first if it was used as hero)
  const galleryUrls = images.slice(0, 4);
  if (galleryUrls.length < 2) return { page, y };

  ({ page, y } = ensureSpace(pdfDoc, page, y, 160, fonts));

  page.drawText("GALERÍA", {
    x: MARGIN_L, y, size: 8, font: fonts.bold, color: COLORS.orange,
  });
  y -= 15;

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

  // Grid layout: 2 columns
  const gap = 8;
  const cellW = (CONTENT_W - gap) / 2;
  const cellH = 110;

  for (let i = 0; i < loadedImages.length; i += 2) {
    ({ page, y } = ensureSpace(pdfDoc, page, y, cellH + 10, fonts));

    for (let j = 0; j < 2 && i + j < loadedImages.length; j++) {
      const img = loadedImages[i + j];
      const x = MARGIN_L + j * (cellW + gap);

      // Background
      page.drawRectangle({
        x, y: y - cellH, width: cellW, height: cellH, color: COLORS.lightGray,
      });

      // Scale image to fit cell
      const imgAspect = img.width / img.height;
      let drawW = cellW;
      let drawH = cellW / imgAspect;
      if (drawH > cellH) {
        drawH = cellH;
        drawW = cellH * imgAspect;
      }
      const offsetX = (cellW - drawW) / 2;
      const offsetY = (cellH - drawH) / 2;

      page.drawImage(img, {
        x: x + offsetX, y: y - cellH + offsetY, width: drawW, height: drawH,
      });
    }
    y -= cellH + gap;
  }

  y -= 10;
  return { page, y };
}

function drawItinerary(pdfDoc, page, y, item, fonts) {
  const itinerary = item.product_details?.itinerary;
  if (!itinerary || itinerary.length === 0) return { page, y };

  ({ page, y } = ensureSpace(pdfDoc, page, y, 60, fonts));

  page.drawText("ITINERARIO", {
    x: MARGIN_L, y, size: 8, font: fonts.bold, color: COLORS.orange,
  });
  y -= 20;

  for (let i = 0; i < itinerary.length; i++) {
    const day = itinerary[i];
    ({ page, y } = ensureSpace(pdfDoc, page, y, 50, fonts));

    // Day number circle
    const circleX = MARGIN_L + 12;
    page.drawCircle({
      x: circleX, y: y + 2, size: 10, color: COLORS.navy,
    });
    page.drawText(String(i + 1), {
      x: circleX - (i + 1 >= 10 ? 5 : 3), y: y - 2, size: 8, font: fonts.bold, color: COLORS.white,
    });

    // Day title
    const dayTitle = day.title || day.day || `Día ${i + 1}`;
    page.drawText(dayTitle.substring(0, 60), {
      x: MARGIN_L + 30, y, size: 10, font: fonts.bold, color: COLORS.darkText,
    });
    y -= 14;

    // Activities
    const activities = day.activities || day.description;
    if (activities) {
      const actText = Array.isArray(activities) ? activities.join(", ") : activities;
      const lines = wrapText(actText, fonts.regular, 8, CONTENT_W - 30);
      for (const line of lines.slice(0, 3)) {
        ({ page, y } = ensureSpace(pdfDoc, page, y, 12, fonts));
        page.drawText(line, {
          x: MARGIN_L + 30, y, size: 8, font: fonts.regular, color: COLORS.grayText,
        });
        y -= 12;
      }
    }

    // Meals
    if (day.meals) {
      const mealsText = Array.isArray(day.meals) ? day.meals.join(" · ") : day.meals;
      ({ page, y } = ensureSpace(pdfDoc, page, y, 12, fonts));
      page.drawText(`🍽 ${mealsText}`, {
        x: MARGIN_L + 30, y, size: 7, font: fonts.regular, color: COLORS.grayText,
      });
      y -= 12;
    }

    y -= 8;
  }

  y -= 5;
  return { page, y };
}

function drawIncludesExcludes(pdfDoc, page, y, item, fonts) {
  const includes = item.product_details?.includes;
  const notIncludes = item.product_details?.not_includes;
  if (!includes?.length && !notIncludes?.length) return { page, y };

  ({ page, y } = ensureSpace(pdfDoc, page, y, 60, fonts));

  // Two columns layout
  const colW = (CONTENT_W - 20) / 2;
  const startY = y;
  let leftY = startY;
  let rightY = startY;

  // Left: Includes
  if (includes?.length > 0) {
    page.drawText("INCLUYE", {
      x: MARGIN_L, y: leftY, size: 8, font: fonts.bold, color: COLORS.green,
    });
    leftY -= 16;

    for (const inc of includes.slice(0, 10)) {
      ({ page, leftY } = (() => {
        const result = ensureSpace(pdfDoc, page, leftY, 14, fonts);
        return { page: result.page, leftY: result.y };
      })());
      page.drawText(`✓  ${inc}`.substring(0, 40), {
        x: MARGIN_L, y: leftY, size: 8, font: fonts.regular, color: COLORS.darkText,
      });
      leftY -= 14;
    }
  }

  // Right: Not Includes
  if (notIncludes?.length > 0) {
    const rightX = MARGIN_L + colW + 20;
    page.drawText("NO INCLUYE", {
      x: rightX, y: rightY, size: 8, font: fonts.bold, color: COLORS.red,
    });
    rightY -= 16;

    for (const exc of notIncludes.slice(0, 10)) {
      page.drawText(`✗  ${exc}`.substring(0, 40), {
        x: rightX, y: rightY, size: 8, font: fonts.regular, color: COLORS.grayText,
      });
      rightY -= 14;
    }
  }

  y = Math.min(leftY, rightY) - 15;
  return { page, y };
}

function drawProviderInfo(pdfDoc, page, y, item, fonts) {
  const provider = item.provider_data;
  if (!provider) return { page, y };

  ({ page, y } = ensureSpace(pdfDoc, page, y, 30, fonts));

  page.drawText("OPERADOR", {
    x: MARGIN_L, y, size: 8, font: fonts.bold, color: COLORS.orange,
  });
  y -= 16;

  let provLine = provider.name || "";
  if (provider.rating) provLine += `  ★ ${provider.rating}`;
  page.drawText(provLine.substring(0, 60), {
    x: MARGIN_L, y, size: 9, font: fonts.regular, color: COLORS.darkText,
  });
  y -= 20;

  return { page, y };
}

function drawRecommendations(pdfDoc, page, y, item, fonts) {
  const recs = item.product_details?.recommendations;
  if (!recs?.length) return { page, y };

  ({ page, y } = ensureSpace(pdfDoc, page, y, 40, fonts));

  page.drawText("RECOMENDACIONES", {
    x: MARGIN_L, y, size: 8, font: fonts.bold, color: COLORS.orange,
  });
  y -= 16;

  for (const rec of recs.slice(0, 6)) {
    ({ page, y } = ensureSpace(pdfDoc, page, y, 14, fonts));
    const lines = wrapText(`•  ${rec}`, fonts.regular, 8, CONTENT_W);
    for (const line of lines.slice(0, 2)) {
      page.drawText(line, {
        x: MARGIN_L, y, size: 8, font: fonts.regular, color: COLORS.darkText,
      });
      y -= 12;
    }
  }

  y -= 10;
  return { page, y };
}

// ── PRICE TABLE (shared by both modes) ──

function drawPriceTable(pdfDoc, page, y, quotation, fonts) {
  ({ page, y } = ensureSpace(pdfDoc, page, y, 120, fonts));

  // Separator
  drawLine(page, MARGIN_L, MARGIN_R, y + 5, COLORS.borderGray, 0.5);

  // Table header
  page.drawRectangle({
    x: MARGIN_L, y: y - 8, width: CONTENT_W, height: 22, color: COLORS.navy,
  });

  const colDescX = MARGIN_L + 10;
  const colQtyRight = MARGIN_L + 290;
  const colUnitRight = MARGIN_L + 390;
  const colTotalRight = MARGIN_R - 8;

  page.drawText("Descripción", {
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
    page.drawText(description, {
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
    drawTotalRow("Descuento", `-${formatCurrency(quotation.discount_amount, quotation.currency)}`, COLORS.red);
  }

  // Total highlight bar
  y -= 4;
  const totalBarX = PAGE_W / 2 - 5;
  page.drawRectangle({
    x: totalBarX, y: y - 6, width: MARGIN_R - totalBarX, height: 28, color: COLORS.navy,
  });
  page.drawText("TOTAL", {
    x: totalBarX + 15, y: y + 4, size: 11, font: fonts.bold, color: COLORS.white,
  });
  drawTextRight(page, formatCurrency(quotation.total, quotation.currency), MARGIN_R - 8, y + 4, 11, fonts.bold, COLORS.gold);

  y -= 40;
  return { page, y };
}

// ── HEADER (page 1) ──

function drawHeader(page, quotation, fonts, logoImage) {
  let y = PAGE_H - 30;

  // Logo
  const logoH = 90;
  const logoScale = logoH / logoImage.height;
  const logoW = logoImage.width * logoScale;
  page.drawImage(logoImage, {
    x: MARGIN_L, y: y - logoH, width: logoW, height: logoH,
  });

  // Quotation label
  drawTextRight(page, "COTIZACIÓN", MARGIN_R, y - 25, 9, fonts.regular, COLORS.grayText);
  const quotNum = quotation.quotation_number || "N/A";
  const quotNumSize = quotNum.length > 16 ? 13 : 16;
  drawTextRight(page, quotNum, MARGIN_R, y - 48, quotNumSize, fonts.bold, COLORS.navy);
  const status = (quotation.status || "borrador").toUpperCase();
  drawTextRight(page, status, MARGIN_R, y - 66, 8, fonts.bold, COLORS.orange);

  // Accent line
  y = y - logoH - 15;
  drawLine(page, MARGIN_L, MARGIN_R, y, COLORS.orange, 2);

  // Customer info (left) + Details (right)
  const infoTopY = y - 25;

  page.drawText("PARA", {
    x: MARGIN_L, y: infoTopY, size: 8, font: fonts.bold, color: COLORS.grayText,
  });

  const customerName = quotation.lead?.contact_name || quotation.metadata?.customer_name || "Cliente";
  const customerEmail = quotation.lead?.contact_email || quotation.metadata?.customer_email || "";
  const customerPhone = quotation.lead?.contact_phone || quotation.metadata?.customer_phone || "";

  page.drawText(customerName.substring(0, 35), {
    x: MARGIN_L, y: infoTopY - 18, size: 11, font: fonts.bold, color: COLORS.darkText,
  });
  if (customerEmail) {
    page.drawText(customerEmail.substring(0, 40), {
      x: MARGIN_L, y: infoTopY - 34, size: 9, font: fonts.regular, color: COLORS.grayText,
    });
  }
  if (customerPhone) {
    page.drawText(customerPhone.substring(0, 25), {
      x: MARGIN_L, y: infoTopY - 48, size: 9, font: fonts.regular, color: COLORS.grayText,
    });
  }

  // Right column - Details
  const detailLabelX = PAGE_W - 210;
  page.drawText("DETALLES", {
    x: detailLabelX, y: infoTopY, size: 8, font: fonts.bold, color: COLORS.grayText,
  });

  const detailRows = [
    { label: "Fecha", value: new Date(quotation.created_at).toLocaleDateString("es-VE") },
    { label: "Válida hasta", value: quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString("es-VE") : "N/A" },
    { label: "Moneda", value: quotation.currency || "USD" },
  ];

  detailRows.forEach((row, i) => {
    const rowY = infoTopY - 18 - i * 16;
    page.drawText(row.label, {
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

  page.drawText("NOTAS", {
    x: MARGIN_L, y, size: 8, font: fonts.bold, color: COLORS.grayText,
  });
  y -= 14;

  const noteLines = wrapText(quotation.customer_notes.substring(0, 500), fonts.regular, 9, CONTENT_W);
  for (const line of noteLines.slice(0, 8)) {
    ({ page, y } = ensureSpace(pdfDoc, page, y, 14, fonts));
    page.drawText(line, {
      x: MARGIN_L, y, size: 9, font: fonts.regular, color: COLORS.darkText,
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

  // Load logo
  const logoPath = join(process.cwd(), "public/images/venezuela-voyages-logo.png");
  const logoBytes = readFileSync(logoPath);
  const logoImage = await pdfDoc.embedPng(logoBytes);

  // Detect mode: brochure if any item has inventory_id
  const items = quotation.items || [];
  const enrichedItems = items.filter((i) => i.inventory_id);
  const isBrochure = enrichedItems.length > 0;

  // Page 1: Header
  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = drawHeader(page, quotation, fonts, logoImage);
  drawPageFooter(page, fonts);

  if (!isBrochure) {
    // ── SIMPLE MODE: classic table PDF ──
    ({ page, y } = drawPriceTable(pdfDoc, page, y, quotation, fonts));
    ({ page, y } = drawNotes(pdfDoc, page, y, quotation, fonts));
  } else {
    // ── BROCHURE MODE ──
    // For each enriched item, render visual sections
    for (let i = 0; i < enrichedItems.length; i++) {
      const item = enrichedItems[i];

      // Item title separator
      if (i > 0) {
        // Start a new page for each product after the first
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        drawPageFooter(page, fonts);
        y = PAGE_H - 50;
      }

      // Product name header
      if (i > 0 || y < PAGE_H - 200) {
        ({ page, y } = ensureSpace(pdfDoc, page, y, 30, fonts));
        const typeLabel = item.type ? item.type.toUpperCase() : "";
        if (typeLabel) {
          page.drawText(typeLabel, {
            x: MARGIN_L, y, size: 8, font: fonts.bold, color: COLORS.orange,
          });
          y -= 14;
        }
        page.drawText((item.description || "Producto").substring(0, 60), {
          x: MARGIN_L, y, size: 14, font: fonts.bold, color: COLORS.navy,
        });
        y -= 25;
      }

      // Conditional sections
      ({ page, y } = await drawHeroSection(pdfDoc, page, y, item, fonts, logoImage));
      ({ page, y } = drawDestinationInfo(pdfDoc, page, y, item, fonts));
      ({ page, y } = await drawPhotoGallery(pdfDoc, page, y, item, fonts));
      ({ page, y } = drawItinerary(pdfDoc, page, y, item, fonts));
      ({ page, y } = drawIncludesExcludes(pdfDoc, page, y, item, fonts));
      ({ page, y } = drawProviderInfo(pdfDoc, page, y, item, fonts));
      ({ page, y } = drawRecommendations(pdfDoc, page, y, item, fonts));
    }

    // Price table on new page (or continue if space)
    if (y < 300) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      drawPageFooter(page, fonts);
      y = PAGE_H - 50;

      // Mini header for pricing page
      page.drawText("RESUMEN DE PRECIOS", {
        x: MARGIN_L, y, size: 12, font: fonts.bold, color: COLORS.navy,
      });
      drawLine(page, MARGIN_L, MARGIN_R, y - 8, COLORS.orange, 1.5);
      y -= 30;
    }

    ({ page, y } = drawPriceTable(pdfDoc, page, y, quotation, fonts));
    ({ page, y } = drawNotes(pdfDoc, page, y, quotation, fonts));
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// ── ROUTE HANDLERS ──

/**
 * GET - Genera PDF, lo guarda en Storage y retorna URL
 */
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
        { error: "Cotización no encontrada" },
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

/**
 * POST - Genera el PDF, lo guarda en Storage y retorna la URL (JSON)
 */
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
        { error: "Cotización no encontrada" },
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
