/**
 * API para generar y descargar PDF de cotizaciones
 *
 * GET /api/crm/quotations/[id]/pdf - Genera, guarda en Storage y retorna URL
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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
 * Genera el PDF de una cotización usando pdf-lib
 */
async function generateQuotationPDF(quotation) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  // Load fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Colors - Venezuela Voyages branding
  const primaryColor = rgb(10 / 255, 26 / 255, 68 / 255); // #0A1A44 Azul Profundo
  const secondaryColor = rgb(242 / 255, 169 / 255, 59 / 255); // #F2A93B Naranja Atardecer
  const accentColor = rgb(255 / 255, 210 / 255, 117 / 255); // #FFD275 Dorado Arena
  const darkBlue = rgb(27 / 255, 73 / 255, 139 / 255); // #1B498B
  const grayColor = rgb(102 / 255, 102 / 255, 102 / 255);
  const whiteColor = rgb(1, 1, 1);

  let y = height - 50;

  // Header background
  page.drawRectangle({
    x: 0,
    y: height - 120,
    width: width,
    height: 120,
    color: primaryColor,
  });

  // Company name - Venezuela Voyages
  page.drawText("VENEZUELA VOYAGES", {
    x: 50,
    y: height - 60,
    size: 24,
    font: helveticaBold,
    color: whiteColor,
  });

  page.drawText("Explore Now - Tu aventura comienza aqui", {
    x: 50,
    y: height - 85,
    size: 12,
    font: helvetica,
    color: accentColor,
  });

  // Quotation number box
  page.drawRectangle({
    x: width - 200,
    y: height - 100,
    width: 150,
    height: 60,
    color: whiteColor,
    borderColor: whiteColor,
    borderWidth: 1,
  });

  page.drawText("COTIZACION", {
    x: width - 190,
    y: height - 55,
    size: 10,
    font: helvetica,
    color: secondaryColor,
  });

  page.drawText(quotation.quotation_number || "N/A", {
    x: width - 190,
    y: height - 75,
    size: 14,
    font: helveticaBold,
    color: secondaryColor,
  });

  y = height - 160;

  // Customer Info
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

  page.drawText("COTIZADO PARA:", {
    x: 50,
    y: y,
    size: 12,
    font: helveticaBold,
    color: secondaryColor,
  });

  y -= 20;
  page.drawText(customerName, {
    x: 50,
    y: y,
    size: 11,
    font: helvetica,
    color: grayColor,
  });

  if (customerEmail) {
    y -= 15;
    page.drawText(customerEmail, {
      x: 50,
      y: y,
      size: 11,
      font: helvetica,
      color: grayColor,
    });
  }

  if (customerPhone) {
    y -= 15;
    page.drawText(customerPhone, {
      x: 50,
      y: y,
      size: 11,
      font: helvetica,
      color: grayColor,
    });
  }

  // Dates on the right
  const detailsY = height - 160;
  page.drawText("DETALLES:", {
    x: width - 200,
    y: detailsY,
    size: 12,
    font: helveticaBold,
    color: secondaryColor,
  });

  page.drawText(
    `Fecha: ${new Date(quotation.created_at).toLocaleDateString("es-VE")}`,
    {
      x: width - 200,
      y: detailsY - 20,
      size: 10,
      font: helvetica,
      color: grayColor,
    }
  );

  page.drawText(
    `Valida hasta: ${
      quotation.valid_until
        ? new Date(quotation.valid_until).toLocaleDateString("es-VE")
        : "N/A"
    }`,
    {
      x: width - 200,
      y: detailsY - 35,
      size: 10,
      font: helvetica,
      color: grayColor,
    }
  );

  page.drawText(`Moneda: ${quotation.currency || "USD"}`, {
    x: width - 200,
    y: detailsY - 50,
    size: 10,
    font: helvetica,
    color: grayColor,
  });

  // Items table
  y = height - 280;

  // Table header - usando el color secundario (naranja)
  page.drawRectangle({
    x: 50,
    y: y - 5,
    width: 512,
    height: 25,
    color: secondaryColor,
  });

  page.drawText("DESCRIPCION", {
    x: 60,
    y: y + 3,
    size: 10,
    font: helveticaBold,
    color: whiteColor,
  });

  page.drawText("CANT.", {
    x: 320,
    y: y + 3,
    size: 10,
    font: helveticaBold,
    color: whiteColor,
  });

  page.drawText("P. UNIT.", {
    x: 380,
    y: y + 3,
    size: 10,
    font: helveticaBold,
    color: whiteColor,
  });

  page.drawText("TOTAL", {
    x: 480,
    y: y + 3,
    size: 10,
    font: helveticaBold,
    color: whiteColor,
  });

  y -= 30;

  // Items
  const items = quotation.items || [];
  items.forEach((item, index) => {
    // Alternating background
    if (index % 2 === 0) {
      page.drawRectangle({
        x: 50,
        y: y - 5,
        width: 512,
        height: 25,
        color: rgb(249 / 255, 249 / 255, 249 / 255),
      });
    }

    // Truncate description if too long
    const description = (item.description || "").substring(0, 40);
    page.drawText(description, {
      x: 60,
      y: y + 3,
      size: 10,
      font: helvetica,
      color: secondaryColor,
    });

    page.drawText(String(item.quantity || 1), {
      x: 330,
      y: y + 3,
      size: 10,
      font: helvetica,
      color: secondaryColor,
    });

    page.drawText(formatCurrency(item.unit_price || 0, quotation.currency), {
      x: 380,
      y: y + 3,
      size: 10,
      font: helvetica,
      color: secondaryColor,
    });

    page.drawText(formatCurrency(item.total || 0, quotation.currency), {
      x: 480,
      y: y + 3,
      size: 10,
      font: helvetica,
      color: secondaryColor,
    });

    y -= 25;
  });

  // Totals section
  y -= 20;
  const totalsX = 380;

  page.drawText("Subtotal:", {
    x: totalsX,
    y: y,
    size: 10,
    font: helvetica,
    color: grayColor,
  });

  page.drawText(formatCurrency(quotation.subtotal, quotation.currency), {
    x: 480,
    y: y,
    size: 10,
    font: helvetica,
    color: grayColor,
  });

  if (quotation.taxes > 0) {
    y -= 18;
    page.drawText("Impuestos:", {
      x: totalsX,
      y: y,
      size: 10,
      font: helvetica,
      color: grayColor,
    });

    page.drawText(formatCurrency(quotation.taxes, quotation.currency), {
      x: 480,
      y: y,
      size: 10,
      font: helvetica,
      color: grayColor,
    });
  }

  if (quotation.fees > 0) {
    y -= 18;
    page.drawText("Cargos:", {
      x: totalsX,
      y: y,
      size: 10,
      font: helvetica,
      color: grayColor,
    });

    page.drawText(formatCurrency(quotation.fees, quotation.currency), {
      x: 480,
      y: y,
      size: 10,
      font: helvetica,
      color: grayColor,
    });
  }

  if (quotation.discount_amount > 0) {
    y -= 18;
    page.drawText("Descuento:", {
      x: totalsX,
      y: y,
      size: 10,
      font: helvetica,
      color: rgb(229 / 255, 57 / 255, 53 / 255),
    });

    page.drawText(
      `-${formatCurrency(quotation.discount_amount, quotation.currency)}`,
      {
        x: 480,
        y: y,
        size: 10,
        font: helvetica,
        color: rgb(229 / 255, 57 / 255, 53 / 255),
      }
    );
  }

  // Total box - usando el color secundario (naranja)
  y -= 25;
  page.drawRectangle({
    x: totalsX - 10,
    y: y - 8,
    width: 180,
    height: 30,
    color: secondaryColor,
  });

  page.drawText("TOTAL:", {
    x: totalsX,
    y: y,
    size: 12,
    font: helveticaBold,
    color: whiteColor,
  });

  page.drawText(formatCurrency(quotation.total, quotation.currency), {
    x: 480,
    y: y,
    size: 12,
    font: helveticaBold,
    color: whiteColor,
  });

  // Notes section
  if (quotation.customer_notes) {
    y -= 60;
    page.drawText("NOTAS:", {
      x: 50,
      y: y,
      size: 12,
      font: helveticaBold,
      color: secondaryColor,
    });

    y -= 18;
    // Split notes into lines
    const noteLines = quotation.customer_notes.substring(0, 300).split("\n");
    noteLines.forEach((line) => {
      if (y > 100) {
        page.drawText(line.substring(0, 80), {
          x: 50,
          y: y,
          size: 10,
          font: helvetica,
          color: grayColor,
        });
        y -= 15;
      }
    });
  }

  // Footer - Venezuela Voyages branding
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: 70,
    color: primaryColor,
  });

  page.drawText("VENEZUELA VOYAGES - Explore Now", {
    x: 200,
    y: 45,
    size: 11,
    font: helveticaBold,
    color: whiteColor,
  });

  page.drawText("www.venezuelavoyages.com | info@venezuelavoyages.com", {
    x: 145,
    y: 25,
    size: 10,
    font: helvetica,
    color: accentColor,
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
