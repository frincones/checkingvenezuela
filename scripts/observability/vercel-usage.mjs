#!/usr/bin/env node
/**
 * Lee el consumo REAL de CPU del proyecto desde la observabilidad de Vercel.
 *
 * QUÉ FUNCIONA Y QUÉ NO (verificado contra la CLI, no supuesto)
 * -------------------------------------------------------------
 * - `vercel billing usage`  -> INÚTIL en Hobby. Responde:
 *     "Billing cost data is unavailable ... the team has no active subscription"
 *   Es lógico: Hobby no factura, así que no hay datos de coste. Mide dinero,
 *   no recursos.
 *
 * - `vercel metrics <id>`   -> SÍ FUNCIONA en Hobby, con una restricción:
 *     "Observability Plus is required for function invocations that start more
 *      than 30 minutes ago."
 *   Es decir: hay una VENTANA DESLIZANTE DE 30 MINUTOS de datos reales y
 *   gratuitos. Más atrás requiere pago.
 *
 * - La API REST (`/v2/observability/query`) devuelve 402. Solo la CLI pasa.
 *
 * POR QUÉ ESTO IMPORTA
 * --------------------
 * Esa ventana de 30 minutos es la razón de ser del monitoreo horario: los datos
 * caducan. Si nadie los captura, se pierden para siempre. Ejecutando esto cada
 * hora y guardando cada captura, construimos el histórico que Vercel cobra.
 *
 * Son cifras de Active CPU medidas por Vercel: lo que de verdad se factura. No
 * una estimación nuestra. Esto sustituye cualquier intento de medir con
 * `process.cpuUsage()`, que bajo Fluid Compute no se puede atribuir a una sola
 * petición porque varias invocaciones comparten el proceso.
 *
 * USO
 * ---
 *   node scripts/observability/vercel-usage.mjs
 *   node scripts/observability/vercel-usage.mjs --window 25   # minutos (máx 29)
 *   node scripts/observability/vercel-usage.mjs --json
 *
 * Token: VERCEL_TOKEN del entorno o de los .env. Un token de ámbito de proyecto
 * sirve, siempre que se pase `--scope` (lo hace este script). Lo que NO acepta
 * un token de proyecto es `vercel billing`, que es de cuenta.
 *
 * El `--scope` es obligatorio y no opcional: la cuenta pertenece a dos equipos
 * y, en modo no interactivo, la CLI se niega a elegir y sale con error.
 */

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(ROOT, ".observability");
const PROJECT = "checkingvenezuela";

// El scope es OBLIGATORIO y explícito. La cuenta pertenece a dos equipos
// (`freddy-ricones-projects` y `podenzas-projects`), y en modo no interactivo la
// CLI se niega a elegir: responde `missing_scope` con exit 1. A mano parecía
// funcionar solo porque la terminal era interactiva.
const SCOPE = "freddy-ricones-projects";

// Límite real de la ventana gratuita. 29 y no 30 para no caer justo en el borde
// y recibir un error por una invocación que entró un segundo antes.
const MAX_WINDOW_MIN = 29;

// Límites del plan Hobby (doc oficial: functions/usage-and-pricing).
const HOBBY = { activeCpuHours: 4, invocations: 1_000_000 };

// Ampliación de cortesía 3x concedida por soporte; caduca el 19-dic-2026.
const COURTESY = { multiplier: 3, expires: "2026-12-19" };

const METRICS = [
  { id: "vercel.function_invocation.function_cpu_time_ms", agg: "sum", label: "Active CPU (ms)" },
  { id: "vercel.function_invocation.count", agg: "count", label: "Invocaciones" },
];

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");

const wIdx = args.indexOf("--window");
let windowMin = wIdx !== -1 && args[wIdx + 1] ? Number(args[wIdx + 1]) : 25;
if (!Number.isInteger(windowMin) || windowMin < 5 || windowMin > MAX_WINDOW_MIN) {
  console.error(`--window invalido. Entero entre 5 y ${MAX_WINDOW_MIN} (la ventana gratuita es de 30 min).`);
  process.exit(1);
}

function log(...a) {
  if (!jsonOnly) console.log(...a);
}

/**
 * Lee una variable de los ficheros .env del proyecto, sin añadir dependencias.
 *
 * Mira .env.local primero y .env después, el mismo orden de precedencia que
 * aplica Next.js. Hace falta consultar ambos: las credenciales de Supabase
 * viven en .env (las usa la aplicación) y las de administración en .env.local.
 */
function readEnvLocal(key) {
  for (const name of [".env.local", ".env"]) {
    const p = join(ROOT, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && m[1] === key) {
        const v = m[2].replace(/^["']|["']$/g, "").trim();
        if (v) return v;
      }
    }
  }
  return undefined;
}

/**
 * El token va por entorno, no como argumento, para que no quede visible en la
 * tabla de procesos ni en el historial del shell.
 *
 * `shell: true` en Windows porque npx es un .cmd y spawn lo rechaza con EINVAL.
 * Todos los argumentos son constantes del script o valores ya validados con
 * lista blanca, así que no hay superficie de inyección.
 */
function runCli(cliArgs, token) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["--yes", "vercel@latest", ...cliArgs], {
      cwd: ROOT,
      env: token ? { ...process.env, VERCEL_TOKEN: token } : process.env,
      shell: process.platform === "win32",
      windowsHide: true,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => resolve({ code: -1, out, err: String(e) }));
    child.on("close", (code) => resolve({ code, out, err }));
  });
}

/**
 * La CLI intercala avisos de npm con el JSON, así que hay que recortar.
 *
 * Se prueba PRIMERO el corte más largo (desde el primer `{` o `[` hasta el
 * final) y se va acortando. El orden importa: al revés, un fragmento corto como
 * `{"query":{...}}` parsea bien y se devolvería un objeto incompleto —
 * silenciosamente, sin error y con los datos vacíos.
 */
function extractJson(text) {
  const t = (text || "").replace(/^npm warn.*$/gm, "").trim();
  const start = t.search(/[[{]/);
  if (start === -1) return null;
  for (let end = t.length; end > start; end--) {
    const slice = t.slice(start, end).trim();
    if (!/[\]}]$/.test(slice)) continue; // solo cortes que cierran estructura
    try {
      return JSON.parse(slice);
    } catch {
      /* corte más corto */
    }
  }
  return null;
}

/** Suma por ruta todos los buckets temporales de una respuesta agrupada. */
function sumByRoute(payload) {
  const rows = payload?.data || [];
  if (!rows.length) return { byRoute: {}, total: 0 };
  const valueKey = Object.keys(rows[0]).find((k) => k !== "timestamp" && k !== "route");
  const byRoute = {};
  for (const r of rows) {
    const route = r.route ?? "(sin ruta)";
    byRoute[route] = (byRoute[route] || 0) + (Number(r[valueKey]) || 0);
  }
  const total = Object.values(byRoute).reduce((a, b) => a + b, 0);
  return { byRoute, total };
}

function bar(pct, width = 30) {
  const f = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
  return "#".repeat(f) + ".".repeat(width - f);
}

async function main() {
  // El token del ENTORNO tiene prioridad sobre el de .env.local.
  //
  // Importa el orden: en .env.local hay un token de ámbito de PROYECTO (`vcp_…`),
  // que la CLI rechaza con "User not found" porque estos comandos operan a nivel
  // de cuenta. El token de cuenta está en el entorno. Al revés, el script falla
  // aunque haya una credencial válida disponible.
  const token = process.env.VERCEL_TOKEN || readEnvLocal("VERCEL_TOKEN");
  const capturedAt = new Date().toISOString();

  // Nota sobre el token, comprobada empíricamente:
  //
  // El token `vcp_` (ámbito de proyecto) SÍ funciona con `vercel metrics`
  // siempre que se pase `--scope`. Lo que falla con él es `/v2/user` y
  // `vercel billing usage`, que son de cuenta y devuelven "User not found".
  //
  // Es decir: "User not found" aquí no significa token inválido, significa que
  // el comando pedía ámbito de cuenta. No se bloquea por el prefijo.
  log(`  autenticacion: ${token ? `token ${token.slice(0, 4)}… de ${process.env.VERCEL_TOKEN ? "entorno" : ".env.local"}` : "sesion local de la CLI"}`);

  log("Consumo real de CPU — observabilidad de Vercel");
  log("=".repeat(64));
  log(`  proyecto : ${PROJECT}`);
  log(`  ventana  : ultimos ${windowMin} min  (el plan solo expone 30 min)`);
  log(`  capturado: ${capturedAt}`);
  log("");

  const result = { captured_at: capturedAt, window_minutes: windowMin, metrics: {} };
  let hadFailure = false;

  for (const m of METRICS) {
    const res = await runCli(
      [
        "metrics",
        m.id,
        "--scope",
        SCOPE,
        "--project",
        PROJECT,
        "--since",
        `${windowMin}m`,
        "--granularity",
        "5m", // un bucket mayor que la ventana devuelve vacío
        "--group-by",
        "route",
        "--aggregation",
        m.agg,
        "--limit",
        "30",
        "--json",
      ],
      token,
    );

    const payload = extractJson(res.out) ?? extractJson(res.err);

    // La CLI puede terminar con exit != 0 y devolver un JSON de estado en vez de
    // datos (por ejemplo `missing_scope` o `payment_required`). Se comprueban
    // los tres casos por separado: sin ese chequeo, un fallo se traducía en
    // totales en cero sin ningún aviso, que es peor que un error.
    const problem = !payload
      ? res.err?.replace(/^npm warn.*$/gm, "").trim() || `la CLI termino con codigo ${res.code}`
      : payload.error?.message ||
        (payload.status && payload.status !== "ok" ? `${payload.reason || payload.status}: ${payload.message || ""}` : null) ||
        (!Array.isArray(payload.data) ? "la respuesta no trae el campo 'data'" : null);

    if (problem) {
      log(`  [FALLO] ${m.label}: ${String(problem).split("\n")[0].slice(0, 150)}`);
      if (payload?.hint) log(`          pista: ${String(payload.hint).slice(0, 140)}`);
      result.metrics[m.id] = { error: String(problem).slice(0, 400) };
      hadFailure = true;
      continue;
    }

    if (!payload.data.length) {
      log(`  ${m.label}: sin datos en la ventana (no hubo trafico, o aun no se indexo)`);
      result.metrics[m.id] = { total: 0, by_route: {}, empty: true };
      continue;
    }

    const { byRoute, total } = sumByRoute(payload);
    result.metrics[m.id] = { total, by_route: byRoute };

    log(`  ${m.label} — total ${m.id.endsWith("_ms") ? (total / 1000).toFixed(2) + " s" : total.toFixed(0)}`);
    const top = Object.entries(byRoute)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [route, v] of top) {
      const pct = total ? (v / total) * 100 : 0;
      const shown = m.id.endsWith("_ms") ? `${(v / 1000).toFixed(2)} s` : `${v.toFixed(0)}`;
      log(`     ${shown.padStart(9)}  ${pct.toFixed(1).padStart(5)}%  ${route}`);
    }
    log("");
  }

  // Extrapolación al mes. Es una proyección lineal honesta: asume que la ventana
  // observada representa el ritmo medio, lo que no es cierto si se captura justo
  // en un pico o en plena madrugada. Con capturas horarias el sesgo se diluye.
  const cpuMs = result.metrics["vercel.function_invocation.function_cpu_time_ms"]?.total;
  const invocations = result.metrics["vercel.function_invocation.count"]?.total;

  if (typeof cpuMs === "number" && cpuMs > 0) {
    const perHourSec = (cpuMs / 1000) * (60 / windowMin);
    const monthHours = (perHourSec * 24 * 30) / 3600;
    const effLimit = HOBBY.activeCpuHours * COURTESY.multiplier;

    result.projection = {
      cpu_seconds_per_hour: Number(perHourSec.toFixed(2)),
      cpu_hours_per_month: Number(monthHours.toFixed(2)),
      pct_of_normal_limit: Number(((monthHours / HOBBY.activeCpuHours) * 100).toFixed(1)),
      pct_of_courtesy_limit: Number(((monthHours / effLimit) * 100).toFixed(1)),
      invocations_per_hour: typeof invocations === "number" ? Math.round(invocations * (60 / windowMin)) : null,
    };

    log("  Proyeccion mensual a este ritmo");
    log("  " + "-".repeat(60));
    log(`     CPU por hora          : ${perHourSec.toFixed(1)} s`);
    log(`     CPU por mes (estimado): ${monthHours.toFixed(2)} horas`);
    log("");
    const p1 = (monthHours / HOBBY.activeCpuHours) * 100;
    const p3 = (monthHours / effLimit) * 100;
    log(`     vs limite normal  (${HOBBY.activeCpuHours} h)  [${bar(p1)}] ${p1.toFixed(1)}%`);
    log(`     vs cortesia 3x    (${effLimit} h) [${bar(p3)}] ${p3.toFixed(1)}%`);
    log("");
    if (p1 >= 100) {
      log(`     AVISO: a este ritmo se supera el limite normal. La cortesia 3x`);
      log(`     caduca el ${COURTESY.expires}; despues de esa fecha el sitio se pausa.`);
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const file = join(OUT_DIR, `usage-${capturedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2));

  // ---------------------------------------------------------------
  // Persistir en Supabase
  // ---------------------------------------------------------------
  // Este script es la ÚNICA fuente de Active CPU real: la API REST de
  // observabilidad devuelve 402 en Hobby y solo la CLI pasa. Guardarlo en la
  // base es lo que convierte una foto de 30 minutos en un histórico, y lo que
  // alimenta la proyección del reporte horario.
  if (!args.includes("--no-upload")) {
    try {
      const url = readEnvLocal("NEXT_PUBLIC_SUPABASE_URL") || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = readEnvLocal("SUPABASE_SERVICE_ROLE_KEY") || process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

      const cpuByRoute = result.metrics["vercel.function_invocation.function_cpu_time_ms"]?.by_route || {};
      const invByRoute = result.metrics["vercel.function_invocation.count"]?.by_route || {};

      // La ventana real que cubre la captura, no una suposición: si el script se
      // ejecuta con retraso, el cálculo por hora sigue siendo correcto.
      const windowEnd = new Date(capturedAt);
      const windowStart = new Date(windowEnd.getTime() - windowMin * 60_000);

      // TODAS las filas llevan EXACTAMENTE las mismas claves. PostgREST
      // rechaza un lote con claves heterogéneas ("All object keys must match"),
      // así que `meta` va en todas aunque solo la fila total lo use.
      const rows = [];
      for (const route of new Set([...Object.keys(cpuByRoute), ...Object.keys(invByRoute)])) {
        rows.push({
          window_start: windowStart.toISOString(),
          window_end: windowEnd.toISOString(),
          route,
          active_cpu_ms: cpuByRoute[route] ?? null,
          invocations: invByRoute[route] ?? null,
          meta: {},
        });
      }

      // Fila agregada: el reporte horario lee '(total)' para proyectar sin tener
      // que sumar todas las rutas en cada consulta.
      const totalCpu = result.metrics["vercel.function_invocation.function_cpu_time_ms"]?.total;
      const totalInv = result.metrics["vercel.function_invocation.count"]?.total;
      if (typeof totalCpu === "number") {
        rows.push({
          window_start: windowStart.toISOString(),
          window_end: windowEnd.toISOString(),
          route: "(total)",
          active_cpu_ms: totalCpu,
          invocations: typeof totalInv === "number" ? totalInv : null,
          meta: { projection: result.projection ?? null },
        });
      }

      if (rows.length) {
        // merge-duplicates: si una captura se reintenta, actualiza en vez de
        // duplicar, y la restricción UNIQUE evita inflar el consumo.
        const res = await fetch(`${url}/rest/v1/obs_vercel_usage?on_conflict=window_start,window_end,route`, {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(rows),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        log(`  Guardado en Supabase: ${rows.length} filas (obs_vercel_usage)`);
      }
    } catch (e) {
      log(`  [AVISO] no se pudo guardar en Supabase: ${e.message}`);
      log("          la captura local en .observability/ si quedo escrita");
    }
  }

  if (jsonOnly) {
    console.log(JSON.stringify(result));
  } else {
    log(`  Captura guardada en: ${file}`);
  }

  // Salir con error si alguna métrica falló: así un cron o una tubería lo nota
  // en vez de dar por bueno un reporte a medias.
  if (hadFailure) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Fallo inesperado:", e?.message || e);
  process.exitCode = 1;
});
