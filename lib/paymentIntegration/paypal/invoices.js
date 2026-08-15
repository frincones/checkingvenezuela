import "server-only";
import { paypal } from "./index";

/**
 * Facturas de PayPal (Invoicing API v2).
 *
 * Se eligió Invoicing sobre la Payment Links API porque:
 *   · recordatorios automáticos de impago
 *   · seguimiento por cliente (sabes quién pagó y quién no)
 *   · disponible en cualquier cuenta business, sin aprobación previa
 *   · el pago parcial queda disponible por si algún día se cobra anticipo
 *
 * Se descartó la Orders API: su enlace `payer-action` caduca a las 6 horas,
 * inservible para mandarlo por WhatsApp y que el cliente pague al día siguiente.
 *
 * ⚠️ IDIOMA DE LA FACTURA: la API NO permite fijarlo. Se probaron `detail.locale`,
 * `detail.language` y `detail.locale_code` contra la API real y los tres se
 * descartan en silencio. Los rótulos ("Amount due", "Invoice") los decide
 * PayPal según el idioma de la CUENTA del comercio. Para que salgan en inglés
 * hay que cambiarlo en PayPal → Perfil → Idioma. Todo lo que sí controlamos
 * —nota, condiciones, datos del emisor— va en inglés desde aquí.
 */

/** Moneda única del negocio. Las cotizaciones en EUR se facturan en USD. */
export const INVOICE_CURRENCY = "USD";

/**
 * Datos de marca del emisor.
 *
 * ⚠️ NO incluir `email_address`: PayPal exige que sea la cuenta real del
 * comercio. Con un alias tipo info@… el POST lo acepta en silencio pero
 * cualquier PUT posterior falla con USER_NOT_FOUND. Verificado en producción.
 */
const INVOICER = {
  business_name: "VENEZUELA VOYAGES",
  name: { given_name: "Venezuela", surname: "Voyages" },
  website: "https://venezuelavoyages.com",
  logo_url: "https://venezuelavoyages.com/images/venezuela-voyages-logo.png",
  phones: [
    { country_code: "58", national_number: "4264034052", phone_type: "MOBILE" },
  ],
  address: {
    address_line_1: "Charallave",
    admin_area_2: "Charallave",
    admin_area_1: "Miranda",
    country_code: "VE",
  },
  // RIF fiscal. Se deja aquí y no en una variable de entorno porque es un dato
  // público de la empresa que debe aparecer en toda factura emitida.
  tax_id: "J508408870",
  additional_notes:
    "Signature travel experiences in Venezuela · 24/7 support · info@venezuelavoyages.com",
};

/**
 * Nota fija que ve el cliente en la factura.
 *
 * NO se reutiliza `quotation.customer_notes`: esas notas están en español y
 * suelen listar formas de pago alternativas (Zelle, Binance) que no tienen
 * sentido en una factura de PayPal — el cliente está pagando con PayPal justo
 * ahí, y ofrecerle otra vía en ese momento solo genera dudas.
 */
const CUSTOMER_NOTE =
  "Thank you for choosing Venezuela Voyages. This invoice covers the travel services detailed below. " +
  "Prices are subject to availability and may change without notice until the booking is confirmed.";

function splitName(full) {
  const parts = String(full || "Customer").trim().split(/\s+/);
  return {
    given_name: parts[0] || "Customer",
    surname: parts.slice(1).join(" ") || parts[0] || "Customer",
  };
}

const money = (n) => Number(n || 0).toFixed(2);

/**
 * Construye el cuerpo de la factura a partir de una cotización.
 *
 * El importe sale SIEMPRE de la fila de la base de datos. Nunca se acepta un
 * importe enviado por el cliente: sería manipulable desde el navegador.
 *
 * @param {object} quotation  fila de `quotations`
 * @param {object} opts
 * @param {string} opts.invoiceNumber
 * @param {number|null} [opts.depositPct] null = cobro del 100 %
 */
export function buildInvoiceFromQuotation(quotation, { invoiceNumber, depositPct = null }) {
  const meta = quotation.metadata || {};

  const items = (quotation.items || []).map((it) => {
    const qty = Number(it.quantity ?? 1) || 1;
    // Algunos items históricos solo traen `total`; se deriva el unitario.
    const unit = it.unit_price != null ? Number(it.unit_price) : Number(it.total || 0) / qty;
    return {
      name: String(it.description || "Travel service").slice(0, 200),
      quantity: String(qty),
      unit_amount: { currency_code: INVOICE_CURRENCY, value: money(unit) },
      unit_of_measure: "QUANTITY",
    };
  });

  // Sin items utilizables se factura el total como una sola línea, para no
  // bloquear el cobro por un dato incompleto.
  if (items.length === 0) {
    items.push({
      name: `Travel package · Quotation ${quotation.quotation_number}`,
      quantity: "1",
      unit_amount: { currency_code: INVOICE_CURRENCY, value: money(quotation.total) },
      unit_of_measure: "QUANTITY",
    });
  }

  const partial =
    depositPct && depositPct > 0 && depositPct < 100
      ? {
          allow_partial_payment: true,
          minimum_amount_due: {
            currency_code: INVOICE_CURRENCY,
            value: money(Number(quotation.total) * (depositPct / 100)),
          },
        }
      : { allow_partial_payment: false };

  return {
    detail: {
      invoice_number: invoiceNumber,
      // Ata la factura a la cotización: aparece en el documento y en los informes
      reference: quotation.quotation_number,
      invoice_date: new Date().toISOString().slice(0, 10),
      currency_code: INVOICE_CURRENCY,
      note: CUSTOMER_NOTE,
      // ⚠️ El campo es `terms_and_conditions`. PayPal descarta `term` EN SILENCIO,
      // sin devolver error: se enviarían facturas sin condiciones sin enterarse.
      terms_and_conditions:
        "Payment confirms the booking. Deposits are non-refundable. " +
        "Full terms: https://venezuelavoyages.com/terms-of-service",
      memo: quotation.internal_notes || undefined, // privado, el cliente no lo ve
      payment_term: { term_type: "NET_30" },
    },
    // PAYPAL_TAX_ID permite sobrescribir el RIF sin desplegar, si cambiara.
    invoicer: {
      ...INVOICER,
      ...(process.env.PAYPAL_TAX_ID ? { tax_id: process.env.PAYPAL_TAX_ID } : {}),
    },
    primary_recipients: [
      {
        billing_info: {
          name: splitName(meta.customer_name),
          email_address: meta.customer_email,
        },
      },
    ],
    items,
    configuration: {
      allow_tip: false,
      tax_inclusive: false,
      partial_payment: partial,
    },
  };
}

// ── Operaciones ──

export const nextInvoiceNumber = () =>
  paypal("/v2/invoicing/generate-next-invoice-number", { method: "POST" }).then(
    (r) => r.invoice_number,
  );

/** Devuelve el id de la factura creada (PayPal responde solo con un link). */
export async function createInvoice(body, requestId) {
  const created = await paypal("/v2/invoicing/invoices", {
    method: "POST",
    body,
    requestId,
  });
  const id = String(created.href || "").split("/").pop();
  if (!id) throw new Error("PayPal no devolvió el id de la factura");
  return id;
}

export const getInvoice = (id) => paypal(`/v2/invoicing/invoices/${id}`);

/**
 * Pasa la factura a UNPAID y genera el link de pago.
 *
 * `notify=false` genera el link SIN que PayPal envíe ningún email: es el flujo
 * por defecto, porque los asesores lo comparten por WhatsApp.
 */
export const sendInvoice = (id, notify = false) =>
  paypal(`/v2/invoicing/invoices/${id}/send`, {
    method: "POST",
    body: { send_to_recipient: Boolean(notify), send_to_invoicer: false },
  });

/** Solo funciona sobre facturas SENT, UNPAID o PARTIALLY_PAID. */
export const remindInvoice = (id, { subject, note } = {}) =>
  paypal(`/v2/invoicing/invoices/${id}/remind`, {
    method: "POST",
    body: {
      subject: subject || "Reminder: your Venezuela Voyages invoice",
      note: note || "A friendly reminder that your invoice is still pending.",
      send_to_invoicer: false,
    },
  });

export const cancelInvoice = (id, note) =>
  paypal(`/v2/invoicing/invoices/${id}/cancel`, {
    method: "POST",
    body: {
      send_to_recipient: false,
      send_to_invoicer: false,
      note: note || "Invoice cancelled by Venezuela Voyages.",
    },
  });

/** Extrae los enlaces útiles de una factura ya enviada. */
export function invoiceUrls(invoice) {
  const m = invoice?.detail?.metadata || {};
  return {
    payerUrl: m.recipient_view_url || null,
    merchantUrl: m.invoicer_view_url || null,
  };
}

/** Traduce el estado de PayPal al de nuestra tabla `payment_links`. */
export function mapInvoiceStatus(paypalStatus) {
  switch (paypalStatus) {
    case "DRAFT": return "created";
    case "SENT":
    case "UNPAID": return "sent";
    case "PARTIALLY_PAID": return "partially_paid";
    case "PAID":
    case "MARKED_AS_PAID": return "paid";
    case "CANCELLED": return "cancelled";
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
    case "MARKED_AS_REFUNDED": return "refunded";
    default: return "sent";
  }
}
