-- =============================================================
-- OBSERVABILIDAD: trazabilidad de frontend, backend, Vercel y Postgres
--
-- PROBLEMA QUE RESUELVE
-- ---------------------
-- El plan Hobby de Vercel solo expone métricas de los últimos 30 MINUTOS
-- (verificado: `vercel metrics` responde "Observability Plus is required for
-- function invocations that start more than 30 minutes ago"). Pasado ese rato
-- los datos se pierden para siempre.
--
-- Lo mismo con Postgres: `pg_stat_statements` es un contador ACUMULADO desde el
-- último reinicio. Dice el total histórico, pero no "cuánto se consumió entre
-- las 14:00 y las 15:00". Para eso hay que fotografiar y restar.
--
-- Este esquema construye el histórico que ninguno de los dos guarda.
--
-- POR QUÉ pg_cron Y NO LOS CRON DE VERCEL
-- ---------------------------------------
--   · Vercel Hobby con Cron Jobs: máximo 1 vez al día. Un `0 * * * *` ni
--     despliega ("Hobby accounts are limited to daily cron jobs").
--   · Vercel Schedules: permite cada 15 min, pero arrastra un jitter FIJO de
--     15 minutos, así que la foto de "las 14:00" puede tomarse a las 14:14.
--   · pg_cron: puntual al minuto, gratis en el plan Free, y lo más importante,
--     NO consume CPU de Vercel. Dado que el problema que estamos midiendo ES el
--     consumo de CPU de Vercel, medirlo desde dentro de Vercel lo encarecería.
--
-- Aditivo: no toca ninguna tabla existente. Reversión al final del archivo.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================================
-- 1. EVENTOS DE APLICACIÓN (frontend + backend)
-- =============================================================
--
-- Tabla única en vez de una por tipo de evento: así una consulta responde
-- "¿qué pasó entre las 14:00 y las 15:00?" sin unir seis tablas. El campo
-- `kind` discrimina y los índices parciales mantienen el coste bajo.

CREATE TABLE IF NOT EXISTS public.obs_events (
  id             BIGSERIAL PRIMARY KEY,

  -- Qué clase de evento es. Lista cerrada a propósito: un typo en el nombre
  -- crearía una categoría fantasma que nadie volvería a consultar.
  kind           TEXT NOT NULL CHECK (kind IN (
                   'web_vital',     -- métrica de rendimiento del navegador
                   'page_view',     -- navegación del visitante
                   'api_call',      -- invocación de una ruta de API
                   'server_render', -- render de página en servidor
                   'error',         -- excepción capturada
                   'slow_query',    -- consulta lenta detectada
                   'external_call'  -- llamada a un tercero (Resend, Groq…)
                 )),

  -- Ruta normalizada, con los parámetros sin expandir: `/packages/[slug]`, no
  -- `/packages/los-roques-2d`. Sin esto, cada slug sería una serie distinta y
  -- resultaría imposible ver qué PLANTILLA consume.
  route          TEXT,

  -- Identificador de petición de Vercel. Es la pieza que PERMITE CORRELACIONAR
  -- un Web Vital medido en el navegador con el render que lo produjo en el
  -- servidor. Sin él, frontend y backend son dos historias separadas.
  vercel_id      TEXT,

  -- Duración de reloj. Para `web_vital` es el valor de la métrica (LCP, CLS…).
  duration_ms    NUMERIC(12,2),

  -- CPU estimada del servidor.
  --
  -- ADVERTENCIA DELIBERADA EN EL NOMBRE: es `_estimated_` porque bajo Fluid
  -- Compute varias invocaciones comparten un mismo proceso de Node, y
  -- `process.cpuUsage()` mide el PROCESO, no la petición. Con concurrencia
  -- sobrecuenta. Sirve como señal relativa entre rutas, NO como cifra
  -- facturable. La cifra real la aporta `obs_vercel_usage`, que viene de Vercel.
  cpu_estimated_ms NUMERIC(12,2),

  http_status    INT,
  cache_status   TEXT,        -- HIT / MISS / STALE de x-vercel-cache
  region         TEXT,        -- VERCEL_REGION, para detectar latencia por zona

  -- Nombre de la métrica cuando kind='web_vital': LCP, INP, CLS, FCP, TTFB.
  metric_name    TEXT,

  -- Contexto libre. jsonb y no columnas porque cada `kind` necesita campos
  -- distintos y añadir una columna por cada uno volvería la tabla inmanejable.
  meta           JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Todas las consultas del reporte filtran por tiempo, y casi todas agrupan por
-- ruta o por tipo. Estos tres índices cubren ese patrón.
CREATE INDEX IF NOT EXISTS obs_events_created_idx ON public.obs_events (created_at DESC);
CREATE INDEX IF NOT EXISTS obs_events_kind_created_idx ON public.obs_events (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS obs_events_route_created_idx ON public.obs_events (route, created_at DESC)
  WHERE route IS NOT NULL;

COMMENT ON COLUMN public.obs_events.cpu_estimated_ms IS
  'Estimacion, NO facturable: process.cpuUsage() mide el proceso compartido de Fluid Compute, no la peticion. La cifra real esta en obs_vercel_usage.';

-- =============================================================
-- 2. CONSUMO REAL MEDIDO POR VERCEL
-- =============================================================
--
-- Esta es la tabla que importa para decidir optimizaciones: son las cifras que
-- Vercel factura, no estimaciones nuestras. Se alimenta del endpoint que invoca
-- `vercel metrics`, cuya ventana de 30 minutos obliga a capturar seguido.

CREATE TABLE IF NOT EXISTS public.obs_vercel_usage (
  id                BIGSERIAL PRIMARY KEY,

  -- Ventana que REALMENTE cubre esta captura. Se guardan ambos extremos en vez
  -- de asumir "la hora anterior": si una ejecución se retrasa o se salta, el
  -- cálculo por hora seguiría siendo correcto en lugar de inventar un hueco.
  window_start      TIMESTAMPTZ NOT NULL,
  window_end        TIMESTAMPTZ NOT NULL,

  route             TEXT NOT NULL,          -- '(total)' para la fila agregada
  active_cpu_ms     NUMERIC(14,2),
  invocations       INT,

  -- CPU por invocación. Columna GENERADA: se calcula sola y no puede quedar
  -- incoherente con sus operandos, que es lo que pasaría si la rellenara la
  -- aplicación.
  cpu_per_invocation_ms NUMERIC(14,2) GENERATED ALWAYS AS (
    CASE WHEN COALESCE(invocations,0) > 0
         THEN active_cpu_ms / invocations
         ELSE NULL END
  ) STORED,

  meta              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Evita duplicar la misma ventana y ruta si una captura se reintenta. Sin
  -- esto, un reintento inflaría el consumo al doble.
  CONSTRAINT obs_vercel_usage_unico UNIQUE (window_start, window_end, route)
);

CREATE INDEX IF NOT EXISTS obs_vercel_usage_window_idx
  ON public.obs_vercel_usage (window_end DESC);
CREATE INDEX IF NOT EXISTS obs_vercel_usage_route_idx
  ON public.obs_vercel_usage (route, window_end DESC);

-- =============================================================
-- 3. SNAPSHOTS DE POSTGRES (para calcular deltas por hora)
-- =============================================================
--
-- `pg_stat_statements` acumula desde el arranque. Guardando una foto por hora y
-- restando la anterior obtenemos el consumo de ESA hora, que es lo que permite
-- ver tendencias y detectar una regresión el día que ocurre.

CREATE TABLE IF NOT EXISTS public.obs_db_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  queryid         BIGINT NOT NULL,
  -- Se guarda la consulta recortada: el texto completo puede ser enorme y aquí
  -- solo se necesita para reconocerla.
  query_sample    TEXT,
  categoria       TEXT,

  calls           BIGINT NOT NULL,
  total_exec_ms   NUMERIC(16,2) NOT NULL,
  rows_returned   BIGINT,

  CONSTRAINT obs_db_snapshots_unico UNIQUE (captured_at, queryid)
);

CREATE INDEX IF NOT EXISTS obs_db_snapshots_captured_idx
  ON public.obs_db_snapshots (captured_at DESC);

-- Métricas de infraestructura del endpoint Prometheus de Supabase (322
-- métricas disponibles en plan Free, verificado).
CREATE TABLE IF NOT EXISTS public.obs_db_metrics (
  id            BIGSERIAL PRIMARY KEY,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metric        TEXT NOT NULL,
  value         NUMERIC(20,4),
  labels        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS obs_db_metrics_captured_idx
  ON public.obs_db_metrics (captured_at DESC);
CREATE INDEX IF NOT EXISTS obs_db_metrics_name_idx
  ON public.obs_db_metrics (metric, captured_at DESC);

-- =============================================================
-- 4. REPORTE HORARIO CONSOLIDADO
-- =============================================================
--
-- Una fila por hora con todo ya calculado. Existe para que abrir el panel no
-- dispare agregaciones sobre millones de filas: el trabajo se hace una vez,
-- cuando corre el cron.

CREATE TABLE IF NOT EXISTS public.obs_hourly_report (
  hour_bucket          TIMESTAMPTZ PRIMARY KEY,

  -- Vercel: lo facturado
  vercel_cpu_ms        NUMERIC(14,2),
  vercel_invocations   INT,
  vercel_top_route     TEXT,
  vercel_top_route_pct NUMERIC(5,2),

  -- Proyección contra el límite del plan. Se guarda calculada para poder
  -- graficar la tendencia sin repetir la aritmética en cada consulta.
  projected_monthly_cpu_hours NUMERIC(8,3),
  pct_of_plan_limit    NUMERIC(6,2),

  -- Postgres: delta de esta hora
  db_calls             BIGINT,
  db_exec_ms           NUMERIC(16,2),
  db_top_categoria     TEXT,

  -- Aplicación
  app_events           INT,
  app_errors           INT,
  avg_lcp_ms           NUMERIC(10,2),
  avg_ttfb_ms          NUMERIC(10,2),

  -- Señal de alarma, ya resuelta aquí para que el panel no tenga que juzgar.
  alert_level          TEXT CHECK (alert_level IN ('ok','warning','critical')),
  alert_reason         TEXT,

  detail               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 5. RLS
-- =============================================================
--
-- RLS activada SIN políticas, igual que `leads` y `booking_requests`: con RLS
-- activa y cero políticas nadie entra salvo el rol de servicio, que las omite
-- por diseño. El frontend escribe a través de rutas de API (service role) y el
-- panel lee por endpoints autenticados.
--
-- Importa especialmente aquí: estas tablas revelan la estructura interna del
-- sitio y sus puntos débiles. No deben ser legibles con la clave pública.

ALTER TABLE public.obs_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obs_vercel_usage  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obs_db_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obs_db_metrics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obs_hourly_report ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 6. FUNCIÓN: exponer pg_stat_statements al rol de servicio
-- =============================================================
--
-- `pg_stat_statements` pertenece a `postgres` y NO es accesible por PostgREST
-- con `service_role` (comprobado: devuelve 404 PGRST202). Esta función salva esa
-- brecha con SECURITY DEFINER, exponiendo solo agregados —nunca SQL arbitrario.
--
-- `search_path` se fija vacío: sin eso, un objeto malicioso en un esquema del
-- search_path podría secuestrar una llamada dentro de una función con
-- privilegios elevados.

-- Vista puente, declarada ANTES de la función que la usa.
-- `pg_stat_statements` vive en el esquema `extensions` en Supabase, y una
-- función con search_path vacío no lo resolvería por nombre corto.
CREATE OR REPLACE VIEW public.pg_stat_statements_proxy AS
  SELECT queryid, query, calls, total_exec_time, rows
  FROM extensions.pg_stat_statements;

REVOKE ALL ON public.pg_stat_statements_proxy FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.obs_capture_db_snapshot()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_count INT;
BEGIN
  INSERT INTO public.obs_db_snapshots
    (captured_at, queryid, query_sample, categoria, calls, total_exec_ms, rows_returned)
  SELECT
    v_now,
    s.queryid,
    LEFT(regexp_replace(s.query, E'[\\n\\r\\t ]+', ' ', 'g'), 200),
    CASE
      WHEN s.query LIKE 'SELECT%pg_catalog%' OR s.query LIKE '%pg_timezone%'
        OR s.query LIKE '%pg_walfile%' OR s.query LIKE '%pg_backup%'
        OR s.query LIKE 'COPY %' OR s.query LIKE '%information_schema%'
        OR s.query LIKE '%pg_stat%' THEN 'interno_supabase'
      WHEN s.query LIKE '%service_inventory%'        THEN 'service_inventory'
      WHEN s.query LIKE '%"destinations"%'
        OR s.query LIKE '%destination_categories%'   THEN 'destinations'
      WHEN s.query LIKE '%pgbouncer.get_auth%'       THEN 'auth_conexion'
      WHEN s.query LIKE '%"emails"%'                 THEN 'emails'
      WHEN s.query LIKE '%set_config%'               THEN 'preludio_postgrest'
      WHEN s.query ILIKE '%storage.%'
        OR s.query LIKE '%buckets%'                  THEN 'storage'
      WHEN s.query ILIKE '%refresh_tokens%'
        OR s.query ILIKE '%sessions%'                THEN 'sesiones'
      WHEN s.query LIKE '%website_config%'           THEN 'website_config'
      WHEN s.query LIKE '%blog_posts%'               THEN 'blog_posts'
      WHEN s.query LIKE '%"banners"%'                THEN 'banners'
      WHEN s.query LIKE '%"packages"%'
        OR s.query LIKE '%catalog_services%'         THEN 'packages'
      WHEN s.query LIKE '%obs_%'                     THEN 'observabilidad'
      ELSE 'otros'
    END,
    s.calls,
    s.total_exec_time,
    s.rows
  FROM public.pg_stat_statements_proxy s
  -- Solo las 120 más costosas.
  --
  -- Medido sobre datos reales: 165 consultas concentran el 99,1% del tiempo de
  -- ejecución, y la cola larga son miles de consultas triviales. Guardarlas
  -- multiplicaría el histórico sin cambiar ninguna conclusión.
  --
  -- El límite importa más de lo que parece: leer pg_stat_statements no es
  -- gratis, y con 200 filas cada captura costaba ~234 ms. Una herramienta de
  -- medición que aparece entre los mayores consumidores del sistema que mide
  -- es una herramienta mal calibrada.
  ORDER BY s.total_exec_time DESC
  LIMIT 120
  ON CONFLICT (captured_at, queryid) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.obs_capture_db_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obs_capture_db_snapshot() TO service_role;

-- =============================================================
-- 7. FUNCIÓN: delta de Postgres entre las dos últimas capturas
-- =============================================================

CREATE OR REPLACE FUNCTION public.obs_db_delta(p_hours INT DEFAULT 1)
RETURNS TABLE (categoria TEXT, calls BIGINT, exec_ms NUMERIC, pct NUMERIC)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH ultimas AS (
    -- Las dos capturas que delimitan la ventana pedida.
    SELECT DISTINCT captured_at
    FROM public.obs_db_snapshots
    WHERE captured_at >= NOW() - (p_hours || ' hours')::INTERVAL - INTERVAL '90 minutes'
    ORDER BY captured_at DESC
    LIMIT 2
  ),
  bordes AS (
    SELECT MAX(captured_at) AS fin, MIN(captured_at) AS ini FROM ultimas
  ),
  diff AS (
    SELECT
      n.categoria,
      -- GREATEST(...,0) porque si Postgres reinicia, los contadores vuelven a
      -- cero y la resta daría negativo. Un reinicio no es consumo negativo.
      GREATEST(n.calls - COALESCE(v.calls, 0), 0) AS d_calls,
      GREATEST(n.total_exec_ms - COALESCE(v.total_exec_ms, 0), 0) AS d_ms
    FROM public.obs_db_snapshots n
    JOIN bordes b ON n.captured_at = b.fin
    LEFT JOIN public.obs_db_snapshots v
           ON v.queryid = n.queryid AND v.captured_at = b.ini
  )
  SELECT
    categoria,
    SUM(d_calls)::BIGINT,
    ROUND(SUM(d_ms), 2),
    ROUND(100 * SUM(d_ms) / NULLIF(SUM(SUM(d_ms)) OVER (), 0), 2)
  FROM diff
  GROUP BY categoria
  HAVING SUM(d_ms) > 0
  ORDER BY SUM(d_ms) DESC;
$$;

REVOKE ALL ON FUNCTION public.obs_db_delta(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obs_db_delta(INT) TO service_role;

-- =============================================================
-- 8. FUNCIÓN: purga del histórico
-- =============================================================
--
-- Sin purga esto crece sin techo y acabaría comiéndose la cuota de 500 MB del
-- plan Free. Retenciones distintas según el valor de cada dato con el tiempo:
-- el detalle sirve para depurar ahora, el agregado para ver tendencias.

CREATE OR REPLACE FUNCTION public.obs_purge()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  e INT; s INT; m INT; v INT;
BEGIN
  -- Eventos crudos: 14 días. Son los más numerosos y pierden valor rápido.
  DELETE FROM public.obs_events WHERE created_at < NOW() - INTERVAL '14 days';
  GET DIAGNOSTICS e = ROW_COUNT;

  -- Snapshots: 30 días. Solo hacen falta para calcular deltas.
  DELETE FROM public.obs_db_snapshots WHERE captured_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS s = ROW_COUNT;

  DELETE FROM public.obs_db_metrics WHERE captured_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS m = ROW_COUNT;

  -- Consumo de Vercel: 180 días. Es el dato más valioso y el más pequeño; con
  -- él se compara mes contra mes y se justifica una optimización.
  DELETE FROM public.obs_vercel_usage WHERE window_end < NOW() - INTERVAL '180 days';
  GET DIAGNOSTICS v = ROW_COUNT;

  -- obs_hourly_report NO se purga: una fila por hora son 8.760 al año, nada.

  -- Las respuestas de pg_net se acumulan solas y nadie las limpia.
  DELETE FROM net._http_response WHERE created < NOW() - INTERVAL '2 days';

  RETURN format('eventos=%s snapshots=%s metricas=%s vercel=%s', e, s, m, v);
END;
$$;

REVOKE ALL ON FUNCTION public.obs_purge() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obs_purge() TO service_role;

COMMENT ON TABLE public.obs_events IS
  'Eventos de aplicacion (frontend y backend). Correlacionables por vercel_id. Retencion 14 dias.';
COMMENT ON TABLE public.obs_vercel_usage IS
  'Active CPU REAL medido por Vercel, por ruta. Fuente: vercel metrics (ventana de 30 min). Retencion 180 dias.';
COMMENT ON TABLE public.obs_hourly_report IS
  'Reporte consolidado por hora. Una fila por hora, sin purga.';

-- =============================================================
-- REVERSIÓN
-- =============================================================
-- SELECT cron.unschedule('obs-hourly-report');
-- SELECT cron.unschedule('obs-db-snapshot');
-- SELECT cron.unschedule('obs-purge');
-- DROP FUNCTION IF EXISTS public.obs_purge();
-- DROP FUNCTION IF EXISTS public.obs_db_delta(INT);
-- DROP FUNCTION IF EXISTS public.obs_capture_db_snapshot();
-- DROP VIEW IF EXISTS public.pg_stat_statements_proxy;
-- DROP TABLE IF EXISTS public.obs_hourly_report, public.obs_db_metrics,
--   public.obs_db_snapshots, public.obs_vercel_usage, public.obs_events;
