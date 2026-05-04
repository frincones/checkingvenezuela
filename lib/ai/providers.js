/**
 * Abstracción de proveedores LLM con cadena de fallback.
 *
 * Estrategia: Groq primario (free 14,400 RPD); si rate-limit, intenta el siguiente.
 * Cerebras y Gemini quedan como placeholders para conectar cuando se obtengan keys.
 *
 * Uso:
 *   import { getChatModel } from "@/lib/ai/providers";
 *   const model = getChatModel({ tier: "fast" });
 *   await streamText({ model, messages, tools });
 */

import { createGroq } from "@ai-sdk/groq";

// ---------- Lazy provider singletons ----------

let _groqClient = null;
function getGroq() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY no configurada en .env");
  }
  if (!_groqClient) {
    _groqClient = createGroq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groqClient;
}

// ---------- Catálogo de modelos por proveedor + tier ----------

export const MODELS = {
  groq: {
    fast: "llama-3.1-8b-instant", // 14,400 RPD - caballo de batalla
    smart: "openai/gpt-oss-120b", // 1,000 RPD - razonamiento complejo
    longCtx: "llama-3.3-70b-versatile", // 1,000 RPD - contexto extenso
  },
  // Placeholders para fallback futuro
  cerebras: {
    fast: "llama-4-scout-17b-16e-instruct",
  },
  gemini: {
    fast: "gemini-2.5-flash-lite",
  },
};

// ---------- API pública ----------

/**
 * Devuelve un model handle de Vercel AI SDK listo para usar.
 *
 * @param {object} opts
 * @param {"fast"|"smart"|"longCtx"} [opts.tier="fast"]
 * @param {"groq"|"cerebras"|"gemini"} [opts.provider="groq"]
 */
export function getChatModel({ tier = "fast", provider = "groq" } = {}) {
  switch (provider) {
    case "groq": {
      const modelId = MODELS.groq[tier] || MODELS.groq.fast;
      return getGroq()(modelId);
    }
    case "cerebras":
    case "gemini":
      throw new Error(`Provider ${provider} aún no configurado (pendiente API key)`);
    default:
      throw new Error(`Provider desconocido: ${provider}`);
  }
}

/**
 * Cadena de fallback para `streamText` / `generateText`.
 * Devuelve la primera config disponible. El consumidor debe loop:
 *
 *   for (const config of getFallbackChain({ tier: "fast" })) {
 *     try { return await streamText({ model: config.model, ... }); }
 *     catch (e) { if (isRateLimit(e)) continue; throw e; }
 *   }
 */
export function getFallbackChain({ tier = "fast" } = {}) {
  const chain = [];

  // 1. Groq primario
  if (process.env.GROQ_API_KEY) {
    chain.push({
      provider: "groq",
      modelId: MODELS.groq[tier] || MODELS.groq.fast,
      model: getChatModel({ tier, provider: "groq" }),
    });
  }

  // 2. Groq fast (si pidieron smart, intentar fast como fallback)
  if (tier !== "fast" && process.env.GROQ_API_KEY) {
    chain.push({
      provider: "groq",
      modelId: MODELS.groq.fast,
      model: getChatModel({ tier: "fast", provider: "groq" }),
    });
  }

  // 3. Cerebras / Gemini cuando estén configurados (futuro)
  // if (process.env.CEREBRAS_API_KEY) chain.push(...)
  // if (process.env.GEMINI_API_KEY) chain.push(...)

  if (chain.length === 0) {
    throw new Error("No hay proveedores LLM configurados. Define GROQ_API_KEY en .env");
  }
  return chain;
}

/**
 * Detecta si un error es rate-limit / cuota agotada (para activar fallback).
 */
export function isRateLimitError(err) {
  if (!err) return false;
  const status = err.statusCode || err.status;
  if (status === 429) return true;
  const msg = String(err.message || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("quota") || msg.includes("too many");
}
