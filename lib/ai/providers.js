/**
 * Abstracción de proveedores LLM con fallback automático.
 *
 * Stack: OpenRouter (aggregator gratis). Usamos su feature nativa de
 * `providerOptions.openrouter.models` que prueba múltiples modelos en una
 * sola request — si el primario está rate-limited upstream (Venice / Google
 * AI Studio / etc), OpenRouter mismo cae al siguiente sin que lo veamos.
 *
 * Modelos seleccionados por sweep de disponibilidad real + tool support:
 *  - google/gemma-4-26b-a4b-it:free  → ~1.5s, 262K ctx, tools ✅ (primary)
 *  - openai/gpt-oss-20b:free         → ~11s,  131K ctx, tools ✅ (secondary)
 *  - openai/gpt-oss-120b:free        → ~18s,  131K ctx, tools ✅ (smart/last)
 *
 * Cuota: account is_free_tier=false → 1,000 req/día por modelo en :free
 * (vs 50 RPD para cuentas sin top-up). Total ~3,000 req/día.
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

export const MODELS = {
  fast: "google/gemma-4-26b-a4b-it:free",
  fastSecondary: "openai/gpt-oss-20b:free",
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
