import "server-only";

/**
 * Cliente HTTP de PayPal REST.
 *
 * Deliberadamente sin SDK: la Invoicing API son cuatro llamadas REST y el SDK
 * oficial de Node arrastra dependencias que no necesitamos. Mismo criterio que
 * el resto del repo para integraciones ligeras.
 */

export const PAYPAL_BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export function isPaypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);
}

/**
 * El access token dura ~9 horas. Se cachea en memoria del proceso.
 *
 * Pedir un token en cada request es el error más común de esta integración:
 * duplica la latencia de cada cobro sin ninguna ganancia. El margen de 60s
 * evita usar un token que caduque a mitad de la petición siguiente.
 *
 * En Vercel cada instancia tiene su propia caché; un arranque en frío pide
 * un token nuevo, que es correcto y barato.
 */
let cachedToken = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  if (!isPaypalConfigured()) {
    throw new Error(
      "PayPal no está configurado: faltan PAYPAL_CLIENT_ID o PAYPAL_SECRET",
    );
  }

  const basic = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`,
  ).toString("base64");

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    cachedToken = null;
    throw new Error(`PayPal OAuth ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.token;
}

/** Fuerza la renovación del token. Útil si PayPal devuelve 401 inesperado. */
export function invalidatePaypalToken() {
  cachedToken = null;
}

/**
 * Llamada autenticada a la API de PayPal.
 *
 * @param {string} path            ruta absoluta, p.ej. "/v2/invoicing/invoices"
 * @param {object} [opts]
 * @param {string} [opts.method]   GET por defecto
 * @param {object} [opts.body]
 * @param {string} [opts.requestId] cabecera PayPal-Request-Id (idempotencia:
 *                                  dos POST con el mismo id no crean dos recursos)
 * @returns {Promise<object>} JSON de la respuesta ({} si 204)
 */
export async function paypal(path, { method = "GET", body, requestId } = {}) {
  const res = await fetch(`${PAYPAL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      "Content-Type": "application/json",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });

  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    // Si el token se invalidó del lado de PayPal, la siguiente llamada pedirá uno nuevo
    if (res.status === 401) invalidatePaypalToken();

    const details = (json.details || [])
      .map((d) => [d.field, d.issue, d.description].filter(Boolean).join(" "))
      .join(" · ");
    throw new Error(
      `PayPal ${method} ${path} → ${res.status} ${json.name || ""}${
        json.message ? `: ${json.message}` : ""
      }${details ? ` (${details})` : ""}`,
    );
  }

  return json;
}
