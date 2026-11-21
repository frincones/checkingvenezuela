# Observabilidad

Trazabilidad de frontend, backend, Vercel y Postgres, y vigilancia del consumo
frente al límite del plan. Todo con plan gratuito.

## El problema que resuelve

Ni Vercel ni Supabase guardan el histórico que necesitamos:

| | Qué ofrece el plan gratuito | Consecuencia |
|---|---|---|
| **Vercel Hobby** | métricas de los últimos **30 minutos** | pasado ese rato, los datos **se pierden** |
| **Supabase Free** | `pg_stat_statements` **acumulado** desde el arranque | dice el total histórico, no "cuánto se gastó entre las 14:00 y las 15:00" |
| **Logs** | no accesibles en ninguno de los dos | — |

Verificado, no supuesto:

- `vercel metrics` → *"Observability Plus is required for function invocations
  that start more than 30 minutes ago"*
- `vercel billing usage` → *"no active subscription for that range"* (mide
  dinero, y Hobby no factura)
- API REST `/v2/observability/query` → `402 payment required`
- Tablas de log de Supabase (`edge_logs`, `postgres_logs`) → no existen en Free

Este módulo captura esos datos **antes de que caduquen** y los convierte en
histórico.

## Por qué pg_cron y no los cron de Vercel

| Opción | Frecuencia en Hobby | Problema |
|---|---|---|
| Vercel Cron Jobs | 1 vez al día | un `0 * * * *` **ni despliega** |
| Vercel Schedules | cada 15 min | jitter **fijo de 15 min** |
| **pg_cron** | **al minuto** | ninguno |

Y la razón de fondo: pg_cron corre **dentro de Postgres**, así que no consume
CPU de Vercel. Como lo que estamos midiendo *es* el consumo de CPU de Vercel,
medirlo desde dentro de Vercel lo encarecería.

Comprobado en producción: el primer snapshot se ejecutó a las `16:30:00`
exactas, con estado `succeeded`.

## Piezas

```
scripts/observability/vercel-usage.mjs      <- la única fuente de Active CPU REAL
app/api/observability/report/route.js       <- reporte horario (lo llama pg_cron)
app/api/observability/ingest/route.js       <- recibe Web Vitals del navegador
app/api/observability/summary/route.js      <- lectura para el panel
components/observability/WebVitalsReporter.jsx
supabase/migrations/20261121_observability.sql
```

### Tablas

| Tabla | Qué guarda | Retención |
|---|---|---|
| `obs_events` | eventos de frontend y backend | 14 días |
| `obs_vercel_usage` | **Active CPU facturado**, por ruta | 180 días |
| `obs_db_snapshots` | fotos de `pg_stat_statements` | 30 días |
| `obs_db_metrics` | métricas de infraestructura | 30 días |
| `obs_hourly_report` | reporte consolidado por hora | sin purga |

Todas con RLS activada y sin políticas: solo el rol de servicio entra, igual que
`leads` y `booking_requests`.

### Tareas programadas (pg_cron)

| Nombre | Cuándo | Qué hace |
|---|---|---|
| `obs-hourly-report` | `5 * * * *` | llama al endpoint de reporte |
| `obs-db-snapshot` | `*/15 * * * *` | foto de `pg_stat_statements` |
| `obs-purge` | `10 4 * * *` | purga según retención |

El snapshot va cada 15 min y no cada hora a propósito: corre dentro de Postgres,
no cuesta nada, y esa resolución permite ubicar un pico en su franja real en
lugar de diluirlo en una hora entera.

El secreto se guarda en **Supabase Vault**, no en la definición del cron:
`cron.job` es legible y dejarlo ahí lo expondría. Verificado: cero trabajos con
el token visible.

## Uso

### Capturar el consumo real de Vercel

```bash
node scripts/observability/vercel-usage.mjs            # ventana de 25 min
node scripts/observability/vercel-usage.mjs --window 10
node scripts/observability/vercel-usage.mjs --json     # para tuberías
node scripts/observability/vercel-usage.mjs --no-upload
```

Guarda en `.observability/` (ignorado por git) y sube a `obs_vercel_usage`.

**Necesita `VERCEL_TOKEN` en el entorno.** Un token de proyecto (`vcp_`) sirve
porque el script pasa `--scope`.

### Consultar el histórico

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.venezuelavoyages.com/api/observability/summary?hours=48"
```

### Desde SQL

```sql
-- consumo de la última hora por categoría
SELECT * FROM public.obs_db_delta(1);

-- últimas 24 h consolidadas
SELECT hour_bucket, pct_of_plan_limit, db_top_categoria, alert_level
FROM obs_hourly_report ORDER BY hour_bucket DESC LIMIT 24;

-- qué ruta cuesta más por visita
SELECT route, AVG(cpu_per_invocation_ms) AS ms_por_visita, SUM(invocations) AS visitas
FROM obs_vercel_usage WHERE route <> '(total)'
GROUP BY route ORDER BY 2 DESC;
```

## Una advertencia sobre `cpu_estimated_ms`

La columna `obs_events.cpu_estimated_ms` es **una estimación, no una cifra
facturable**, y el nombre lo dice a propósito.

Bajo Fluid Compute varias invocaciones comparten un mismo proceso de Node
(*"multiple invocations can share a single function instance"*), y
`process.cpuUsage()` mide el **proceso**, no la petición. Con concurrencia
sobrecuenta.

La cifra real está en `obs_vercel_usage`, que viene medida por Vercel.

## Coste

Casi nulo. Vercel solo factura CPU durante ejecución de código, *"not during
I/O operations"*, y el reporte es casi todo espera de red. Medido: **3,1 s** de
reloj por ejecución, de los cuales la CPU real es una fracción.

En almacenamiento: ~12,5 MB al año para el reporte horario, sobre 500 MB de
cuota y 42 MB en uso.

## Límite vigente

El proyecto tiene una **ampliación de cortesía 3x que caduca el 19-dic-2026**.
Los umbrales de alarma se calculan contra el límite **normal** (4 h), no el
ampliado: avisar solo contra los 12 h daría una falsa sensación de holgura.
