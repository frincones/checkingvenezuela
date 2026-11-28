/**
 * Conexion directa a Postgres — ruta de emergencia mientras Supabase esta
 * restringido por egress.
 *
 * CONTEXTO
 * ========
 * El 2026-11-27 Supabase aplico `exceed_egress_quota` al proyecto (6,65 GB de
 * 5,5 GB). La restriccion devuelve HTTP 402 en todos los servicios HTTP:
 * PostgREST, Auth, Storage, Realtime, Edge Functions.
 *
 * La base de datos en si NO esta restringida: acepta conexiones por el pooler
 * con normalidad (verificado el 2026-11-27 con lectura y escritura reales).
 * Este modulo es la puerta por la que la aplicacion sigue leyendo y escribiendo
 * mientras la cuota no se recarga (2026-12-04).
 *
 * HOST
 * ====
 * Solo funciona `aws-1-us-east-1.pooler.supabase.com`. Comprobado el mismo dia:
 *   - aws-0-us-east-1.pooler.supabase.com -> "tenant/user not found"
 *   - db.<ref>.supabase.co               -> no resuelve (ENOTFOUND)
 * No cambiar el host por el que aparece en documentacion generica.
 *
 * PUERTO
 * ======
 * 6543 es el pooler en modo transaccion, que es el adecuado para funciones
 * serverless: cada invocacion toma y suelta la conexion. El 5432 (modo sesion)
 * tambien responde, pero mantiene la conexion ocupada y se agota el limite con
 * trafico concurrente.
 *
 * TEMPORAL
 * ========
 * Esta ruta se desactiva quitando PG_FALLBACK_ENABLED. Sin esa variable, la
 * aplicacion se comporta exactamente como antes: este modulo no se usa.
 */

import { Pool } from "pg";

/** Cache del pool entre invocaciones calientes de la misma lambda. */
let pool = null;

/** @returns {boolean} true si la ruta de emergencia esta activada. */
export function isPgFallbackEnabled() {
  return (
    process.env.PG_FALLBACK_ENABLED === "true" &&
    Boolean(process.env.SUPABASE_DB_URL || process.env.SUPABASE_DB_PASSWORD)
  );
}

/**
 * Construye la cadena de conexion.
 *
 * Se admite SUPABASE_DB_URL completa, o SUPABASE_DB_PASSWORD y se arma con el
 * host y el usuario derivados del proyecto. La contrasena se codifica con
 * encodeURIComponent porque contiene caracteres (`*`, `.`) que de otro modo
 * rompen el parseo de la URL.
 */
function buildConnectionString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;

  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    throw new Error(
      "pg: falta SUPABASE_DB_URL o SUPABASE_DB_PASSWORD en el entorno",
    );
  }

  // El ref del proyecto sale de la URL publica de Supabase, que ya existe en el
  // entorno: https://<ref>.supabase.co
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
  if (!ref) {
    throw new Error(
      "pg: no se pudo deducir el ref del proyecto de NEXT_PUBLIC_SUPABASE_URL",
    );
  }

  const host =
    process.env.SUPABASE_DB_HOST || "aws-1-us-east-1.pooler.supabase.com";
  const port = process.env.SUPABASE_DB_PORT || "6543";

  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
}

/** @returns {import("pg").Pool} */
export function getPool() {
  if (pool) return pool;

  pool = new Pool({
    connectionString: buildConnectionString(),
    // El pooler de Supabase presenta un certificado que no valida contra la
    // cadena por defecto de Node. La conexion sigue cifrada por TLS; lo que se
    // omite es la verificacion del emisor. Es el mismo modo en que el SDK de
    // Supabase habla con el pooler.
    ssl: { rejectUnauthorized: false },
    // Pocas conexiones: en serverless cada instancia abre su propio pool y el
    // plan Free limita el total. Mejor esperar turno que agotar el limite.
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

  // Sin este manejador, un error de un cliente inactivo tumba el proceso.
  pool.on("error", (err) => {
    console.error("[pg] error en cliente inactivo:", err?.message || err);
  });

  return pool;
}

/**
 * Ejecuta una consulta parametrizada.
 *
 * Los valores SIEMPRE van como parametros ($1, $2...), nunca interpolados en el
 * texto del SQL: es lo que evita la inyeccion.
 *
 * @param {string} text
 * @param {unknown[]} [params]
 */
export async function query(text, params = []) {
  const started = Date.now();
  try {
    const res = await getPool().query(text, params);
    return res;
  } catch (err) {
    console.error(
      `[pg] fallo la consulta (${Date.now() - started}ms):`,
      err?.message || err,
    );
    throw err;
  }
}
