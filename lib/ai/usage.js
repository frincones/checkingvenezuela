/**
 * Tracking de uso de proveedores LLM y embeddings.
 * Persiste cada llamada en `kb_usage_log` para métricas y proyección de cuota.
 *
 * Falla silencioso (warn) si la tabla no existe — no debe romper el chat.
 */

import { createClient } from "@supabase/supabase-js";

// Cliente admin standalone (no usa next/headers para que sea importable desde scripts)
let _adminClient = null;
function getAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _adminClient;
}

/**
 * Registra una llamada a un proveedor.
 *
 * @param {object} entry
 * @param {string} entry.provider - 'groq' | 'cerebras' | 'gemini' | 'jina'
 * @param {string} entry.operation - 'chat' | 'embed' | 'embed_query'
 * @param {string} [entry.model]
 * @param {number} [entry.tokens=0]
 * @param {number} [entry.requests=1]
 * @param {string} [entry.conversationId]
 * @param {string} [entry.sourceId]
 * @param {object} [entry.metadata]
 */
export async function logUsage(entry) {
  try {
    const sb = getAdmin();
    const { error } = await sb.from("kb_usage_log").insert({
      provider: entry.provider,
      operation: entry.operation,
      model: entry.model || null,
      tokens: entry.tokens || 0,
      requests: entry.requests || 1,
      conversation_id: entry.conversationId || null,
      source_id: entry.sourceId || null,
      metadata: entry.metadata || {},
    });
    if (error && error.code !== "42P01" && error.code !== "PGRST205") {
      console.warn("[ai/usage] log error:", error.message);
    }
  } catch (err) {
    console.warn("[ai/usage] log exception:", err.message);
  }
}

/**
 * Métricas agregadas para el dashboard de admin.
 *
 * @param {object} opts
 * @param {string} [opts.provider]
 * @param {string} [opts.since] - ISO date string
 */
export async function getUsageStats({ provider, since } = {}) {
  const sb = getAdmin();
  let q = sb.from("kb_usage_log").select("provider, operation, tokens, requests, created_at");
  if (provider) q = q.eq("provider", provider);
  if (since) q = q.gte("created_at", since);
  const { data, error } = await q;
  if (error) throw error;

  const totals = {};
  for (const row of data || []) {
    const key = `${row.provider}/${row.operation}`;
    if (!totals[key]) totals[key] = { tokens: 0, requests: 0 };
    totals[key].tokens += row.tokens || 0;
    totals[key].requests += row.requests || 0;
  }
  return { rows: data || [], totals };
}
