import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import {
  getInvoice,
  cancelInvoice,
  mapInvoiceStatus,
} from "@/lib/paymentIntegration/paypal/invoices";

/**
 * GET — detalle del cobro. Sincroniza el estado con PayPal.
 *
 * El webhook es la vía principal de actualización, pero esta sincronización
 * bajo demanda cubre el caso de un webhook perdido: el asesor abre el cobro y
 * ve el estado real, no el que quedó guardado.
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createAdminClient();
    const { data: link, error } = await admin
      .from("payment_links")
      .select(`*, quotation:quotations(id, quotation_number, status, total)`)
      .eq("id", id)
      .single();

    if (error || !link) {
      return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 });
    }

    if (link.provider === "paypal" && !["cancelled", "refunded"].includes(link.status)) {
      try {
        const invoice = await getInvoice(link.external_id);
        const fresh = mapInvoiceStatus(invoice.status);
        const paid = Number(invoice?.payments?.paid_amount?.value ?? link.amount_paid ?? 0);

        if (fresh !== link.status || paid !== Number(link.amount_paid)) {
          const { data: updated } = await admin
            .from("payment_links")
            .update({
              status: fresh,
              amount_paid: paid,
              paid_at: fresh === "paid" ? link.paid_at || new Date().toISOString() : link.paid_at,
            })
            .eq("id", id)
            .select(`*, quotation:quotations(id, quotation_number, status, total)`)
            .single();
          return NextResponse.json({ data: updated, synced: true });
        }
      } catch (e) {
        // La sincronización es best-effort: si PayPal falla, devolvemos lo guardado
        console.error("sync PayPal invoice:", e.message);
      }
    }

    return NextResponse.json({ data: link });
  } catch (err) {
    console.error("GET payment link:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * DELETE — cancela el cobro en PayPal y libera la cotización.
 *
 * Se cancela, no se borra: la fila queda como historial y el índice parcial
 * deja de bloquear la generación de un cobro nuevo.
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createAdminClient();
    const { data: link } = await admin
      .from("payment_links")
      .select("*")
      .eq("id", id)
      .single();

    if (!link) return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 });

    if (link.status === "paid") {
      return NextResponse.json(
        { error: "No se puede cancelar un cobro ya pagado. Emite un reembolso desde PayPal." },
        { status: 409 },
      );
    }

    if (link.provider === "paypal") {
      try {
        await cancelInvoice(link.external_id);
      } catch (e) {
        // Si en PayPal ya estaba cancelada, seguimos y marcamos la fila igual
        console.error("cancelInvoice:", e.message);
      }
    }

    const { data: updated, error } = await admin
      .from("payment_links")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Error al cancelar el cobro" }, { status: 500 });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("DELETE payment link:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
