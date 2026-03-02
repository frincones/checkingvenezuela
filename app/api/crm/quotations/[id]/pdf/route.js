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

  // ── QUOTATION LABEL (right side, aligned with logo) ──
  page.drawText("COTIZACION", {
    x: marginR - 120,
    y: y - 25,
    size: 9,
    font: helvetica,
    color: grayText,
  });

  page.drawText(quotation.quotation_number || "N/A", {
    x: marginR - 120,
    y: y - 45,
    size: 18,
    font: helveticaBold,
    color: navy,
  });

  // Status badge
  const status = (quotation.status || "borrador").toUpperCase();
  page.drawText(status, {
    x: marginR - 120,
    y: y - 65,
    size: 8,
    font: helveticaBold,
    color: orange,
  });

  // ── ACCENT LINE under header ──
  y = y - logoH - 15;
  drawLine(page, marginL, marginR, y, orange, 2);

  // ── INFO SECTION: Customer (left) + Details (right) ──
  y -= 30;

  // Left column - Customer
  page.drawText("PARA", {
    x: marginL,
    y: y,
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

  y -= 16;
  page.drawText(customerName, {
    x: marginL,
    y: y,
    size: 11,
    font: helveticaBold,
    color: darkText,
  });

  if (customerEmail) {
    y -= 15;
    page.drawText(customerEmail, {
      x: marginL,
      y: y,
      size: 9,
      font: helvetica,
      color: grayText,
    });
  }

  if (customerPhone) {
    y -= 14;
    page.drawText(customerPhone, {
      x: marginL,
      y: y,
      size: 9,
      font: helvetica,
      color: grayText,
    });
  }

  // Right column - Details
  const detailX = marginR - 160;
  const detailStartY = y + (customerEmail ? 30 : 16) + (customerPhone ? 14 : 0);

  page.drawText("DETALLES", {
    x: detailX,
    y: detailStartY + 16,
    size: 8,
    font: helveticaBold,
    color: grayText,
  });

  const detailLabels = ["Fecha", "Valida hasta", "Moneda"];
  const detailValues = [
    new Date(quotation.created_at).toLocaleDateString("es-VE"),
    quotation.valid_until
      ? new Date(quotation.valid_until).toLocaleDateString("es-VE")
      : "N/A",
    quotation.currency || "USD",
  ];

  detailLabels.forEach((label, i) => {
    const dy = detailStartY - i * 16;
    page.drawText(label, {
      x: detailX,
      y: dy,
      size: 9,
      font: helvetica,
      color: grayText,
    });
    page.drawText(detailValues[i], {
      x: detailX + 80,
      y: dy,
      size: 9,
      font: helveticaBold,
      color: darkText,
    });
  });

  // ── ITEMS TABLE ──
  y -= 40;
  drawLine(page, marginL, marginR, y + 5, borderGray, 0.5);

  // Table header background
  page.drawRectangle({
    x: marginL,
    y: y - 8,
    width: contentWidth,
    height: 22,
    color: navy,
  });

  const colDesc = marginL + 10;
  const colQty = 330;
  const colUnit = 400;
  const colTotal = 500;

  page.drawText("Descripcion", {
    x: colDesc,
    y: y - 2,
    size: 8,
    font: helveticaBold,
    color: white,
  });
  page.drawText("Cant.", {
    x: colQty,
    y: y - 2,
    size: 8,
    font: helveticaBold,
    color: white,
  });
  page.drawText("P. Unit.", {
    x: colUnit,
    y: y - 2,
    size: 8,
    font: helveticaBold,
    color: white,
  });
  page.drawText("Total", {
    x: colTotal,
    y: y - 2,
    size: 8,
    font: helveticaBold,
    color: white,
  });

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

    const description = (item.description || "").substring(0, 45);
    page.drawText(description, {
      x: colDesc,
      y: y - 1,
      size: 9,
      font: helvetica,
      color: darkText,
    });

    page.drawText(String(item.quantity || 1), {
      x: colQty,
      y: y - 1,
      size: 9,
      font: helvetica,
      color: darkText,
    });

    page.drawText(formatCurrency(item.unit_price || 0, quotation.currency), {
      x: colUnit,
      y: y - 1,
      size: 9,
      font: helvetica,
      color: darkText,
    });

    page.drawText(formatCurrency(item.total || 0, quotation.currency), {
      x: colTotal,
      y: y - 1,
      size: 9,
      font: helveticaBold,
      color: darkText,
    });

    y -= 22;
  });

  // Bottom line of table
  drawLine(page, marginL, marginR, y, borderGray, 0.5);

  // ── TOTALS ──
  y -= 25;
  const totalsLabelX = colUnit - 20;
  const totalsValueX = colTotal;

  const drawTotalRow = (label, value, color = grayText, bold = false) => {
    page.drawText(label, {
      x: totalsLabelX,
      y: y,
      size: 9,
      font: helvetica,
      color: color,
    });
    page.drawText(value, {
      x: totalsValueX,
      y: y,
      size: bold ? 10 : 9,
      font: bold ? helveticaBold : helvetica,
      color: color,
    });
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

  // Total highlight
  y -= 2;
  page.drawRectangle({
    x: totalsLabelX - 10,
    y: y - 6,
    width: marginR - totalsLabelX + 10,
    height: 26,
    color: navy,
  });

  page.drawText("TOTAL", {
    x: totalsLabelX,
    y: y + 3,
    size: 11,
    font: helveticaBold,
    color: white,
  });

  page.drawText(formatCurrency(quotation.total, quotation.currency), {
    x: totalsValueX,
    y: y + 3,
    size: 11,
    font: helveticaBold,
    color: gold,
  });

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
