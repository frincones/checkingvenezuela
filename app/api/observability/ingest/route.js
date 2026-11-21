/**
 * Ingesta de eventos del navegador: Web Vitals y errores de cliente.
 *
 * Es PÚBLICO por necesidad —lo llama el navegador del visitante, que no tiene
 * credenciales—, así que todo lo que entra se considera hostil:
 *
 *   · límite de peticiones por IP, para que nadie infle la tabla
 *   · lista cerrada de campos: lo que no esté declarado se descarta
 *   · validación de tipo y rango en cada valor
 *   · tope de eventos por petición
 *   · no se guarda la IP, solo se usa en memoria para el límite (minimización
 *     de datos; la IP es dato personal bajo el RGPD)
 *
 * Se usa `sendBeacon` desde el cliente, de modo que la petición sobrevive al
 * cierre de la pestaña y no retrasa la navegación.
 */

import { createAdminClient } from "@/lib/db/supabase/server";

const MAX_EVENTS_PER_REQUEST = 20;

// Límite por IP. En memoria a propósito: una tabla de rate limit en Postgres
// costaría una escritura por petición, justo el consumo que intentamos reducir.
// Se pierde en cada arranque en frío, y es aceptable: frena el abuso sostenido,
// que es lo que importa.
const RATE_LIMIT = { windowMs: 60_000, max: 30 };
const hits = new Map();

// Métricas que acepta: las Core Web Vitals y poco más. Una lista cerrada evita
// que un cliente manipulado invente nombres y ensucie las agregaciones.
const VALID_METRICS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);
const VALID_KINDS = new Set(["web_vital", "page_view", "error"]);

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.reset) {
    hits.set(ip, { count: 1, reset: now + RATE_LIMIT.windowMs });
    // Limpieza oportunista: sin esto el Map crece indefinidamente en una
    // instancia de larga vida.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
    }
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_LIMIT.max;
}

/** Normaliza una ruta a su plantilla para no crear una serie por cada slug. */
function normalizeRoute(path) {
  if (typeof path !== "string" || !path.startsWith("/")) return null;
  const clean = path.split("?")[0].split("#")[0].slice(0, 200);
  return clean
    .replace(/\/packages\/destino\/[^/]+/, "/packages/destino/[slug]")
    .replace(/\/packages\/[^/]+$/, "/packages/[slug]")
    .replace(/\/destinos\/[^/]+$/, "/destinos/[slug]")
    .replace(/\/blog\/[^/]+$/, "/blog/[slug]")
    // UUIDs y números en cualquier posición.
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/[id]")
    .replace(/\/\d+(?=\/|$)/g, "/[id]");
}

function num(v, max) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n * 100) / 100;
}

/** Construye la fila a guardar, descartando todo lo que no encaje. */
function sanitize(raw, meta) {
  if (!raw || typeof raw !== "object") return null;
  const kind = VALID_KINDS.has(raw.kind) ? raw.kind : null;
  if (!kind) return null;

  const row = {
    kind,
    route: normalizeRoute(raw.route),
    vercel_id: typeof raw.vercel_id === "string" ? raw.vercel_id.slice(0, 120) : null,
    meta: {},
  };

  if (kind === "web_vital") {
    if (!VALID_METRICS.has(raw.metric_name)) return null;
    row.metric_name = raw.metric_name;
    // CLS es un ratio (0-10); el resto son milisegundos. Un techo distinto para
    // cada uno descarta valores imposibles sin recortar los legítimos.
    row.duration_ms = num(raw.value, raw.metric_name === "CLS" ? 10 : 600_000);
    if (row.duration_ms === null) return null;
    if (["good", "needs-improvement", "poor"].includes(raw.rating)) {
      row.meta.rating = raw.rating;
    }
  }

  if (kind === "error") {
    // Mensaje recortado y sin pila: una pila puede arrastrar rutas de ficheros
    // y datos del usuario.
    row.meta.message = String(raw.message ?? "").slice(0, 300);
  }

  if (kind === "page_view") {
    row.duration_ms = num(raw.value, 600_000);
  }

  // Contexto útil para segmentar, controlado por el servidor y no por el cliente.
  if (meta.country) row.meta.country = meta.country;
  if (meta.device) row.meta.device = meta.device;

  return row;
}

export async function POST(request) {
  // El orden de cabeceras sigue al de la doc de Vercel; el último valor es un
  // respaldo para desarrollo local.
  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local";

  if (rateLimited(ip)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const incoming = Array.isArray(body?.events) ? body.events : [body];
  if (incoming.length > MAX_EVENTS_PER_REQUEST) {
    return Response.json({ error: "too_many_events" }, { status: 400 });
  }

  const ua = request.headers.get("user-agent") || "";
  const meta = {
    country: request.headers.get("x-vercel-ip-country") || null,
    device: /mobile|android|iphone/i.test(ua) ? "mobile" : "desktop",
  };

  const rows = incoming.map((e) => sanitize(e, meta)).filter(Boolean);
  if (!rows.length) {
    // 202 y no 400: el navegador no puede corregir nada y un error visible en
    // consola solo asustaría al visitante.
    return new Response(null, { status: 202 });
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("obs_events").insert(rows);
    if (error) throw error;
  } catch {
    // Nunca se devuelve un error al navegador por un fallo de telemetría: la
    // observabilidad no debe poder romper la experiencia de uso.
    return new Response(null, { status: 202 });
  }

  return new Response(null, { status: 204 });
}
