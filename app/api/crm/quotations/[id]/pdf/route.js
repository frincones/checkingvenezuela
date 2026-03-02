/**
 * API para generar y descargar PDF de cotizaciones
 *
 * GET /api/crm/quotations/[id]/pdf - Genera, guarda en Storage y retorna URL
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Formatea moneda
 */
function formatCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

/**
 * Helper: draws a thin horizontal line
 */
function drawLine(page, x1, x2, y, color, thickness = 0.5) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness,
    color,
  });
}

/**
 * Genera el PDF de una cotización usando pdf-lib
 * Diseño: moderno, minimalista, limpio
 */
async function generateQuotationPDF(quotation) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Helper: draw text right-aligned to a given X edge
  const drawTextRight = (text, rightX, yPos, size, font, color) => {
    const tw = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: rightX - tw, y: yPos, size, font, color });
  };

  // Brand colors
  const navy = rgb(10 / 255, 26 / 255, 68 / 255);
  const orange = rgb(242 / 255, 169 / 255, 59 / 255);
  const gold = rgb(255 / 255, 210 / 255, 117 / 255);
  const darkText = rgb(30 / 255, 30 / 255, 30 / 255);
  const grayText = rgb(120 / 255, 120 / 255, 120 / 255);
  const lightGray = rgb(245 / 255, 245 / 255, 245 / 255);
  const borderGray = rgb(220 / 255, 220 / 255, 220 / 255);
  const white = rgb(1, 1, 1);
  const red = rgb(220 / 255, 50 / 255, 50 / 255);

  const marginL = 50;
  const marginR = width - 50;
  const contentWidth = marginR - marginL;

  // ── LOGO ──
  const logoPath = join(process.cwd(), "public/images/venezuela-voyages-logo.png");
  const logoBytes = readFileSync(logoPath);
  const logoImage = await pdfDoc.embedPng(logoBytes);

  const logoH = 90;
  const logoScale = logoH / logoImage.height;
  const logoW = logoImage.width * logoScale;

  let y = height - 30;
  page.drawImage(logoImage, {
    x: marginL,
    y: y - logoH,
    width: logoW,
    height: logoH,
  });

  // ── QUOTATION LABEL (right-aligned to marginR) ──
  drawTextRight("COTIZACION", marginR, y - 25, 9, helvetica, grayText);

  const quotNum = quotation.quotation_number || "N/A";
  // Dynamic font size: shrink if number is long
  const quotNumSize = quotNum.length > 16 ? 13 : 16;
  drawTextRight(quotNum, marginR, y - 48, quotNumSize, helveticaBold, navy);

  // Status badge
  const status = (quotation.status || "borrador").toUpperCase();
  drawTextRight(status, marginR, y - 66, 8, helveticaBold, orange);

  // ── ACCENT LINE under header ──
  y = y - logoH - 15;
  drawLine(page, marginL, marginR, y, orange, 2);

  // ── INFO SECTION: two columns at fixed Y positions ──
  const infoTopY = y - 25;

  // Left column - Customer
  page.drawText("PARA", {
    x: marginL,
    y: infoTopY,
    size: 8,
    font: helveticaBold,
    color: grayText,
  });

  const customerName =
    quotation.lead?.contact_name ||
    quotation.metadata?.customer_name ||
    "Cliente";
  const customerEmail =
    quotation.lead?.contact_email ||
    quotation.metadata?.customer_email ||
    "";
  const customerPhone =
    quotation.lead?.contact_phone ||
    quotation.metadata?.customer_phone ||
    "";

  page.drawText(customerName.substring(0, 35), {
    x: marginL,
    y: infoTopY - 18,
    size: 11,
    font: helveticaBold,
    color: darkText,
  });

  if (customerEmail) {
    page.drawText(customerEmail.substring(0, 40), {
      x: marginL,
      y: infoTopY - 34,
      size: 9,
      font: helvetica,
      color: grayText,
    });
  }

  if (customerPhone) {
    page.drawText(customerPhone.substring(0, 25), {
      x: marginL,
      y: infoTopY - 48,
      size: 9,
      font: helvetica,
      color: grayText,
    });
  }

  // Right column - Details (fixed positions, right-aligned values)
  const detailLabelX = width - 210;
  const detailValueRight = marginR;

  page.drawText("DETALLES", {
    x: detailLabelX,
    y: infoTopY,
    size: 8,
    font: helveticaBold,
    color: grayText,
  });

  const detailRows = [
    { label: "Fecha", value: new Date(quotation.created_at).toLocaleDateString("es-VE") },
    {
      label: "Valida hasta",
      value: quotation.valid_until
        ? new Date(quotation.valid_until).toLocaleDateString("es-VE")
        : "N/A",
    },
    { label: "Moneda", value: quotation.currency || "USD" },
  ];

  detailRows.forEach((row, i) => {
    const rowY = infoTopY - 18 - i * 16;
    page.drawText(row.label, {
      x: detailLabelX,
      y: rowY,
      size: 9,
      font: helvetica,
      color: grayText,
    });
    drawTextRight(row.value, detailValueRight, rowY, 9, helveticaBold, darkText);
  });

  // ── ITEMS TABLE ──
  y = infoTopY - 80;
  drawLine(page, marginL, marginR, y + 5, borderGray, 0.5);

  // Table header
  page.drawRectangle({
    x: marginL,
    y: y - 8,
    width: contentWidth,
    height: 22,
    color: navy,
  });

  // Column right edges for right-aligned numbers
  const colDescX = marginL + 10;
  const colQtyRight = marginL + 290;
  const colUnitRight = marginL + 390;
  const colTotalRight = marginR - 8;

  page.drawText("Descripcion", {
    x: colDescX,
    y: y - 2,
    size: 8,
    font: helveticaBold,
    color: white,
  });
  drawTextRight("Cant.", colQtyRight, y - 2, 8, helveticaBold, white);
  drawTextRight("P. Unit.", colUnitRight, y - 2, 8, helveticaBold, white);
  drawTextRight("Total", colTotalRight, y - 2, 8, helveticaBold, white);

  y -= 22;

  // Table rows
  const items = quotation.items || [];
  items.forEach((item, index) => {
    if (index % 2 === 0) {
      page.drawRectangle({
        x: marginL,
        y: y - 8,
        width: contentWidth,
        height: 22,
        color: lightGray,
      });
    }

    const description = (item.description || "").substring(0, 38);
    page.drawText(description, {
      x: colDescX,
      y: y - 1,
      size: 9,
      font: helvetica,
      color: darkText,
    });

    drawTextRight(
      String(item.quantity || 1),
      colQtyRight, y - 1, 9, helvetica, darkText
    );
    drawTextRight(
      formatCurrency(item.unit_price || 0, quotation.currency),
      colUnitRight, y - 1, 9, helvetica, darkText
    );
    drawTextRight(
      formatCurrency(item.total || 0, quotation.currency),
      colTotalRight, y - 1, 9, helveticaBold, darkText
    );

    y -= 22;
  });

  // Bottom line of table
  drawLine(page, marginL, marginR, y, borderGray, 0.5);

  // ── TOTALS ──
  // Layout: thin separator, then label on left half, value on right half
  y -= 20;
  drawLine(page, width / 2, marginR, y + 8, borderGray, 0.5);
  y -= 5;

  const drawTotalRow = (label, value, color = grayText) => {
    // Label: right-aligned to center divider with padding
    drawTextRight(label, width / 2 + 55, y, 9, helvetica, color);
    // Value: right-aligned to right margin
    drawTextRight(value, marginR, y, 9, helvetica, color);
    y -= 18;
  };

  drawTotalRow("Subtotal", formatCurrency(quotation.subtotal, quotation.currency));

  if (quotation.taxes > 0) {
    drawTotalRow("Impuestos", formatCurrency(quotation.taxes, quotation.currency));
  }
  if (quotation.fees > 0) {
    drawTotalRow("Cargos", formatCurrency(quotation.fees, quotation.currency));
  }
  if (quotation.discount_amount > 0) {
    drawTotalRow(
      "Descuento",
      `-${formatCurrency(quotation.discount_amount, quotation.currency)}`,
      red
    );
  }

  // Total highlight bar
  y -= 4;
  const totalBarX = width / 2 - 5;
  page.drawRectangle({
    x: totalBarX,
    y: y - 6,
    width: marginR - totalBarX,
    height: 28,
    color: navy,
  });

  page.drawText("TOTAL", {
    x: totalBarX + 15,
    y: y + 4,
    size: 11,
    font: helveticaBold,
    color: white,
  });

  drawTextRight(
    formatCurrency(quotation.total, quotation.currency),
    marginR - 8, y + 4, 11, helveticaBold, gold
  );

  // ── NOTES ──
  if (quotation.customer_notes) {
    y -= 45;
    page.drawText("NOTAS", {
      x: marginL,
      y: y,
      size: 8,
      font: helveticaBold,
      color: grayText,
    });

    y -= 14;
    const noteLines = quotation.customer_notes.substring(0, 400).split("\n");
    noteLines.forEach((line) => {
      if (y > 90) {
        page.drawText(line.substring(0, 90), {
          x: marginL,
          y: y,
          size: 9,
          font: helvetica,
          color: darkText,
        });
        y -= 14;
      }
    });
  }

  // ── FOOTER ──
  const footerY = 45;
  drawLine(page, marginL, marginR, footerY + 15, orange, 1.5);

  page.drawText("Venezuela Voyages", {
    x: marginL,
    y: footerY,
    size: 9,
    font: helveticaBold,
    color: navy,
  });

  page.drawText("Explore Now", {
    x: marginL + 105,
    y: footerY,
    size: 9,
    font: helvetica,
    color: orange,
  });

  page.drawText("www.venezuelavoyages.com  |  info@venezuelavoyages.com", {
    x: marginL,
    y: footerY - 14,
    size: 8,
    font: helvetica,
    color: grayText,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * GET - Genera PDF, lo guarda en Storage y retorna la URL
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Obtener la cotización
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

    // Generar PDF
    const pdfBuffer = await generateQuotationPDF(quotation);

    // Nombre del archivo
    const fileName = `quotations/${quotation.quotation_number}.pdf`;

    // Subir a Supabase Storage
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from("documents")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      // Si falla el storage, devolver el PDF directamente
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="cotizacion-${quotation.quotation_number}.pdf"`,
        },
      });
    }

    // Obtener URL pública
    const { data: urlData } = adminClient.storage
      .from("documents")
      .getPublicUrl(fileName);

    // Actualizar cotización con la URL del PDF
    await adminClient
      .from("quotations")
      .update({
        pdf_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Devolver el PDF directamente para preview
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

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Obtener la cotización
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

    // Generar PDF
    const pdfBuffer = await generateQuotationPDF(quotation);

    // Nombre del archivo
    const fileName = `quotations/${quotation.quotation_number}.pdf`;

    // Subir a Supabase Storage
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

    // Obtener URL pública
    const { data: urlData } = adminClient.storage
      .from("documents")
      .getPublicUrl(fileName);

    // Actualizar cotización con la URL del PDF
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
