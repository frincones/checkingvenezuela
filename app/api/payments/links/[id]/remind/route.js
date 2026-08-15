import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { remindInvoice } from "@/lib/paymentIntegration/paypal/invoices";

/**
 * POST — recordatorio de impago.
 *
 * PayPal solo lo permite sobre facturas SENT / UNPAID / PARTIALLY_PAID.
 * Sobre un borrador o una factura pagada devuelve error, así que se filtra
 * antes para dar un mensaje entendible.
 */
const REMINDABLE = ["sent", "viewed", "partially_paid"];

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const admin = createAdminClient();

    const { data: link } = await admin
      .from("payment_links")
      .select("*")
      .eq("id", id)
      .single();

    if (!link) return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 });

    if (!REMINDABLE.includes(link.status)) {
      return NextResponse.json(
        { error: `No se puede recordar un cobro en estado "${link.status}"` },
        { status: 409 },
      );
    }

    await remindInvoice(link.external_id, {
      subject: body.subject,
      note: body.note,
    });

    const { data: updated } = await admin
      .from("payment_links")
      .update({
        metadata: {
          ...(link.metadata || {}),
          last_reminder_at: new Date().toISOString(),
          reminders: (link.metadata?.reminders || 0) + 1,
        },
      })
      .eq("id", id)
      .select()
      .single();

    return NextResponse.json({ data: updated, message: "Recordatorio enviado" });
  } catch (err) {
    console.error("POST remind:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
