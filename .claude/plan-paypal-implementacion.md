# Implementación de cobros PayPal — código concreto

**Decisiones cerradas**: D1 cobro **100 %** por defecto · D2 estado **`paid`** ·
D3 **QR obligatorio** en el PDF · D5 **siempre USD**
**Estado**: propuesta. Escrito contra los archivos reales del repo.

---

## 0. Nota sobre D1

Elegí Invoicing sobre Payment Links apoyándome sobre todo en los **pagos
parciales**. Si el cobro va a ser siempre del 100 %, ese argumento se cae.

**Invoicing sigue ganando igual**, por tres razones que se sostienen solas:
recordatorios automáticos de impago, seguimiento por cliente (sabes quién pagó y
quién no) y disponibilidad garantizada en tu cuenta — ya la validamos
funcionando. El pago parcial queda **disponible pero desactivado por defecto**,
para el día que quieras cobrar un anticipo.

---

## 1. Migraciones

### `supabase/migrations/20260815_payment_links.sql`

```sql
-- Links/facturas de pago. Tabla propia y no columnas en `quotations` porque:
--   · un cobro puede existir sin cotización (extra acordado por WhatsApp)
--   · una cotización puede tener varios (anticipo + saldo)
--   · `provider` deja la puerta abierta a Stripe sin migrar nada

CREATE TABLE IF NOT EXISTS public.payment_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id   UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  lead_id        UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  provider       TEXT NOT NULL DEFAULT 'paypal',
  external_id    TEXT NOT NULL,              -- INV2-XXXX-XXXX-XXXX-XXXX
  url            TEXT NOT NULL,              -- lo que se manda al cliente
  merchant_url   TEXT,                       -- vista interna en PayPal

  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency       TEXT NOT NULL DEFAULT 'USD',
  concept        TEXT NOT NULL,

  status         TEXT NOT NULL DEFAULT 'created'
                 CHECK (status IN ('created','sent','viewed','partially_paid',
                                   'paid','cancelled','refunded','expired')),
  amount_paid    NUMERIC(12,2) NOT NULL DEFAULT 0,

  customer_name  TEXT,
  customer_email TEXT,
  created_by     UUID REFERENCES public.profiles(id),
  paid_at        TIMESTAMPTZ,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_links_external
  ON public.payment_links(provider, external_id);

-- I1: una sola factura VIVA por cotización. El índice parcial lo impone en BD,
-- no en código: dos clics simultáneos no pueden crear dos cobros.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_links_one_active
  ON public.payment_links(quotation_id)
  WHERE quotation_id IS NOT NULL
    AND status IN ('created','sent','viewed','partially_paid');

CREATE INDEX IF NOT EXISTS idx_payment_links_status ON public.payment_links(status);

-- Idempotencia de webhooks (I6): PayPal reintenta y sin esto un pago cuenta dos veces
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  event_id     TEXT PRIMARY KEY,
  provider     TEXT NOT NULL DEFAULT 'paypal',
  event_type   TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload      JSONB
);

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at     TIMESTAMPTZ;

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage payment links" ON public.payment_links
  FOR ALL USING (auth.role() = 'authenticated');
```

### `supabase/migrations/20260815_quotation_status_paid.sql` *(archivo aparte)*

```sql
-- ALTER TYPE ... ADD VALUE no puede ir dentro de una transacción.
-- Por eso va solo, sin nada más en el archivo.
ALTER TYPE quotation_status ADD VALUE IF NOT EXISTS 'paid';
```

---

## 2. Cliente PayPal — `lib/paymentIntegration/paypal/index.js`

```js
import "server-only";

const BASE = process.env.PAYPAL_ENV === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

// El token dura ~9h. Pedir uno por request es el error más común de esta
// integración: multiplica la latencia de cada cobro sin ninguna ganancia.
let cached = null;

async function accessToken() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`,
  ).toString("base64");

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal OAuth ${res.status}: ${await res.text()}`);

  const json = await res.json();
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

export async function paypal(path, { method = "GET", body, requestId } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      // Idempotencia de PayPal: dos POST con el mismo id no crean dos facturas
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = (json.details || []).map((d) => `${d.field || ""} ${d.issue}`).join("; ");
    throw new Error(`PayPal ${method} ${path} → ${res.status} ${json.name || ""} ${detail}`);
  }
  return json;
}
```

---

## 3. Facturas — `lib/paymentIntegration/paypal/invoices.js`

```js
import "server-only";
import { paypal } from "./index";

const BRAND = {
  business_name: "VENEZUELA VOYAGES",
  website: "https://venezuelavoyages.com",
  logo_url: "https://venezuelavoyages.com/images/venezuela-voyages-logo.png",
  tax_id: process.env.PAYPAL_TAX_ID || undefined,   // RIF
  phones: [{ country_code: "58", national_number: "4264034052", phone_type: "MOBILE" }],
  address: { address_line_1: "Caracas", admin_area_1: "Distrito Capital", country_code: "VE" },
  // ⚠️ NO poner email_address: debe ser la cuenta PayPal real o el PUT
  //    devuelve USER_NOT_FOUND. Verificado en producción.
};

/**
 * Construye la factura desde una cotización.
 * El importe SIEMPRE sale de la fila de BD, nunca del cliente (R3).
 * D5: se fuerza USD — las cotizaciones en EUR se facturan en dólares.
 */
export function buildInvoiceFromQuotation(q, { invoiceNumber, depositPct = null }) {
  const items = (q.items || []).map((it) => ({
    name: String(it.description || "Travel service").slice(0, 200),
    description: it.details?.summary ? String(it.details.summary).slice(0, 1000) : undefined,
    quantity: String(it.quantity ?? 1),
    unit_amount: { currency_code: "USD", value: Number(it.unit_price ?? it.total ?? 0).toFixed(2) },
    unit_of_measure: "QUANTITY",
  }));

  const invoice = {
    detail: {
      invoice_number: invoiceNumber,
      reference: q.quotation_number,          // ata la factura a la cotización
      invoice_date: new Date().toISOString().slice(0, 10),
      currency_code: "USD",
      note: q.customer_notes || "Thank you for choosing Venezuela Voyages.",
      // ⚠️ el campo es terms_and_conditions, NO "term": PayPal descarta "term"
      //    EN SILENCIO, sin error. Verificado en producción.
      terms_and_conditions: q.terms_and_conditions || undefined,
      memo: q.internal_notes || undefined,    // privado, el cliente no lo ve
      payment_term: { term_type: "NET_30" },
    },
    invoicer: BRAND,
    primary_recipients: [{
      billing_info: {
        name: splitName(q.metadata?.customer_name),
        email_address: q.metadata?.customer_email,
      },
    }],
    items,
    configuration: {
      allow_tip: false,
      tax_inclusive: false,
      // D1: 100 % por defecto. El anticipo queda disponible, apagado.
      partial_payment: depositPct
        ? {
            allow_partial_payment: true,
            minimum_amount_due: {
              currency_code: "USD",
              value: (Number(q.total) * (depositPct / 100)).toFixed(2),
            },
          }
        : { allow_partial_payment: false },
    },
  };

  return invoice;
}

function splitName(full) {
  const parts = String(full || "Customer").trim().split(/\s+/);
  return { given_name: parts[0], surname: parts.slice(1).join(" ") || parts[0] };
}

export const nextInvoiceNumber = () =>
  paypal("/v2/invoicing/generate-next-invoice-number", { method: "POST" })
    .then((r) => r.invoice_number);

export const createInvoice = (body, requestId) =>
  paypal("/v2/invoicing/invoices", { method: "POST", body, requestId });

export const getInvoice = (id) => paypal(`/v2/invoicing/invoices/${id}`);

/** send_to_recipient:false → genera el link SIN enviar email (flujo por WhatsApp). */
export const sendInvoice = (id, notify = false) =>
  paypal(`/v2/invoicing/invoices/${id}/send`, {
    method: "POST",
    body: { send_to_recipient: notify, send_to_invoicer: false },
  });

export const remindInvoice = (id, subject, note) =>
  paypal(`/v2/invoicing/invoices/${id}/remind`, {
    method: "POST",
    body: { subject, note, send_to_invoicer: false },
  });

export const cancelInvoice = (id, note) =>
  paypal(`/v2/invoicing/invoices/${id}/cancel`, {
    method: "POST",
    body: { send_to_recipient: false, send_to_invoicer: false, note },
  });
```

---

## 4. Endpoint — `app/api/crm/quotations/[id]/payment-link/route.js`

```js
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import {
  buildInvoiceFromQuotation, nextInvoiceNumber,
  createInvoice, sendInvoice, getInvoice,
} from "@/lib/paymentIntegration/paypal/invoices";

export async function POST(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const notify = body.notify === true;            // false = solo link
  const depositPct = body.deposit_pct || null;    // D1: null = 100 %

  const admin = createAdminClient();
  const { data: q } = await admin.from("quotations").select("*").eq("id", id).single();
  if (!q) return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });

  if (!q.metadata?.customer_email)
    return NextResponse.json({ error: "La cotización no tiene email de cliente" }, { status: 400 });

  // I1: el índice parcial ya lo impide en BD; esto da un error legible.
  const { data: live } = await admin
    .from("payment_links").select("id,url,status")
    .eq("quotation_id", id)
    .in("status", ["created", "sent", "viewed", "partially_paid"])
    .maybeSingle();
  if (live)
    return NextResponse.json(
      { error: "Ya existe un cobro activo para esta cotización", link: live },
      { status: 409 },
    );

  const invoiceNumber = await nextInvoiceNumber();
  const payload = buildInvoiceFromQuotation(q, { invoiceNumber, depositPct });

  // Idempotencia: mismo request-id → PayPal no duplica la factura
  const created = await createInvoice(payload, `quo-${id}-${invoiceNumber}`);
  const invoiceId = created.href.split("/").pop();

  await sendInvoice(invoiceId, notify);          // UNPAID + genera el link
  const full = await getInvoice(invoiceId);

  const { data: link, error } = await admin.from("payment_links").insert({
    quotation_id: id,
    lead_id: q.lead_id || null,
    provider: "paypal",
    external_id: invoiceId,
    url: full.detail?.metadata?.recipient_view_url,
    merchant_url: full.detail?.metadata?.invoicer_view_url,
    amount: Number(q.total),
    currency: "USD",
    concept: `Cotización ${q.quotation_number}`,
    status: "sent",
    customer_name: q.metadata?.customer_name,
    customer_email: q.metadata?.customer_email,
    created_by: user.id,
    metadata: { invoice_number: invoiceNumber, notified: notify },
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: link }, { status: 201 });
}
```

---

## 5. Webhook — `app/api/webhook/paypal/route.js`

```js
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/server";

export async function POST(request) {
  // R4: la firma se calcula sobre el cuerpo CRUDO. Si parseas antes, no valida.
  // Mismo patrón que app/api/stripe/webhook/route.js.
  const raw = await request.text();
  const h = (k) => request.headers.get(k);

  const verify = await fetch(
    `${process.env.PAYPAL_ENV === "live"
      ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: h("paypal-auth-algo"),
        cert_url: h("paypal-cert-url"),
        transmission_id: h("paypal-transmission-id"),
        transmission_sig: h("paypal-transmission-sig"),
        transmission_time: h("paypal-transmission-time"),
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(raw),
      }),
    },
  ).then((r) => r.json());

  if (verify.verification_status !== "SUCCESS")
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });

  const event = JSON.parse(raw);
  const admin = createAdminClient();

  // I6: PayPal reintenta. Sin esto, un pago se contaría dos veces.
  const { error: dup } = await admin
    .from("payment_webhook_events")
    .insert({ event_id: event.id, event_type: event.event_type, payload: event });
  if (dup?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });

  const invoiceId = event.resource?.invoice?.id || event.resource?.id;
  if (!invoiceId) return NextResponse.json({ ok: true });

  const MAP = {
    "INVOICING.INVOICE.PAID": "paid",
    "INVOICING.INVOICE.CANCELLED": "cancelled",
    "INVOICING.INVOICE.REFUNDED": "refunded",
    "INVOICING.INVOICE.UPDATED": null,
  };
  const status = MAP[event.event_type];
  if (!status) return NextResponse.json({ ok: true });

  const paid = Number(event.resource?.invoice?.payments?.paid_amount?.value ?? 0);

  const { data: link } = await admin.from("payment_links")
    .update({
      status,
      amount_paid: paid,
      paid_at: status === "paid" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("provider", "paypal").eq("external_id", invoiceId)
    .select("quotation_id, amount").single();

  // D2: la cotización refleja el pago
  if (link?.quotation_id && status === "paid") {
    await admin.from("quotations").update({
      status: "paid",
      amount_paid: paid,
      paid_at: new Date().toISOString(),
    }).eq("id", link.quotation_id);
  }

  return NextResponse.json({ ok: true });
}
```

Eventos a suscribir en el panel: `INVOICING.INVOICE.PAID`,
`INVOICING.INVOICE.CANCELLED`, `INVOICING.INVOICE.REFUNDED`.

---

## 6. QR en el PDF (D3) — `app/api/crm/quotations/[id]/pdf/route.js`

Se usa la librería **local** `qrcode`, que ya está en `package.json`. La API de
PayPal también genera QR, pero devuelve `multipart/form-data` — más código para
el mismo resultado, y una llamada de red extra.

```js
import QRCode from "qrcode";

/** Bloque de pago con QR. Se dibuja en la última página, tras drawPolicies. */
async function drawPaymentQR(doc, page, y, paymentUrl, fonts) {
  if (!paymentUrl) return { page, y };

  const dataUrl = await QRCode.toDataURL(paymentUrl, { width: 320, margin: 1 });
  const png = await doc.embedPng(Buffer.from(dataUrl.split(",")[1], "base64"));
  const size = 110;

  page.drawText("Pay online", { x: PAD, y: y - 20, size: 14, font: fonts.bold });
  page.drawText("Scan the code with your phone camera to pay securely.", {
    x: PAD, y: y - 38, size: 9, font: fonts.reg,
  });
  page.drawImage(png, { x: PAD, y: y - 38 - size - 8, width: size, height: size });

  return { page, y: y - 38 - size - 24 };
}
```

Y en `generatePDF`, después de `drawPolicies`:

```js
const { data: link } = await admin
  .from("payment_links").select("url")
  .eq("quotation_id", q.id).in("status", ["sent", "viewed", "partially_paid"])
  .maybeSingle();

({ page, y } = await drawPaymentQR(doc, page, y, link?.url, fonts));
```

> **Orden importante**: el cobro se genera **antes** que el PDF, o el QR sale
> vacío. En la UI, *Generar cobro* debe preceder a *Enviar al cliente*; si el
> asesor lo hace al revés, el PDF se regenera al enviar y el QR entra igual.

---

## 7. UI — bloque de cobro

`app/(pages)/dashboard/quotations/[id]/page.js`, en el sidebar junto a
"Acciones" (~línea 408):

```
┌─ Cobro ───────────────────────────────┐
│  Sin cobro generado                    │
│  ┌──────────────────────────────────┐  │
│  │      Generar cobro  $3,358.00    │  │
│  └──────────────────────────────────┘  │
│  ☐ Cobrar solo un anticipo  [ 30 ]%    │   ← apagado por D1
│  ☐ Que PayPal envíe el email           │   ← apagado por D4
└────────────────────────────────────────┘

┌─ Cobro ───────────────────────────────┐
│  ● Enviado · $3,358.00 USD             │
│  https://paypal.com/invoice/p/#5CX4…   │
│  [ Copiar link ]  [ Recordar ]         │
│  Ver en PayPal ↗      [ Cancelar ]     │
└────────────────────────────────────────┘

┌─ Cobro ───────────────────────────────┐
│  ✅ PAGADO · $3,358.00 · 15 ago 2026   │
│  [ Convertir a voucher → ]             │
└────────────────────────────────────────┘
```

**I2 — bloquear edición.** Si hay cobro activo, `updateQuotationItemsAction`
debe rechazar el cambio. Si no, el PDF que recibió el cliente y la factura de
PayPal divergen y acaba pagando un importe distinto al que se le mandó.

**Botón de pago en el email** — en el HTML de
`app/api/crm/quotations/[id]/send/route.js`, junto al adjunto que ya existe:

```html
<a href="${paymentUrl}" style="display:inline-block;background:#F2A93B;
   color:#0A1A44;padding:14px 28px;border-radius:8px;font-weight:700;
   text-decoration:none;">Pay now · $3,358.00 USD</a>
```

**`/dashboard/payments`** — listado con filtro por estado. Es la pantalla que
responde *"¿quién me debe dinero?"*, que hoy no existe en el CRM.

---

## 8. Variables de entorno

```
PAYPAL_ENV=sandbox          # sandbox | live
PAYPAL_CLIENT_ID=
PAYPAL_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_TAX_ID=              # RIF, opcional
```

---

## 9. Orden de trabajo

| # | Paso | Días |
|---|---|---:|
| 1 | Rotar secret · país de la cuenta · app sandbox · webhook con ngrok | 0,5 |
| 2 | Migraciones + cliente + `invoices.js` | 1 |
| 3 | Endpoint `payment-link` + bloqueo de edición (I2) | 0,5 |
| 4 | Webhook + idempotencia + estados | 1 |
| 5 | UI: bloque de cobro + badge en el listado | 1 |
| 6 | QR en el PDF + botón en el email | 0,5 |
| 7 | `/dashboard/payments` | 0,5 |
| 8 | QA sandbox: pago, cancelación, reembolso, webhook duplicado, doble clic | 0,5 |
| | **TOTAL** | **5,5** |

---

## 10. Checklist de QA

- [ ] Doble clic en *Generar cobro* → **una** factura (índice parcial + `PayPal-Request-Id`)
- [ ] Pago completo → cotización a `paid`, `amount_paid` correcto
- [ ] Webhook reenviado dos veces → el importe **no** se duplica
- [ ] Webhook con firma manipulada → 401
- [ ] Cancelar factura → cotización vuelve a estado editable
- [ ] QR del PDF escaneado con el móvil → abre la página de pago correcta
- [ ] Cotización en EUR → se factura en USD (D5) y el importe cuadra
- [ ] Editar items con cobro activo → rechazado con mensaje claro
- [ ] Cobro sin `customer_email` → error legible, no 500
