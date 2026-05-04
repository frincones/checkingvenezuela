/**
 * Abstracción de proveedores LLM con cadena de fallback.
 *
 * Stack actual: OpenRouter como aggregator gratis. Modelos seleccionados
 * por su disponibilidad real (los proveedores upstream Venice / OpenInference
 * tienden a saturarse, así que mantenemos varios para fallback automático):
 *
 *  - inclusionai/ling-2.6-1t:free  → ~1s, 262K ctx, tools ✅ (primary fast)
 *  - z-ai/glm-4.5-air:free          → ~4s, 131K ctx, tools ✅ (secondary fast)
 *  - openai/gpt-oss-120b:free       → ~18s, 131K ctx, tools ✅ (last-resort smart)
 *
 * Cuota: account is_free_tier=false → 1,000 req/día por modelo en :free
 * (vs 50 RPD para cuentas sin top-up). Total ~3,000 req/día combinados.
 *
 * Uso:
 *   import { getChatModel } from "@/lib/ai/providers";
 *   const model = getChatModel({ tier: "fast" });
 *   await streamText({ model, messages, tools });
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// ---------- Lazy provider singleton ----------

let _orClient = null;
function getOpenRouter() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY no configurada en .env");
  }
  if (!_orClient) {
    _orClient = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      // Headers opcionales recomendados por OR para mejor routing/quota
      headers: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL || "https://venezuelavoyages.com",
        "X-Title": "Venezuela Voyages Chatbot",
      },
    });
  }
  return _orClient;
}

// ---------- Catálogo de modelos por tier ----------

export const MODELS = {
  openrouter: {
    fast: "inclusionai/ling-2.6-1t:free",
    fastSecondary: "z-ai/glm-4.5-air:free",
    smart: "openai/gpt-oss-120b:free",
  },
};

// ---------- API pública ----------

/**
 * Devuelve un model handle de Vercel AI SDK.
 *
 * @param {object} opts
 * @param {"fast"|"smart"} [opts.tier="fast"]
 * @param {string} [opts.modelId] - override directo
 */
export function getChatModel({ tier = "fast", modelId } = {}) {
  const id =
    modelId ||
    MODELS.openrouter[tier] ||
    MODELS.openrouter.fast;
  return getOpenRouter().chat(id);
}

/**
 * Cadena de fallback. Cada modelo se prueba en orden si el anterior falla.
 *
 * Para tier='fast': cadena rápida (ling → glm-air → gpt-oss-120b).
 * Para tier='smart': empieza con gpt-oss-120b directo, después fast.
 */
export function getFallbackChain({ tier = "fast" } = {}) {
  const chain = [];
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "No hay proveedores LLM configurados. Define OPENROUTER_API_KEY en .env"
    );
  }

  if (tier === "smart") {
    chain.push({
      provider: "openrouter",
      modelId: MODELS.openrouter.smart,
      model: getChatModel({ modelId: MODELS.openrouter.smart }),
    });
    chain.push({
      provider: "openrouter",
      modelId: MODELS.openrouter.fast,
      model: getChatModel({ modelId: MODELS.openrouter.fast }),
    });
    chain.push({
      provider: "openrouter",
      modelId: MODELS.openrouter.fastSecondary,
      model: getChatModel({ modelId: MODELS.openrouter.fastSecondary }),
    });
  } else {
    chain.push({
      provider: "openrouter",
      modelId: MODELS.openrouter.fast,
      model: getChatModel({ modelId: MODELS.openrouter.fast }),
    });
    chain.push({
      provider: "openrouter",
      modelId: MODELS.openrouter.fastSecondary,
      model: getChatModel({ modelId: MODELS.openrouter.fastSecondary }),
    });
    chain.push({
      provider: "openrouter",
      modelId: MODELS.openrouter.smart,
      model: getChatModel({ modelId: MODELS.openrouter.smart }),
    });
  }

  return chain;
}

/**
 * Detecta errores transitorios que ameritan fallback (rate-limit, upstream busy, etc.).
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
