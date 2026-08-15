/**
 * Registra (o reutiliza) el webhook de PayPal para los cobros.
 *
 * Idempotente: si ya existe un webhook con esa URL lo reutiliza y, si le
 * faltan eventos, los añade. Nunca crea duplicados — PayPal solo admite 10
 * por app y gastarlos por re-ejecutar el script sería absurdo.
 *
 * Uso:
 *   node scripts/paypal/setup-webhook.mjs --url https://venezuelavoyages.com/api/webhook/paypal
 *   node scripts/paypal/setup-webhook.mjs --url ... --apply
 *
 * En local, la URL debe ser pública (ngrok):
 *   ngrok http 3000
 *   node scripts/paypal/setup-webhook.mjs --url https://xxxx.ngrok-free.app/api/webhook/paypal --apply
 */
import "dotenv/config";

const APPLY = process.argv.includes("--apply");
const urlArg = process.argv.indexOf("--url");
const URL_ = urlArg > -1 ? process.argv[urlArg + 1] : null;

const EVENTS = [
  "INVOICING.INVOICE.PAID",
  "INVOICING.INVOICE.CANCELLED",
  "INVOICING.INVOICE.REFUNDED",
  "INVOICING.INVOICE.UPDATED",
];

const BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_SECRET) {
  console.error("Faltan PAYPAL_CLIENT_ID / PAYPAL_SECRET en .env");
  process.exit(1);
}
if (!URL_) {
  console.error("Falta --url https://TU-DOMINIO/api/webhook/paypal");
  process.exit(1);
}
if (!URL_.startsWith("https://")) {
  console.error("PayPal exige HTTPS. En local usa ngrok.");
  process.exit(1);
}

const auth = Buffer.from(
  `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`,
).toString("base64");

const tokenRes = await fetch(`${BASE}/v1/oauth2/token`, {
  method: "POST",
  headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
const tokenJson = await tokenRes.json();
if (!tokenRes.ok) {
  console.error("OAuth falló:", tokenJson.error_description || tokenJson.error);
  process.exit(1);
}
const token = tokenJson.access_token;

const api = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : {} };
};

console.log(`entorno: ${process.env.PAYPAL_ENV || "sandbox"} → ${BASE}`);
console.log(`url    : ${URL_}\n`);

const list = await api("/v1/notifications/webhooks");
if (list.status !== 200) {
  console.error("No se pudieron listar los webhooks:", list.json);
  process.exit(1);
}

const hooks = list.json.webhooks || [];
console.log(`webhooks existentes: ${hooks.length}/10`);
hooks.forEach((h) => console.log(`   ${h.id}  ${h.url}`));

const existing = hooks.find((h) => h.url === URL_);

if (existing) {
  const current = (existing.event_types || []).map((e) => e.name);
  const missing = EVENTS.filter((e) => !current.includes(e) && !current.includes("*"));

  console.log(`\nYa existe un webhook para esa URL: ${existing.id}`);
  if (missing.length === 0) {
    console.log("Todos los eventos necesarios están suscritos. Nada que hacer.\n");
    console.log(`PAYPAL_WEBHOOK_ID=${existing.id}`);
    process.exit(0);
  }

  console.log(`Faltan eventos: ${missing.join(", ")}`);
  if (!APPLY) {
    console.log("\nDry-run. Repite con --apply para añadirlos.");
    process.exit(0);
  }

  const patch = await api(`/v1/notifications/webhooks/${existing.id}`, {
    method: "PATCH",
    body: JSON.stringify([
      { op: "replace", path: "/event_types", value: EVENTS.map((name) => ({ name })) },
    ]),
  });
  if (patch.status >= 400) {
    console.error("No se pudo actualizar:", patch.json);
    process.exit(1);
  }
  console.log("\n✅ Eventos actualizados.\n");
  console.log(`PAYPAL_WEBHOOK_ID=${existing.id}`);
  process.exit(0);
}

console.log(`\nSe creará un webhook nuevo con ${EVENTS.length} eventos:`);
EVENTS.forEach((e) => console.log(`   ${e}`));

if (!APPLY) {
  console.log("\nDry-run. Repite con --apply para crearlo.");
  process.exit(0);
}

if (hooks.length >= 10) {
  console.error("\nPayPal permite máximo 10 webhooks por app. Borra alguno antes.");
  process.exit(1);
}

const created = await api("/v1/notifications/webhooks", {
  method: "POST",
  body: JSON.stringify({ url: URL_, event_types: EVENTS.map((name) => ({ name })) }),
});

if (created.status >= 400) {
  console.error("\nNo se pudo crear:", JSON.stringify(created.json, null, 1));
  // El error más común: PayPal no alcanza la URL. Merece la pena decirlo.
  if (JSON.stringify(created.json).includes("WEBHOOK_URL"))
    console.error("→ PayPal debe poder alcanzar la URL por HTTPS. Verifica que esté desplegada.");
  process.exit(1);
}

console.log("\n✅ Webhook creado.\n");
console.log("Añade esto a .env (y a las variables de entorno de Vercel):");
console.log(`PAYPAL_WEBHOOK_ID=${created.json.id}`);
