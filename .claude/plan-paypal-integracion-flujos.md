# Integración de cobros PayPal en los flujos del CRM

**Base**: [`plan-paypal-payment-links.md`](./plan-paypal-payment-links.md) (decisión: Invoicing API)
**Estado**: propuesta, sin cambios de código
**Método**: lectura del código real + consulta a la BD de producción

---

## 1. El flujo que existe hoy

```
LEADS (11)                    COTIZACIONES (23)                  VOUCHERS (2)
   │                                 │                                │
   │  ⚠️ 0 cotizaciones              ├─ PDF            23/23 ✅        │
   └──── enlazadas ───✗              ├─ Email+PDF      9 enviadas      │
                                     ├─ marcar vista   1 vista         │
                                     ├─ aceptar/rechazar (sin UI)      │
                                     └─ convertir ─────────────────────┘
                                            1 convertida

                        ❌ EN NINGÚN PUNTO SE COBRA
```

### Lo que dicen los datos reales

| Hecho | Consecuencia para el diseño |
|---|---|
| **23 de 23 cotizaciones NO tienen `lead_id`** | El CRM está desconectado en la práctica: el asesor crea cotizaciones sueltas, no parte del lead. **El cobro debe colgar de la cotización, no del lead** |
| **23 de 23 tienen `metadata.customer_email`** | ✅ Siempre hay a quién facturar sin pedir datos extra |
| **23 de 23 tienen `pdf_url`** | El PDF ya está resuelto y guardado en Storage |
| Estados: 12 `draft`, 9 `sent`, 1 `viewed`, 1 `converted` | Nadie usa `accepted`/`rejected`: los server actions existen pero **no tienen botón en la UI** |
| Totales de **$337 a $9 348**, en USD y **EUR** | Hay que decidir qué pasa con las 2 cotizaciones en EUR |
| `quotation_status` **no tiene `paid`** | Falta un estado. Ver decisión D2 |

### Cómo se envía hoy

`POST /api/crm/quotations/[id]/send` → genera el PDF, lo adjunta, lo manda con
Resend, y pasa `draft` → `sent`. El email ya tiene HTML propio con la marca.
**Ahí es donde entra el botón de pago**, no hay que inventar un email nuevo.

---

## 2. El flujo objetivo

```
COTIZACIÓN
    │
    ├─[Generar cobro]──► Factura PayPal ──► link
    │                      │  total o depósito %
    │                      │
    │                      ├─ copiar link  → WhatsApp   (asesor)
    │                      └─ enviar email → PayPal lo manda
    │
    ├─[Enviar al cliente]─► email + PDF + 🆕 BOTÓN "Pay now"
    │
    └─ webhook PayPal ──► pagado ──► cotización `paid` / `partially_paid`
                            │
                            ├─ email de confirmación al cliente
                            ├─ aviso al asesor
                            └─ desbloquea [Convertir a voucher]
```

La idea rectora: **el asesor no elige "PayPal"**. Ve un botón *Cobrar* y decide
**cuánto** (total o depósito) y **cómo lo entrega** (copiar link / que lo mande
PayPal). El proveedor es un detalle de implementación.

---

## 3. Qué hay que implementar

### 3.1 Supabase

**Tabla `payment_links`** — la del plan base, con `quotation_id` ya previsto.

**Estado de pago en la cotización.** Dos columnas nuevas, más baratas que tocar
el enum en cada consulta:

```sql
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at     TIMESTAMPTZ;
```

Y el estado nuevo en el enum (ver decisión D2):

```sql
ALTER TYPE quotation_status ADD VALUE IF NOT EXISTS 'paid';
```

> ⚠️ `ALTER TYPE ... ADD VALUE` **no puede ir dentro de una transacción** en
> Postgres. Migración en su propio archivo, suelta.

### 3.2 Backend

| Ruta | Qué hace |
|---|---|
| `POST /api/crm/quotations/[id]/payment-link` | Crea la factura PayPal desde la cotización. **El importe se lee de la BD**, nunca del cliente. Acepta `{ mode: 'full' \| 'deposit', deposit_pct }` |
| `GET /api/payments/links` · `[id]` | Listado y detalle |
| `POST /api/payments/links/[id]/remind` | Recordatorio (solo `UNPAID`/`PARTIALLY_PAID`) |
| `DELETE /api/payments/links/[id]` | Cancelar |
| `POST /api/webhook/paypal` | Verificación de firma + actualización de estado |

`lib/paymentIntegration/paypal/` — cliente OAuth con caché de token,
`invoices.js`, `webhook.js`.

**Mapeo cotización → factura** (ya validado contra la API real):

| Cotización | Campo PayPal |
|---|---|
| `quotation_number` | `detail.reference` |
| `items[]` (`description`, `quantity`, `unit_price`) | `items[]` |
| `total`, `currency` | importe |
| `metadata.customer_name` / `customer_email` | `primary_recipients[0].billing_info` |
| `terms_and_conditions` | `detail.terms_and_conditions` |
| `customer_notes` | `detail.note` |
| `internal_notes` | `detail.memo` (privado) |
| Marca fija | `invoicer.*` — logo, RIF, web, teléfono |

### 3.3 Frontend

**a) Bloque "Cobro" en `/dashboard/quotations/[id]`** — sidebar, junto a
"Acciones" (línea ~408). Sin cobro: botón *Generar cobro*. Con cobro: estado,
importe pagado/pendiente, link copiable, *Recordar* y *Cancelar*.

**b) Modal de generación** — total o depósito (% configurable), y si lo envía
PayPal o lo copia el asesor.

**c) Botón de pago en el email existente** — en el HTML de
`send/route.js`, si la cotización ya tiene link activo.

**d) `/dashboard/payments`** — listado global con filtro por estado. Es la
pantalla que le dice a Emma *quién debe dinero*, que hoy no existe.

**e) Badge de pago** en el listado `/dashboard/quotations`.

### 3.4 Lo que NO hay que tocar

El generador de PDF, el envío por Resend, los vouchers y el modelo de items
siguen igual. La integración es aditiva.

---

## 4. Decisiones a tomar

| # | Decisión | Recomendación |
|---|---|---|
| **D1** | ¿Depósito por defecto? | **30 %**, editable al generar. Encaja con tu política de anticipo no reembolsable |
| **D2** | ¿Estado al pagar? | Añadir `paid` al enum. `accepted` significa "el cliente dijo que sí", `paid` es otra cosa y conviene distinguirlas |
| **D3** | ¿El PDF lleva el link? | **Sí, como QR** en la última página. El cliente abre el PDF en el móvil y paga. PayPal genera el QR (`/generate-qr-code`) |
| **D4** | ¿Quién envía? | Por defecto **copiar link** (así trabajáis hoy, por WhatsApp). Email de PayPal como opción |
| **D5** | Las 2 cotizaciones en **EUR** | Confirmar que la cuenta acepta EUR, o forzar USD al facturar |
| **D6** | ¿Pago total → voucher automático? | **No.** Que lo dispare el asesor. Automatizarlo esconde errores |
| **D7** | Cotizaciones sin lead (23/23) | El cobro cuelga de la cotización. Si algún día hay `lead_id`, se refleja también ahí |

---

## 5. Fases

| Fase | Qué | Días |
|---|---|---:|
| **0** | Rotar secret · verificar país de la cuenta · app sandbox | 0,5 |
| **1** | Migraciones + cliente PayPal + `invoices.js` | 1 |
| **2** | `POST /quotations/[id]/payment-link` + mapeo · importe desde BD | 0,5 |
| **3** | Webhook con firma + estados + emails de confirmación | 1 |
| **4** | UI: bloque de cobro, modal, badge en listado | 1 |
| **5** | Botón de pago en el email + QR en el PDF (D3) | 0,5 |
| **6** | `/dashboard/payments` | 0,5 |
| **7** | QA sandbox: total, parcial, cancelado, reembolso, webhook duplicado | 0,5 |
| | **TOTAL** | **5,5** |

Emma puede cobrar al final de la fase 4.

---

## 6. Riesgos propios de esta integración

| # | Riesgo | Mitigación |
|---|---|---|
| I1 | **Doble cobro**: generar dos facturas para la misma cotización | Una sola factura activa por cotización. Para el saldo, se marca la primera como pagada y se crea la del resto explícitamente |
| I2 | El asesor edita los items **después** de generar la factura | Bloquear la edición si hay factura activa, o cancelar y regenerar. **No dejar que diverjan** |
| I3 | Cotización `expired` con factura viva | Al expirar, cancelar la factura |
| I4 | El importe de la factura no cuadra con el PDF ya enviado | Todo sale de la misma fila. Nunca recalcular en el cliente |
| I5 | Pago parcial y nadie persigue el saldo | `/dashboard/payments` con filtro `partially_paid` + recordatorios |
| I6 | Webhook duplicado suma dos veces | Guardar `event.id` y descartar repetidos |

---

## 7. Lo que esto arregla de paso

- **`/dashboard/payments` es la primera pantalla de cobros** del CRM: hoy no hay
  forma de saber quién debe.
- Los server actions `acceptQuotationAction` / `rejectQuotationAction` **existen
  sin UI**. El bloque de cobro es el sitio natural para exponerlos.
- El desacople **lead ↔ cotización** (23/23 sin `lead_id`) queda documentado.
  No lo arregla este trabajo, pero conviene decidir si el asesor debería partir
  siempre del lead.
