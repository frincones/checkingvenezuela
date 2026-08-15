# Plan: Módulo de links de pago con PayPal

**Objetivo**: generar un link de pago por cualquier monto y enviarlo al cliente
para que pague sin pasar por el sitio.
**Estado**: propuesta. Sin cambios de código todavía.

---

## 0. Dos cosas que hay que verificar antes de escribir una línea

### 🔴 B1 — Rotar la Secret key

La clave `EN7I6iS8jnk…` es **de producción** y se compartió en texto plano. Con
ella se puede cobrar y mover dinero en la cuenta real.

**Apps & Credentials → Turismo → Add Second Key**, y revocar la anterior. PayPal
permite dos claves activas justo para rotar sin downtime.

### 🔴 B2 — ¿En qué país está registrada la cuenta de negocio?

`mssimporta@gmail.com`. Si la cuenta está registrada **en Venezuela**, el
problema no es cobrar sino **retirar**: por los controles cambiarios, sacar
fondos de PayPal a un banco venezolano está severamente restringido. El dinero
entra y se queda dentro.

Esto no se arregla con código. Si la cuenta es venezolana, hay que decidir antes:
cuenta en otra jurisdicción, o descartar PayPal y quedarse con Stripe (que ya
está integrado).

**Verificable en 30 segundos**: PayPal → Perfil → Información de la cuenta → País.

---

## 1. Las tres formas de hacerlo, y por qué solo dos sirven

Investigado en la documentación de PayPal (agosto 2026).

### ❌ Orders API v2 — descartada por caducidad

Es la opción que casi todo el mundo elige primero: creas una orden y la respuesta
trae un enlace `payer-action`
(`https://www.paypal.com/checkoutnow?token=…`) que puedes enviar.

**El problema**: ese enlace **caduca a las 6 horas**. Para un flujo donde Emma
manda el link por WhatsApp y el cliente paga esa noche, mañana o el lunes, es
inservible. Se descarta por esto, no por complejidad.

### ✅ Invoicing API v2 — recomendada como base

`POST /v2/invoicing/invoices` → `POST /v2/invoicing/invoices/{id}/send`

| | |
|---|---|
| Enlace | PayPal **aloja la página** y **envía el email al cliente** por ti |
| Caducidad | No caduca; el estado vive en PayPal (`DRAFT`→`SENT`→`PAID`) |
| **Pagos parciales** | **Sí** — decisivo, ver abajo |
| Recordatorios | `POST /{id}/remind` sobre facturas `SENT`, `UNPAID` o `PARTIALLY_PAID` |
| Elegibilidad | Cualquier cuenta business. Sin aprobación previa |
| Webhook | `INVOICING.INVOICE.PAID`, `INVOICING.INVOICE.CANCELLED`, … |

**Por qué los pagos parciales deciden**: tus propios Términos y Condiciones dicen
*"los pagos deben completarse 60 días antes de la llegada"* y la política de
devolución habla de **anticipo**. O sea: el negocio ya funciona con depósito +
saldo. La Invoicing API lo soporta nativamente; los links de pago no.

Y para un cargo de $9 348 —tu cotización más alta— una factura es el documento
correcto, no un botón de "comprar ahora".

### ✅ Payment Links API — complemento para cobros rápidos

`POST /v1/checkout/payment-resources` → devuelve `payment_link`

| | |
|---|---|
| Enlace | URL corta compartible, `reusable: MULTIPLE`, sin caducidad documentada |
| Monto | Lo fija el comercio en `line_items[].unit_amount.value` |
| ⚠️ Elegibilidad | La doc dice *"para plataformas, partners y comercios grandes"*. **Tu app ya lista "Payment links and buttons" como capacidad** — hay que confirmar que está activada y que el endpoint responde |
| Limitación | Sin pagos parciales, sin recordatorios, sin destinatario específico |

Encaja para: cobrar un extra acordado por WhatsApp, un depósito suelto, un
traslado. No para la venta principal.

> **Ojo con el "monto que pone el cliente"**: existe, pero **solo en el panel
> no-code**, no por API. Por API el monto siempre lo fija el comercio — que es
> justo lo que quieres: tú cotizas $1 595 y mandas el link por $1 595.

---

## 2. Recomendación

**Invoicing API como motor principal + Payment Links para cobros sueltos**,
detrás de una interfaz única en el dashboard para que Emma no tenga que saber
cuál es cuál.

```
Cotización  ──►  [Generar link de pago]  ──►  Factura PayPal  ──►  email + link
   $1 595                                      (parcial o total)

Cobro suelto ──► [Nuevo link de pago]  ──►  Payment Link  ──►  copiar y pegar
   $150                                                          en WhatsApp
```

El selector en la UI no debería preguntar "¿invoice o payment link?" sino
**"¿a un cliente concreto (con seguimiento) o un link genérico?"**.

---

## 3. Riesgos y decisiones

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | **Cuenta registrada en Venezuela → no se puede retirar** | Verificar B2 **antes** de construir nada |
| R2 | Elegibilidad de Payment Links API no confirmada | Probar el endpoint en sandbox el día 1. Si da 403, el módulo funciona igual solo con Invoicing |
| R3 | **Manipulación del monto** | El importe se lee **siempre de la BD en el servidor**, nunca del cliente. Regla no negociable |
| R4 | **Webhook falsificado** | Verificar firma contra `/v1/notifications/verify-webhook-signature`. Requiere el **raw body**: en Next.js App Router, `await req.text()` antes de parsear, como ya hace `app/api/stripe/webhook/route.js` |
| R5 | Doble creación de links por doble clic | Cabecera `PayPal-Request-Id` (idempotencia de PayPal) + índice único por cotización |
| R6 | Cotizaciones en **EUR** (tienes 2) | PayPal soporta 23+ monedas, pero la cuenta debe tener saldo/conversión en EUR. Confirmar o forzar USD |
| R7 | Sandbox vs live | Solo tienes credenciales **live**. Crear una app sandbox y desarrollar ahí. `PAYPAL_ENV` decide la URL base |
| R8 | No hay webhooks configurados | El panel dice *"You do not have any events for the selected application"*. Hay que crearlos, y necesitan una URL pública (ngrok en local) |

---

## 4. Modelo de datos

Una tabla nueva. No se mete en `quotations` porque un link puede existir sin
cotización, y una cotización puede tener varios (depósito + saldo).

```sql
CREATE TABLE public.payment_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- origen: cotización, voucher o suelto
  quotation_id      UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  lead_id           UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  provider          TEXT NOT NULL DEFAULT 'paypal',
  kind              TEXT NOT NULL CHECK (kind IN ('invoice','link')),

  -- identificadores de PayPal
  external_id       TEXT NOT NULL,          -- invoice id o payment-resource id
  url               TEXT NOT NULL,          -- lo que se le manda al cliente

  -- importe: fuente de verdad del lado servidor
  amount            NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency          TEXT NOT NULL DEFAULT 'USD',
  concept           TEXT NOT NULL,

  status            TEXT NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created','sent','viewed','partially_paid',
                                      'paid','cancelled','refunded','expired')),
  amount_paid       NUMERIC(10,2) NOT NULL DEFAULT 0,

  customer_email    TEXT,
  customer_name     TEXT,
  created_by        UUID REFERENCES public.profiles(id),
  paid_at           TIMESTAMPTZ,
  metadata          JSONB DEFAULT '{}',     -- payload crudo de PayPal
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_payment_links_external ON public.payment_links(provider, external_id);
CREATE INDEX idx_payment_links_quotation ON public.payment_links(quotation_id);
CREATE INDEX idx_payment_links_status ON public.payment_links(status);
```

`provider` está desde el día 1 para que Stripe pueda entrar después sin migración.

**Nota**: `quotation_status` no tiene estado `paid`. Cuando llegue el webhook, la
cotización debería pasar a `accepted` (o `converted` si además se genera voucher).
Decisión a confirmar.

---

## 5. Arquitectura

```
lib/paymentIntegration/paypal/
  index.js        cliente OAuth2 + caché del access token (expira en ~9h)
  invoices.js     create / send / remind / cancel / get
  links.js        payment-resources: create / list / delete
  webhook.js      verificación de firma

app/api/payments/
  links/route.js          POST crear · GET listar
  links/[id]/route.js     GET detalle · DELETE cancelar
  links/[id]/remind/route.js
app/api/webhook/paypal/route.js    receptor + verificación

app/(pages)/dashboard/payments/
  page.js         listado con estados
  new/page.js     formulario de link suelto
app/(pages)/dashboard/quotations/[id]/   botón "Generar link de pago"
```

Variables de entorno:

```
PAYPAL_ENV=sandbox|live
PAYPAL_CLIENT_ID=
PAYPAL_SECRET=
PAYPAL_WEBHOOK_ID=
```

Base URL según `PAYPAL_ENV`: `api-m.sandbox.paypal.com` / `api-m.paypal.com`.

**El token OAuth se cachea en memoria** (dura ~9h). Pedir uno por request es el
error más común y multiplica la latencia.

---

## 6. Fases

| Fase | Qué | Días |
|---|---|---:|
| **0** | Rotar la secret (B1) · verificar país de la cuenta (B2) · crear app sandbox · **probar si `payment-resources` responde** (R2) | 0,5 |
| **1** | Migración `payment_links` + cliente PayPal (OAuth + caché) + `invoices.js` | 1 |
| **2** | API interna: crear/listar/cancelar/recordar. Importe siempre desde BD (R3) | 0,5 |
| **3** | Webhook con verificación de firma + actualización de estado + email a Emma | 1 |
| **4** | UI: listado, formulario de link suelto, botón en la cotización | 1 |
| **5** | Payment Links API como segundo `kind` — **solo si R2 sale bien** | 0,5 |
| **6** | QA en sandbox: pago total, parcial, cancelado, reembolso, webhook duplicado | 0,5 |
| | **TOTAL** | **4–5** |

El hito útil está al final de la fase 4: Emma ya puede cobrar. La fase 5 es
comodidad.

---

## 7. Detalles que suelen romper esto

1. **Raw body en el webhook.** Next.js App Router: `const raw = await req.text()`
   y verificar sobre esa cadena. Si parseas antes, la firma no valida.
2. **El simulador de webhooks de PayPal usa un Webhook ID especial** y sus
   eventos **no pasan** la verificación de firma. Para probar de verdad hacen
   falta eventos reales de sandbox.
3. **Idempotencia del webhook.** PayPal reintenta. Guardar el `event.id` y
   descartar repetidos, o un pago contará dos veces.
4. **El webhook necesita URL pública** en desarrollo: ngrok o similar.
5. **Un solo webhook para ambos tipos**: los eventos de invoice
   (`INVOICING.*`) y los de captura (`PAYMENT.CAPTURE.COMPLETED`) llegan al mismo
   endpoint; hay que enrutar por `event_type`.
6. **Nunca confiar en el `return_url`.** El cliente puede no volver, o volver sin
   haber pagado. El estado real lo dicta el webhook.

---

## 8. Alternativa si B2 sale mal

Si la cuenta es venezolana y no se puede retirar, **Stripe ya está integrado** en
el repo (`lib/paymentIntegration/stripe/`, webhook incluido) y tiene Payment
Links propios (`POST /v1/payment_links`), con un modelo casi idéntico al de este
plan. El diseño de la tabla `payment_links` con `provider` desde el día 1 hace
que ese cambio sea de un adaptador, no del módulo entero.
