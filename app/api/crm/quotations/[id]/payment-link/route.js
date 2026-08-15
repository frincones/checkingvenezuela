import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import {
  buildInvoiceFromQuotation,
  nextInvoiceNumber,
  createInvoice,
  sendInvoice,
  getInvoice,
  invoiceUrls,
  INVOICE_CURRENCY,
} from "@/lib/paymentIntegration/paypal/invoices";
import { isPaypalConfigured } from "@/lib/paymentIntegration/paypal";

/** Estados en los que una factura sigue viva y bloquea generar otra. */
const ACTIVE = ["created", "sent", "viewed", "partially_paid"];

/**
 * GET — cobro activo de la cotización (o null).
 */
export async function GET(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("payment_links")
    .select("*")
    .eq("quotation_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ data: data || null });
}

/**
 * POST — genera el cobro de una cotización.
 *
 * Body opcional:
 *   { notify?: boolean,      // true = PayPal envía el email. Por defecto solo link
 *     deposit_pct?: number } // null/ausente = cobro del 100 %
 *
 * El importe NUNCA llega del cliente: se lee de la fila de `quotations`.
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

    if (!isPaypalConfigured()) {
      return NextResponse.json(
        { error: "PayPal no está configurado en este entorno" },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const notify = body.notify === true;
    const depositPct = Number(body.deposit_pct) || null;

    const admin = createAdminClient();

    const { data: quotation, error: qError } = await admin
      .from("quotations")
      .select("*")
      .eq("id", id)
      .single();

    if (qError || !quotation) {
      return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
    }

    const customerEmail = quotation.metadata?.customer_email;
    if (!customerEmail) {
      return NextResponse.json(
        {
          error:
            "La cotización no tiene email de cliente. Añádelo antes de generar el cobro.",
        },
        { status: 400 },
      );
    }

    if (!(Number(quotation.total) > 0)) {
      return NextResponse.json(
        { error: "La cotización no tiene un total válido" },
        { status: 400 },
      );
    }

    // Comprobación previa para dar un error legible. La garantía real la da el
    // índice único parcial `idx_payment_links_one_active` en la base de datos.
    const { data: live } = await admin
      .from("payment_links")
      .select("id, url, status, amount")
      .eq("quotation_id", id)
      .in("status", ACTIVE)
      .maybeSingle();

    if (live) {
      return NextResponse.json(
        { error: "Ya existe un cobro activo para esta cotización", data: live },
        { status: 409 },
      );
    }

    // ── PayPal ──
    const invoiceNumber = await nextInvoiceNumber();
    const payload = buildInvoiceFromQuotation(quotation, { invoiceNumber, depositPct });

    // Idempotencia: si el asesor hace doble clic, PayPal devuelve la misma factura
    const invoiceId = await createInvoice(payload, `quo-${id}-${invoiceNumber}`);
    await sendInvoice(invoiceId, notify);

    const invoice = await getInvoice(invoiceId);
    const { payerUrl, merchantUrl } = invoiceUrls(invoice);

    if (!payerUrl) {
      return NextResponse.json(
        { error: "PayPal no devolvió el enlace de pago" },
        { status: 502 },
      );
    }

    const { data: link, error: insertError } = await admin
      .from("payment_links")
      .insert({
        quotation_id: id,
        lead_id: quotation.lead_id || null,
        provider: "paypal",
        external_id: invoiceId,
        url: payerUrl,
        merchant_url: merchantUrl,
        amount: Number(quotation.total),
        currency: INVOICE_CURRENCY,
        concept: `Quotation ${quotation.quotation_number}`,
        status: "sent",
        customer_name: quotation.metadata?.customer_name || null,
        customer_email: customerEmail,
        created_by: user.id,
        metadata: {
          invoice_number: invoiceNumber,
          notified: notify,
          deposit_pct: depositPct,
          // Si la cotización estaba en otra moneda, queda constancia del cambio
          original_currency: quotation.currency,
        },
      })
      .select()
      .single();

    if (insertError) {
      // El índice único saltó: otra petición ganó la carrera
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un cobro activo para esta cotización" },
          { status: 409 },
        );
      }
      console.error("payment_links insert:", insertError);
      return NextResponse.json({ error: "Error al guardar el cobro" }, { status: 500 });
    }

    return NextResponse.json({ data: link }, { status: 201 });
  } catch (err) {
    console.error("POST payment-link:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
