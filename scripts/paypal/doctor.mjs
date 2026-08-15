/**
 * Diagnóstico de la integración de cobros con PayPal.
 *
 * Comprueba, en orden, todo lo que tiene que estar en su sitio para que el
 * módulo funcione. Cada fallo dice qué hacer, no solo que algo falla.
 *
 * Uso: node scripts/paypal/doctor.mjs
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m, fix) => {
  console.log(`  ❌ ${m}`);
  if (fix) console.log(`     → ${fix}`);
  failures++;
};
let failures = 0;

const BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

console.log("\n═══ 1. Variables de entorno ═══");
const required = ["PAYPAL_ENV", "PAYPAL_CLIENT_ID", "PAYPAL_SECRET"];
for (const k of required) {
  if (process.env[k]) ok(`${k} definida`);
  else bad(`${k} no está en .env`, "Copia el bloque PayPal de .env.example");
}
if (process.env.PAYPAL_WEBHOOK_ID) ok("PAYPAL_WEBHOOK_ID definida");
else
  bad(
    "PAYPAL_WEBHOOK_ID no está en .env",
    "Corre: node scripts/paypal/setup-webhook.mjs --url https://TU-DOMINIO/api/webhook/paypal --apply",
  );

console.log(`  · entorno: ${process.env.PAYPAL_ENV || "(sin definir → sandbox)"} → ${BASE}`);

console.log("\n═══ 2. Base de datos ═══");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

for (const [table, cols] of [
  ["payment_links", "id,quotation_id,external_id,url,amount,status,amount_paid"],
  ["payment_webhook_events", "event_id,event_type,resource_id"],
  ["quotations", "id,amount_paid,paid_at"],
]) {
  const { error } = await sb.from(table).select(cols).limit(1);
  if (error) bad(`${table}: ${error.message}`, "Aplica supabase/migrations/20260815_payment_links.sql");
  else ok(`${table}`);
}

{
  const { error } = await sb
    .from("quotations")
    .update({ status: "paid" })
    .eq("id", "00000000-0000-0000-0000-000000000000");
  if (error && /invalid input value/.test(error.message))
    bad("el enum quotation_status no tiene 'paid'", "Aplica 20260815b_quotation_status_paid.sql SOLO");
  else ok("enum quotation_status incluye 'paid'");
}

if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_SECRET) {
  console.log("\n═══ 3. PayPal ═══\n  ⏭️  omitido: faltan credenciales");
  console.log(`\n${failures === 0 ? "Todo en orden." : `${failures} problema(s) por resolver.`}\n`);
  process.exit(failures ? 1 : 0);
}

console.log("\n═══ 3. PayPal ═══");
const auth = Buffer.from(
  `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`,
).toString("base64");

let token = null;
try {
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error);
  token = json.access_token;
  ok(`OAuth (token válido ${Math.round(json.expires_in / 3600)} h)`);

  const scopes = (json.scope || "").split(" ");
  if (scopes.some((s) => s.includes("invoicing"))) ok("permiso 'invoicing' concedido");
  else bad("la app no tiene el permiso 'invoicing'", "Actívalo en Apps & Credentials → Features");
} catch (e) {
  bad(`OAuth falló: ${e.message}`, "Revisa CLIENT_ID/SECRET y que coincidan con PAYPAL_ENV");
}

if (token) {
  const api = (p, o = {}) =>
    fetch(`${BASE}${p}`, {
      ...o,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(o.headers || {}) },
    }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));

  const inv = await api("/v2/invoicing/invoices?page_size=1&total_required=true");
  if (inv.status === 200) ok(`Invoicing API responde (${inv.json.total_items ?? 0} facturas)`);
  else bad(`Invoicing API → ${inv.status} ${inv.json.name || ""}`);

  const wh = await api("/v1/notifications/webhooks");
  if (wh.status === 200) {
    const hooks = wh.json.webhooks || [];
    if (hooks.length === 0) {
      bad(
        "no hay webhooks registrados",
        "node scripts/paypal/setup-webhook.mjs --url https://TU-DOMINIO/api/webhook/paypal --apply",
      );
    } else {
      for (const h of hooks) {
        const events = (h.event_types || []).map((e) => e.name);
        const hasInvoicing = events.some((e) => e.startsWith("INVOICING.")) || events.includes("*");
        const isCurrent = h.id === process.env.PAYPAL_WEBHOOK_ID;
        console.log(`  ${isCurrent ? "✅" : "  "} ${h.id}  ${h.url}`);
        console.log(`       eventos: ${events.length > 3 ? events.length + " suscritos" : events.join(", ") || "ninguno"}`);
        if (isCurrent && !hasInvoicing)
          bad("el webhook activo no escucha eventos INVOICING.*", "Añádelos en el panel o re-ejecuta setup-webhook");
      }
      if (process.env.PAYPAL_WEBHOOK_ID && !hooks.some((h) => h.id === process.env.PAYPAL_WEBHOOK_ID))
        bad("PAYPAL_WEBHOOK_ID no coincide con ningún webhook de esta cuenta");
    }
  } else {
    bad(`no se pudieron listar los webhooks → ${wh.status}`);
  }
}

console.log(`\n${failures === 0 ? "✅ Todo en orden." : `⚠️  ${failures} problema(s) por resolver.`}\n`);
process.exit(failures ? 1 : 0);
