/**
 * API para enviar cotización por email con PDF adjunto
 * POST /api/crm/quotations/[id]/send
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "ventas@venezuelavoyages.com";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
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

    // Obtener cotización con relaciones
    const { data: quotation, error: qError } = await adminClient
      .from("quotations")
      .select(`
        *,
        lead:leads(contact_name, contact_email, contact_phone),
        advisor:advisors(
          id,
          profile:profiles(first_name, last_name, email)
        )
      `)
      .eq("id", id)
      .single();

    if (qError || !quotation) {
      return NextResponse.json(
        { error: "Cotización no encontrada" },
        { status: 404 }
      );
    }

    // Determinar destinatario
    const toEmail =
      body.to ||
      quotation.lead?.contact_email ||
      quotation.metadata?.customer_email;

    if (!toEmail) {
      return NextResponse.json(
        { error: "No se encontró email del cliente. Proporcione un email destino." },
        { status: 400 }
      );
    }

    const customerName =
      body.customer_name ||
      quotation.lead?.contact_name ||
      quotation.metadata?.customer_name ||
      "Estimado cliente";

    const advisorName = quotation.advisor?.profile
      ? `${quotation.advisor.profile.first_name} ${quotation.advisor.profile.last_name}`
      : "Venezuela Voyages";

    // Generar PDF internamente llamando a la misma API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const pdfResponse = await fetch(`${baseUrl}/api/crm/quotations/${id}/pdf`, {
      headers: {
        Cookie: request.headers.get("cookie") || "",
      },
    });

    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: "Error al generar el PDF para adjuntar" },
        { status: 500 }
      );
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    // Formatear montos
    const total = quotation.total || quotation.total_amount || 0;
    const currency = quotation.currency || "USD";
    const formattedTotal = new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency,
    }).format(total);

    const validUntil = quotation.valid_until
      ? new Date(quotation.valid_until).toLocaleDateString("es-VE", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    // Construir items para el email
    const itemsList = (quotation.items || [])
      .map((item) => {
        const name = item.product_details?.product_name || item.description || "Producto";
        const dest = item.product_details?.destination_name || "";
        return `<li style="margin-bottom:8px;padding:8px 0;border-bottom:1px solid #eee;">
          <strong>${name}</strong>${dest ? ` — ${dest}` : ""}
        </li>`;
      })
      .join("");

    // Mensaje personalizado del usuario (opcional)
    const customMessage = body.message || "";

    // HTML del email
    const htmlBody = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <!-- Header -->
      <div style="background:#0A1A44;padding:32px 40px;text-align:center;">
        <h1 style="color:#F2A93B;margin:0;font-size:24px;font-weight:700;">Venezuela Voyages</h1>
        <p style="color:#ffffff;margin:8px 0 0;font-size:14px;opacity:0.9;">Tu aventura comienza aquí</p>
      </div>

      <!-- Body -->
      <div style="padding:32px 40px;">
        <p style="color:#333;font-size:16px;line-height:1.6;">
          Hola <strong>${customerName}</strong>,
        </p>

        ${customMessage ? `<p style="color:#333;font-size:15px;line-height:1.6;">${customMessage}</p>` : ""}

        <p style="color:#333;font-size:15px;line-height:1.6;">
          Le hacemos llegar su cotización <strong>${quotation.quotation_number}</strong> con los detalles de su viaje.
          Encontrará el documento completo en el PDF adjunto.
        </p>

        ${itemsList ? `
        <div style="margin:24px 0;background:#f8f9fa;border-radius:8px;padding:20px;">
          <h3 style="color:#0A1A44;margin:0 0 12px;font-size:16px;">Servicios incluidos:</h3>
          <ul style="list-style:none;padding:0;margin:0;">${itemsList}</ul>
        </div>
        ` : ""}

        <!-- Total -->
        <div style="background:#0A1A44;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">
          <p style="color:#ffffff;margin:0 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Inversión Total</p>
          <p style="color:#F2A93B;margin:0;font-size:28px;font-weight:700;">${formattedTotal}</p>
          ${validUntil ? `<p style="color:#ffffff;margin:8px 0 0;font-size:12px;opacity:0.8;">Válida hasta: ${validUntil}</p>` : ""}
        </div>

        <p style="color:#333;font-size:15px;line-height:1.6;">
          Quedamos a su disposición para cualquier consulta o ajuste.
        </p>

        <p style="color:#333;font-size:15px;line-height:1.6;">
          Saludos cordiales,<br/>
          <strong>${advisorName}</strong><br/>
          <span style="color:#666;font-size:13px;">Venezuela Voyages</span>
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f8f9fa;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
        <p style="color:#666;font-size:12px;margin:0;">
          info@venezuelavoyages.com · +58 426 403 4052 · www.venezuelavoyages.com
        </p>
      </div>
    </div>`;

    // Enviar con Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `Venezuela Voyages <${FROM_EMAIL}>`,
      to: toEmail,
      subject: body.subject || `Cotización ${quotation.quotation_number} — Venezuela Voyages`,
      html: htmlBody,
      attachments: [
        {
          filename: `cotizacion-${quotation.quotation_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      return NextResponse.json(
        { error: `Error al enviar email: ${emailError.message}` },
        { status: 500 }
      );
    }

    // Actualizar estado de la cotización
    await adminClient
      .from("quotations")
      .update({
        status: quotation.status === "draft" ? "sent" : quotation.status,
        sent_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      message: `Cotización enviada a ${toEmail}`,
      email_id: emailData?.id,
      to: toEmail,
    });
  } catch (error) {
    console.error("Error in POST /api/crm/quotations/[id]/send:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
