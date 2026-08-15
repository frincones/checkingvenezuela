import "server-only";
import { createAdminClient } from "@/lib/db/supabase/server";

/**
 * Bloqueo de edición cuando hay un cobro vivo.
 *
 * El problema que evita: si el asesor cambia los items DESPUÉS de generar el
 * cobro, la factura de PayPal y el PDF que ya recibió el cliente dejan de
 * cuadrar. El cliente acaba pagando un importe distinto al que se le mandó.
 *
 * Vive en un módulo compartido a propósito: hay DOS caminos que editan items
 * (el server action `updateQuotationItemsAction` y el PATCH de
 * /api/crm/quotations/[id]). Duplicar la comprobación en cada uno garantiza
 * que tarde o temprano diverjan.
 */

const ACTIVE_STATUSES = ["created", "sent", "viewed", "partially_paid"];

/**
 * @param {string} quotationId
 * @returns {Promise<{locked: boolean, link?: object, error?: string}>}
 */
export async function getActivePaymentLock(quotationId) {
  if (!quotationId) return { locked: false };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("payment_links")
      .select("id, url, status, amount, currency")
      .eq("quotation_id", quotationId)
      .in("status", ACTIVE_STATUSES)
      .maybeSingle();

    // La tabla todavía no existe (migración sin aplicar): no bloqueamos nada.
    if (error) {
      if (error.code === "42P01") return { locked: false };
      console.error("getActivePaymentLock:", error.message);
      return { locked: false };
    }

    if (!data) return { locked: false };

    return {
      locked: true,
      link: data,
      error:
        data.status === "partially_paid"
          ? "Esta cotización tiene un cobro con pago parcial. Cancela el cobro antes de editarla."
          : "Esta cotización tiene un cobro activo. Cancélalo antes de editar los items, o el importe dejará de coincidir con la factura enviada al cliente.",
    };
  } catch (err) {
    console.error("getActivePaymentLock:", err.message);
    return { locked: false };
  }
}
