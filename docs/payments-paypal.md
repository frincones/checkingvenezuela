# Cobros con PayPal

Genera un enlace de pago desde una cotización, lo comparte por WhatsApp o email,
y refleja el pago en el CRM.

---

## Puesta en marcha

### 1. Migraciones — ✅ aplicadas

`20260815_payment_links.sql` y `20260815b_quotation_status_paid.sql`.
La segunda va **sola**: `ALTER TYPE ... ADD VALUE` no admite transacción.

### 2. Credenciales

PayPal Developer → **Apps & Credentials**. Para desarrollar, crea una app en
**Sandbox**; no uses las de producción para probar.

```
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
PAYPAL_TAX_ID=J-XXXXXXXXX     # RIF, opcional: sale impreso en la factura
```

La app debe tener activada la capacidad **Invoicing**. Se comprueba con:

```bash
node scripts/paypal/doctor.mjs
```

### 3. Webhook

Necesita una URL pública. En local, ngrok:

```bash
ngrok http 3000
node scripts/paypal/setup-webhook.mjs --url https://xxxx.ngrok-free.app/api/webhook/paypal --apply
```

En producción:

```bash
node scripts/paypal/setup-webhook.mjs --url https://venezuelavoyages.com/api/webhook/paypal --apply
```

El script imprime el `PAYPAL_WEBHOOK_ID`. Cópialo a `.env` **y a las variables
de entorno de Vercel**. Es idempotente: re-ejecutarlo no crea duplicados.

### 4. Comprobar

```bash
node scripts/paypal/doctor.mjs     # debe salir todo en verde
```

---

## Cómo se usa

1. Abrir una cotización en `/dashboard/quotations/[id]`
2. Bloque **Cobro** → *Generar cobro*
3. *Copiar enlace* y pegarlo en WhatsApp, o marcar
   *Que PayPal envíe el email al cliente*
4. El PDF de la cotización incluye un **QR** que abre la misma página de pago
5. El email de la cotización incluye un botón **Pagar ahora**
6. Al pagar, el webhook marca el cobro y la cotización como `paid`
7. `/dashboard/payments` responde *"¿quién me debe dinero?"*

---

## Decisiones

| | |
|---|---|
| **Invoicing API**, no Orders | El enlace `payer-action` de Orders **caduca a las 6 h** — inservible para mandarlo por WhatsApp |
| **Invoicing**, no Payment Links | Payment Links funciona en esta cuenta, pero no tiene recordatorios, ni seguimiento por cliente, ni pago parcial |
| **100 %** por defecto | El anticipo existe (casilla *Cobrar solo un anticipo*) pero está apagado |
| **Siempre USD** | Hay cotizaciones en EUR; se facturan en dólares y queda constancia en `metadata.original_currency` |
| **Sin email por defecto** | `send_to_recipient:false` genera el enlace sin que PayPal escriba a nadie. Los asesores comparten por WhatsApp |

---

## Idioma de la factura

**La API no permite fijarlo.** Se probaron `detail.locale`, `detail.language` y
`detail.locale_code` contra la API real: los tres se descartan **en silencio**.

Los rótulos del documento ("Amount due", "Invoice", "Bill to") los decide PayPal
según **el idioma de la cuenta del comercio**. Para que salgan en inglés hay que
cambiarlo en **PayPal → Perfil → Idioma / Preferencias**.

Lo que sí controlamos va en inglés desde el código: nota al cliente, condiciones
y datos del emisor.

**Excepción conocida**: los nombres de las líneas salen de
`quotations.items[].description`, que es el snapshot de la cotización. Si la
cotización se creó en español, la línea aparecerá en español ("Relámpago del
Catatumbo"). No se traduce automáticamente porque son importes y descripciones
comerciales ya pactadas con el cliente: cambiarlos al vuelo sería alterar el
documento. Las cotizaciones nuevas deberían redactarse en inglés.

---

## Detalles que rompen esto si se tocan

**`terms_and_conditions`, no `term`.** PayPal **descarta `term` en silencio**,
sin devolver error. Se enviarían facturas sin condiciones sin enterarse.

**No poner `invoicer.email_address`.** Tiene que ser la cuenta PayPal real. Con
un alias, el POST lo acepta pero cualquier PUT falla con `USER_NOT_FOUND`.

**El webhook se verifica sobre el cuerpo CRUDO.** `await request.text()` antes
de parsear. Si se parsea primero, la firma no valida nunca.

**El simulador de webhooks de PayPal no pasa la verificación de firma** — usa un
webhook id especial. Para probar de verdad hacen falta eventos reales de sandbox.

**El importe sale siempre de la BD.** Nunca del cuerpo de la petición.

---

## Garantías que están en la base de datos, no en el código

| Riesgo | Dónde se impide |
|---|---|
| Dos cobros para la misma cotización | Índice único parcial `idx_payment_links_one_active` |
| Un webhook contado dos veces | `payment_webhook_events.event_id` es PK |
| Editar items con cobro vivo | `lib/payments/quotationGuard.js`, usado por los **dos** caminos que editan |

---

## Archivos

```
lib/paymentIntegration/paypal/
  index.js       OAuth + caché de token (~9 h) + wrapper HTTP
  invoices.js    build/create/send/remind/cancel + mapeo cotización→factura
lib/payments/quotationGuard.js       bloqueo de edición

app/api/crm/quotations/[id]/payment-link/   GET estado · POST generar
app/api/payments/links/                     GET listado
app/api/payments/links/[id]/                GET (sincroniza) · DELETE cancelar
app/api/payments/links/[id]/remind/         POST recordatorio
app/api/webhook/paypal/                     receptor

components/dashboard/quotations/PaymentBlock.jsx
app/(pages)/dashboard/payments/page.js

scripts/paypal/doctor.mjs           diagnóstico
scripts/paypal/setup-webhook.mjs    registra el webhook (idempotente)
```

---

## Pendiente

**Verificar el país de registro de la cuenta.** Si es Venezuela, se puede cobrar
pero **retirar a un banco venezolano está restringido** por los controles
cambiarios. Es lo único que puede invalidar el módulo entero, y no se arregla
con código: PayPal → Perfil → País.
