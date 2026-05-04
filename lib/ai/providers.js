/**
 * Abstracción de proveedores LLM con fallback automático.
 *
 * Stack: OpenRouter (aggregator gratis). Usamos su feature nativa de
 * `providerOptions.openrouter.models` que prueba múltiples modelos en una
 * sola request — si el primario está rate-limited upstream, OpenRouter
 * mismo cae al siguiente sin que lo veamos.
 *
 * Modelos seleccionados tras sweep exhaustivo (3 runs c/u con
 * tool_choice='required', medido 2026-05-06):
 *
 *  | Modelo                                       | OK/3 | Tools | Latencia |
 *  |----------------------------------------------|------|-------|----------|
 *  | nvidia/nemotron-3-super-120b-a12b:free       |  3/3 |  3/3  | 1.6s ⭐  |
 *  | inclusionai/ling-2.6-1t:free                 |  3/3 |  3/3  | 1.5s (se va 7-may) |
 *  | openai/gpt-oss-120b:free                     |  3/3 |  3/3  | 14s     |
 *  | google/gemma-4-26b-a4b-it:free               |  0/3 |   -   | rate-limited |
 *  | qwen/llama/glm/etc :free                     |  0/3 |   -   | upstream 429 |
 *
 * Nemotron 3 Super 120B-A12B es MoE (120B params, 12B activos) — mismo
 * speed que Ling pero NO se deprecia. Lo usamos como primario.
 *
 * Cuota: account is_free_tier=false → 1,000 req/día por modelo en :free
 * (vs 50 RPD para cuentas sin top-up). Con 3 modelos = ~3,000 req/día.
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider";

let _orClient = null;
function getOpenRouter() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY no configurada en .env");
  }
  if (!_orClient) {
    _orClient = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      headers: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL || "https://venezuelavoyages.com",
        "X-Title": "Venezuela Voyages Chatbot",
      },
    });
  }
  return _orClient;
}

// Mientras Ling exista (hasta 7-may-2026) lo usamos como primary porque es
// 7x más rápido que nemotron en condiciones reales (1.1s vs 8.2s con tools).
// Después del deprecation date, mover nemotron a primary.
export const MODELS = {
  fast: "inclusionai/ling-2.6-1t:free",
  fastSecondary: "nvidia/nemotron-3-super-120b-a12b:free",
  smart: "openai/gpt-oss-120b:free",
};

/**
 * Devuelve el handle del modelo primario para un tier.
 */
export function getChatModel({ tier = "fast", modelId } = {}) {
  const id = modelId || MODELS[tier] || MODELS.fast;
  return getOpenRouter().chat(id);
}

/**
 * Devuelve la lista de modelos a usar como fallback automático de OpenRouter.
 * Pasar esto a streamText vía providerOptions.openrouter.models.
 *
 * El primer modelo de la lista se usa como `model` (ya pasado en getChatModel),
 * y `models[]` contiene SOLO los siguientes (no incluye el primario).
 */
export function getFallbackModels({ tier = "fast" } = {}) {
  if (tier === "smart") {
    // smart: empieza con gpt-oss-120b, después rápidos
    return [MODELS.fast, MODELS.fastSecondary];
  }
  // fast: empieza con gemma, después gpt-oss-20b, después smart como último
  return [MODELS.fastSecondary, MODELS.smart];
}

/**
 * Detecta errores transitorios que ameritan retry / fallback.
 * (Se usa además del fallback nativo de OR para casos donde OR mismo
 * falla.)
 */
export function isRateLimitError(err) {
  if (!err) return false;
  const status = err.statusCode || err.status;
  if (status === 429 || status === 503 || status === 502) return true;
  const msg = String(err.message || "").toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("rate-limited") ||
    msg.includes("quota") ||
    msg.includes("too many") ||
    msg.includes("upstream") ||
    msg.includes("temporarily")
  );
}
