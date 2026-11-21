/**
 * Lectura del histórico de observabilidad, para el panel y para consultas
 * puntuales desde la terminal.
 *
 * Autenticado con CRON_SECRET igual que el resto del módulo: estos datos
 * describen la estructura interna del sitio y sus puntos débiles (qué rutas
 * cuestan más, dónde hay errores), así que no deben ser públicos.
 *
 * Lee exclusivamente de `obs_hourly_report`, que ya viene agregado. Es
 * deliberado: si este endpoint agregara millones de filas de `obs_events` en
 * cada visita, el panel de observabilidad se convertiría él mismo en un
 * consumidor notable de CPU, que es justo lo que estamos intentando reducir.
 */

import { createAdminClient } from "@/lib/db/supabase/server";

export const maxDuration = 30;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const hours = Math.min(Math.max(parseInt(searchParams.get("hours") || "48", 10) || 48, 1), 720);

  const supabase = createAdminClient();
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  const [reportRes, usageRes] = await Promise.all([
    supabase
      .from("obs_hourly_report")
      .select(
        "hour_bucket, vercel_cpu_ms, vercel_invocations, vercel_top_route, " +
          "projected_monthly_cpu_hours, pct_of_plan_limit, db_calls, db_exec_ms, " +
          "db_top_categoria, app_events, app_errors, avg_lcp_ms, avg_ttfb_ms, " +
          "alert_level, alert_reason",
      )
      .gte("hour_bucket", since)
      .order("hour_bucket", { ascending: true }),
    // Consumo por ruta, para responder "qué optimizar" sin abrir el detalle.
    supabase
      .from("obs_vercel_usage")
      .select("route, active_cpu_ms, invocations, cpu_per_invocation_ms, window_end")
      .gte("window_end", since)
      .neq("route", "(total)")
      .order("active_cpu_ms", { ascending: false })
      .limit(500),
  ]);

  if (reportRes.error) {
    return Response.json({ error: reportRes.error.message }, { status: 500 });
  }

  const rows = reportRes.data || [];

  // Acumulado por ruta en la ventana pedida. Se hace aquí y no en SQL para
  // evitar una vista más; el límite de 500 filas mantiene el coste acotado.
  const byRoute = {};
  for (const u of usageRes.data || []) {
    const r = (byRoute[u.route] ||= { route: u.route, cpu_ms: 0, invocations: 0 });
    r.cpu_ms += Number(u.active_cpu_ms || 0);
    r.invocations += Number(u.invocations || 0);
  }
  const routes = Object.values(byRoute)
    .map((r) => ({
      ...r,
      cpu_ms: Math.round(r.cpu_ms * 100) / 100,
      cpu_per_invocation_ms: r.invocations ? Math.round((r.cpu_ms / r.invocations) * 100) / 100 : null,
    }))
    .sort((a, b) => b.cpu_ms - a.cpu_ms);

  const totalCpu = routes.reduce((a, r) => a + r.cpu_ms, 0);
  for (const r of routes) {
    r.pct = totalCpu ? Math.round((r.cpu_ms / totalCpu) * 1000) / 10 : 0;
  }

  const last = rows[rows.length - 1] || null;

  return Response.json(
    {
      window_hours: hours,
      hours_recorded: rows.length,
      current: last
        ? {
            hour: last.hour_bucket,
            alert_level: last.alert_level,
            alert_reason: last.alert_reason,
            projected_monthly_cpu_hours: last.projected_monthly_cpu_hours,
            pct_of_plan_limit: last.pct_of_plan_limit,
          }
        : null,
      top_routes: routes.slice(0, 20),
      series: rows,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
