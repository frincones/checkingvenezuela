/**
 * Cliente admin compartido por las tools (no usa next/headers).
 */

import { createClient } from "@supabase/supabase-js";

let _client = null;

export function admin() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _client;
}

/**
 * Envuelve una función `execute` de tool con un timeout.
 *
 * En vez de tirar excepción, devuelve una shape de error que el MODELO puede
 * leer y actuar (ej: reintentar con otra query, ofrecer talkToHuman, etc.).
 * Esto es importante para self-correction: con MAX_STEPS=6 el modelo tiene
 * pasos de sobra para ver el error y recuperarse.
 *
 * @param {Function} fn - el execute original (recibe args, ctx)
 * @param {object} opts
 * @param {number} [opts.timeoutMs=8000] - timeout antes de devolver error
 * @param {string} [opts.toolName] - nombre de la tool para logging
 * @returns {Function} execute envuelto
 */
export function withToolTimeout(fn, { timeoutMs = 8000, toolName = "tool" } = {}) {
  return async function wrapped(args, ctx) {
    let timer;
    const timeoutPromise = new Promise((resolve) => {
      timer = setTimeout(() => {
        resolve({
          ok: false,
          error: "timeout",
          errorDetail: `${toolName} excedió ${timeoutMs}ms. Reintenta con otros parámetros o sugiere al cliente cotización manual via talkToHuman.`,
          retryable: true,
        });
      }, timeoutMs);
    });
    try {
      const result = await Promise.race([fn(args, ctx), timeoutPromise]);
      return result;
    } catch (err) {
      // Cualquier excepción no controlada se convierte en error estructurado
      // que el modelo puede leer (en vez de crashear el stream).
      return {
        ok: false,
        error: "exception",
        errorDetail: String(err?.message || err).slice(0, 300),
        retryable: false,
      };
    } finally {
      clearTimeout(timer);
    }
  };
}
