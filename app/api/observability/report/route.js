/**
 * Reporte horario de observabilidad.
 *
 * Lo invoca pg_cron de Supabase cada hora (no un cron de Vercel: el plan Hobby
 * solo permite crons diarios, y Schedules arrastra un jitter de 15 min).
 *
 * QUÉ RECOGE, Y DE DÓNDE
 * ----------------------
 *   1. Vercel     -> Active CPU e invocaciones por ruta. Cifras FACTURADAS.
 *   2. Supabase   -> métricas de infraestructura (endpoint Prometheus).
 *   3. Postgres   -> delta de consultas de la última hora.
 *   4. Aplicación -> eventos y Web Vitals que ya escribió el propio sitio.
 *
 * POR QUÉ LA PRISA CON VERCEL
 * ---------------------------
 * El plan Hobby solo expone los últimos 30 MINUTOS de métricas. Pasado ese
 * rato, los datos desaparecen. Este endpoint existe para capturarlos antes de
 * que se pierdan: es la única forma de construir el histórico que Vercel cobra.
 *
 * COSTE DE CPU DE ESTE ENDPOINT
 * -----------------------------
 * Casi nulo. Vercel factura Active CPU y "you are only billed during actual
 * code execution and not during I/O operations". Este endpoint es casi todo
 * espera de red, así que medir no distorsiona de forma apreciable lo medido.
 *
 * Deliberadamente NO llama a `vercel metrics` por CLI: en una función
 * serverless no hay npx ni se puede descargar un paquete. Usa la API REST de
 * observabilidad, que devuelve 402 en Hobby — por eso ese bloque se trata como
 * opcional y su ausencia no invalida el resto del reporte.
 */

import { createAdminClient } from "@/lib/db/supabase/server";

// Un reporte que tarde más que esto es un reporte que falló.
export const maxDuration = 60;

// Límites del plan Hobby (doc oficial: functions/usage-and-pricing).
const HOBBY_CPU_HOURS = 4;
const COURTESY_MULTIPLIER = 3;
const COURTESY_EXPIRES = "2026-12-19";

// Umbrales de alarma sobre el límite NORMAL, no el ampliado: la cortesía caduca
// el 19-dic-2026 y avisar solo contra el límite ampliado daría una falsa calma.
const WARN_PCT = 70;
const CRITICAL_PCT = 100;

/** Las métricas de infraestructura que vale la pena guardar de las 322 que hay. */
const DB_METRICS_WANTED = [
  "pg_stat_database_blks_hit",
  "pg_stat_database_blks_read",
  "pg_stat_database_xact_commit",
  "pg_stat_database_xact_rollback",
  "pg_stat_database_numbackends",
  "pgbouncer_pools_client_waiting_connections",
  "pgbouncer_used_clients",
  "node_memory_MemAvailable_bytes",
  "node_filesystem_avail_bytes",
  "supabase_realtime_connected_clients",
];

function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

/**
 * Parsea el formato de exposición de Prometheus.
 * Se hace a mano para no añadir una dependencia: el formato es estable y aquí
 * solo interesan las líneas `nombre{etiquetas} valor`.
 */
function parsePrometheus(text, wanted) {
  const out = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(.+)$/);
    if (!m) continue;
    const [, name, rawLabels, rawValue] = m;
    if (!wanted.includes(name)) continue;
    const value = Number(rawValue.split(/\s+/)[0]);
    if (!Number.isFinite(value)) continue;

    const labels = {};
    if (rawLabels) {
      for (const pair of rawLabels.slice(1, -1).split(",")) {
        const i = pair.indexOf("=");
        if (i === -1) continue;
        const k = pair.slice(0, i).trim();
        // Las etiquetas de identidad del proyecto se repiten en las 322
        // métricas y no aportan nada al guardarlas.
        if (["supabase_project_ref", "supabase_identifier", "sb_dest_cluster"].includes(k)) continue;
        labels[k] = pair.slice(i + 1).trim().replace(/^"|"$/g, "");
      }
    }
    out.push({ metric: name, value, labels });
  }
  return out;
}

export async function GET(request) {
  const started = Date.now();

  // Mismo patrón de autorización que los cron ya existentes del proyecto.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const supabase = createAdminClient();
  const now = new Date();
  // Se trunca a la hora para que el reporte sea idempotente: dos ejecuciones en
  // la misma hora actualizan la misma fila en vez de crear dos.
  const hourBucket = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(),
  ));

  const report = { hour_bucket: hourBucket.toISOString(), sources: {} };
  const problems = [];

  // ---------------------------------------------------------------
  // 1. Snapshot de Postgres y delta de la última hora
  // ---------------------------------------------------------------
  try {
    const { data: inserted, error: snapErr } = await supabase.rpc("obs_capture_db_snapshot");
    if (snapErr) throw snapErr;

    const { data: delta, error: deltaErr } = await supabase.rpc("obs_db_delta", { p_hours: 1 });
    if (deltaErr) throw deltaErr;

    const rows = delta || [];
    report.sources.postgres = {
      snapshot_rows: inserted,
      categories: rows,
      total_calls: rows.reduce((a, r) => a + Number(r.calls || 0), 0),
      total_exec_ms: rows.reduce((a, r) => a + Number(r.exec_ms || 0), 0),
      top: rows[0]?.categoria ?? null,
    };
  } catch (e) {
    problems.push(`postgres: ${e.message}`);
    report.sources.postgres = { error: e.message };
  }

  // ---------------------------------------------------------------
  // 2. Métricas de infraestructura de Supabase (endpoint Prometheus)
  // ---------------------------------------------------------------
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/customer/v1/privileged/metrics`;
    // Basic auth con usuario `service_role`, según la doc de Supabase.
    const auth = Buffer.from(`service_role:${process.env.SUPABASE_SERVICE_ROLE_KEY}`).toString("base64");
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const parsed = parsePrometheus(await res.text(), DB_METRICS_WANTED);
    if (parsed.length) {
      const capturedAt = now.toISOString();
      const { error } = await supabase
        .from("obs_db_metrics")
        .insert(parsed.map((p) => ({ ...p, captured_at: capturedAt })));
      if (error) throw error;
    }
    report.sources.supabase_metrics = { captured: parsed.length };
  } catch (e) {
    problems.push(`supabase_metrics: ${e.message}`);
    report.sources.supabase_metrics = { error: e.message };
  }

  // ---------------------------------------------------------------
  // 3. Consumo real de Vercel
  // ---------------------------------------------------------------
  // La API de observabilidad devuelve 402 en Hobby, así que esto normalmente
  // fallará y no pasa nada: la captura fiable la hace el script local
  // `scripts/observability/vercel-usage.mjs`, que usa la CLI. Se intenta
  // igualmente porque si algún día el plan cambia, empieza a funcionar solo.
  try {
    const token = process.env.VERCEL_TOKEN;
    if (!token) throw new Error("VERCEL_TOKEN no configurado (esperado en produccion)");

    const until = Date.now();
    const since = until - 25 * 60 * 1000; // dentro de la ventana de 30 min
    const res = await fetch("https://api.vercel.com/v2/observability/query", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        metric: "vercel.function_invocation.function_cpu_time_ms",
        aggregation: "sum",
        groupBy: ["route"],
        startTime: new Date(since).toISOString(),
        endTime: new Date(until).toISOString(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} (402 = requiere Observability Plus)`);
    report.sources.vercel = await res.json();
  } catch (e) {
    // No se cuenta como problema: en Hobby es el comportamiento esperado.
    report.sources.vercel = { unavailable: e.message };
  }

  // ---------------------------------------------------------------
  // 4. Eventos de la propia aplicación en la última hora
  // ---------------------------------------------------------------
  try {
    const sinceIso = new Date(now.getTime() - 3600_000).toISOString();
    const { data: events, error } = await supabase
      .from("obs_events")
      .select("kind, route, duration_ms, metric_name, http_status")
      .gte("created_at", sinceIso)
      .limit(5000);
    if (error) throw error;

    const rows = events || [];
    const vitals = {};
    for (const e of rows) {
      if (e.kind === "web_vital" && e.metric_name && e.duration_ms != null) {
        (vitals[e.metric_name] ||= []).push(Number(e.duration_ms));
      }
    }
    const avg = (a) => (a?.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

    report.sources.app = {
      events: rows.length,
      errors: rows.filter((e) => e.kind === "error" || (e.http_status && e.http_status >= 500)).length,
      avg_lcp_ms: avg(vitals.LCP),
      avg_ttfb_ms: avg(vitals.TTFB),
      avg_inp_ms: avg(vitals.INP),
    };
  } catch (e) {
    problems.push(`app: ${e.message}`);
    report.sources.app = { error: e.message };
  }

  // ---------------------------------------------------------------
  // 5. Proyección contra el límite del plan
  // ---------------------------------------------------------------
  // Se parte del consumo de Vercel ya guardado en las últimas 24 h, porque es
  // la cifra facturada. Un promedio de 24 h evita que una hora punta o una
  // madrugada muerta distorsionen la proyección.
  let projection = null;
  try {
    const { data: usage } = await supabase
      .from("obs_vercel_usage")
      .select("active_cpu_ms, window_start, window_end")
      .eq("route", "(total)")
      .gte("window_end", new Date(now.getTime() - 24 * 3600_000).toISOString());

    if (usage?.length) {
      let ms = 0;
      let seconds = 0;
      for (const u of usage) {
        ms += Number(u.active_cpu_ms || 0);
        seconds += (new Date(u.window_end) - new Date(u.window_start)) / 1000;
      }
      if (seconds > 0) {
        const cpuPerHourSec = (ms / 1000) * (3600 / seconds);
        const monthHours = (cpuPerHourSec * 24 * 30) / 3600;
        projection = {
          cpu_seconds_per_hour: Number(cpuPerHourSec.toFixed(2)),
          monthly_cpu_hours: Number(monthHours.toFixed(3)),
          pct_of_plan_limit: Number(((monthHours / HOBBY_CPU_HOURS) * 100).toFixed(2)),
          pct_of_courtesy_limit: Number(
            ((monthHours / (HOBBY_CPU_HOURS * COURTESY_MULTIPLIER)) * 100).toFixed(2),
          ),
          courtesy_expires: COURTESY_EXPIRES,
          based_on_windows: usage.length,
        };
      }
    }
  } catch {
    // Sin histórico todavía no hay proyección. No es un fallo.
  }
  report.projection = projection;

  // ---------------------------------------------------------------
  // 6. Nivel de alarma
  // ---------------------------------------------------------------
  let alertLevel = "ok";
  let alertReason = null;
  const pct = projection?.pct_of_plan_limit;

  if (pct != null && pct >= CRITICAL_PCT) {
    alertLevel = "critical";
    alertReason = `Proyeccion ${pct}% del limite normal (${HOBBY_CPU_HOURS} h). La ampliacion 3x caduca el ${COURTESY_EXPIRES}.`;
  } else if (pct != null && pct >= WARN_PCT) {
    alertLevel = "warning";
    alertReason = `Proyeccion ${pct}% del limite normal.`;
  }
  if (report.sources.app?.errors > 10) {
    alertLevel = alertLevel === "critical" ? "critical" : "warning";
    alertReason = [alertReason, `${report.sources.app.errors} errores en la ultima hora.`]
      .filter(Boolean)
      .join(" ");
  }

  // ---------------------------------------------------------------
  // 7. Guardar el reporte consolidado
  // ---------------------------------------------------------------
  const pg = report.sources.postgres || {};
  const app = report.sources.app || {};

  const { error: saveErr } = await supabase.from("obs_hourly_report").upsert(
    {
      hour_bucket: report.hour_bucket,
      db_calls: pg.total_calls ?? null,
      db_exec_ms: pg.total_exec_ms ?? null,
      db_top_categoria: pg.top ?? null,
      app_events: app.events ?? null,
      app_errors: app.errors ?? null,
      avg_lcp_ms: app.avg_lcp_ms ?? null,
      avg_ttfb_ms: app.avg_ttfb_ms ?? null,
      projected_monthly_cpu_hours: projection?.monthly_cpu_hours ?? null,
      pct_of_plan_limit: projection?.pct_of_plan_limit ?? null,
      alert_level: alertLevel,
      alert_reason: alertReason,
      detail: report,
    },
    { onConflict: "hour_bucket" },
  );
  if (saveErr) problems.push(`save: ${saveErr.message}`);

  // Purga una vez al día, en la ejecución de las 04:00 UTC. Se hace aquí y no en
  // un cron aparte para no gastar otro de los schedules disponibles.
  if (now.getUTCHours() === 4) {
    try {
      const { data } = await supabase.rpc("obs_purge");
      report.purge = data;
    } catch (e) {
      problems.push(`purge: ${e.message}`);
    }
  }

  return Response.json(
    {
      ok: problems.length === 0,
      hour_bucket: report.hour_bucket,
      alert_level: alertLevel,
      alert_reason: alertReason,
      projection,
      summary: {
        db_calls: pg.total_calls ?? null,
        db_top: pg.top ?? null,
        app_events: app.events ?? null,
        app_errors: app.errors ?? null,
      },
      problems,
      took_ms: Date.now() - started,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
