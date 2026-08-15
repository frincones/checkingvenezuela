import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/server";
import { paypal } from "@/lib/paymentIntegration/paypal";

/**
 * Receptor de webhooks de PayPal.
 *
 * Tres cosas que hay que hacer bien o el módulo es inseguro/incorrecto:
 *
 *  1. VERIFICAR LA FIRMA sobre el cuerpo CRUDO. Si se parsea antes, la firma
 *     no valida. Mismo motivo por el que app/api/stripe/webhook/route.js lee
 *     el arrayBuffer antes de tocar nada.
 *  2. IDEMPOTENCIA. PayPal reintenta la entrega; sin deduplicar por event.id
 *     un mismo pago se contaría dos veces.
 *  3. NUNCA confiar en el return_url del navegador. El estado real lo dicta
 *     este webhook, no que el cliente vuelva a la web.
 */

/** Eventos que nos interesan → estado en `payment_links`. */
const EVENT_STATUS = {
  "INVOICING.INVOICE.PAID": "paid",
  "INVOICING.INVOICE.CANCELLED": "cancelled",
  "INVOICING.INVOICE.REFUNDED": "refunded",
  "INVOICING.INVOICE.UPDATED": null, // solo sincroniza importes
};

export async function POST(request) {
  let raw;
  try {
    // (1) cuerpo crudo, antes de parsear
    raw = await request.text();
  } catch {
    return NextResponse.json({ error: "Cuerpo ilegible" }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error("[paypal webhook] falta PAYPAL_WEBHOOK_ID");
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  }

  // (1) verificación de firma contra PayPal
  try {
    const h = (k) => request.headers.get(k);
    const verification = await paypal("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: {
        auth_algo: h("paypal-auth-algo"),
        cert_url: h("paypal-cert-url"),
        transmission_id: h("paypal-transmission-id"),
        transmission_sig: h("paypal-transmission-sig"),
        transmission_time: h("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: event,
      },
    });

    if (verification.verification_status !== "SUCCESS") {
      console.error("[paypal webhook] firma inválida:", verification.verification_status);
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }
  } catch (err) {
    console.error("[paypal webhook] error verificando firma:", err.message);
    return NextResponse.json({ error: "No se pudo verificar la firma" }, { status: 401 });
  }

  const admin = createAdminClient();
  const invoice = event.resource?.invoice || event.resource || {};
  const invoiceId = invoice.id || event.resource?.id || null;

  // (2) idempotencia: la PK de la tabla rechaza el duplicado
  const { error: dupError } = await admin.from("payment_webhook_events").insert({
    event_id: event.id,
    provider: "paypal",
    event_type: event.event_type,
    resource_id: invoiceId,
    payload: event,
  });

  if (dupError?.code === "23505") {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  if (dupError && dupError.code !== "23505") {
    console.error("[paypal webhook] registrando evento:", dupError.message);
    // Se sigue igualmente: perder el pago es peor que registrar dos veces
  }

  if (!(event.event_type in EVENT_STATUS) || !invoiceId) {
    return NextResponse.json({ ok: true, ignored: event.event_type });
  }

  const { data: link } = await admin
    .from("payment_links")
    .select("*")
    .eq("provider", "paypal")
    .eq("external_id", invoiceId)
    .maybeSingle();

  if (!link) {
    // Factura creada fuera de la app (a mano en PayPal). No es un error.
    return NextResponse.json({ ok: true, unknown_invoice: invoiceId });
  }

  const paidAmount = Number(
    invoice?.payments?.paid_amount?.value ?? invoice?.amount?.value ?? link.amount_paid ?? 0,
  );
  const total = Number(link.amount);

  let status = EVENT_STATUS[event.event_type];
  if (status === "paid" && paidAmount > 0 && paidAmount < total) {
    status = "partially_paid"; // el evento dice PAID pero solo cubre el anticipo
  }
  if (!status) {
    status = paidAmount >= total ? "paid" : paidAmount > 0 ? "partially_paid" : link.status;
  }

  await admin
    .from("payment_links")
    .update({
      status,
      amount_paid: paidAmount,
      paid_at: status === "paid" ? link.paid_at || new Date().toISOString() : link.paid_at,
      metadata: { ...(link.metadata || {}), last_event: event.event_type },
    })
    .eq("id", link.id);

  // Reflejo en la cotización
  if (link.quotation_id) {
    const patch = { amount_paid: paidAmount };
    if (status === "paid") {
      patch.status = "paid";
      patch.paid_at = new Date().toISOString();
    }
    const { error: qError } = await admin
      .from("quotations")
      .update(patch)
      .eq("id", link.quotation_id);

    if (qError) {
      // Si falta la migración del enum, el update de `status` falla pero el
      // importe sí debe guardarse: se reintenta sin tocar el estado.
      console.error("[paypal webhook] actualizando cotización:", qError.message);
      await admin
        .from("quotations")
        .update({ amount_paid: paidAmount })
        .eq("id", link.quotation_id);
    }
  }

  return NextResponse.json({ ok: true, status });
}
