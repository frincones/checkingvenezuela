/**
 * Abstracción de proveedores LLM con fallback automático multi-provider.
 *
 * NUEVA ARQUITECTURA (post-2026-05-06):
 *
 *  Primary:   Google Gemini 2.5 Flash (directo, NO via OpenRouter)
 *             - Reasoning + tools nativo, ~900ms TTFT (thinking OFF)
 *             - Free: 10 RPM / 250 RPD / 250K TPM
 *             - SDK: @ai-sdk/google
 *
 *  Hot fallback (OpenRouter): nvidia/nemotron-3-super-120b-a12b:free
 *             - Tool-calling 3/3, ~1.6s, 1k RPD/modelo
 *
 *  Cold fallback (OpenRouter): openai/gpt-oss-120b:free
 *             - Reasoning + tools, ~1s, 1k RPD/modelo
 *
 * Killed:
 *  - inclusionai/ling-2.6-1t:free (deprecada 2026-05-07)
 *  - cerebras/llama-3.1-8b (tool-call inconsistente: a veces emite JSON-as-text)
 *
 * Cuota efectiva: 250 (Gemini) + 1000 (Nemotron) + 1000 (gpt-oss) = ~2250 turnos/día.
 *
 * Routing: el cooldown registry abajo trackea 429 por modelo en memoria del
 * proceso (Vercel function instance). Si Gemini fue rate-limited en los
 * últimos 60s, getChatModel salta directo al fallback. No hay caché entre
 * instancias — cada cold start arranca con cooldown limpio.
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// ---------- Cooldown registry (in-process) ----------

const COOLDOWNS = new Map(); // modelId → epoch ms when cooldown ends
const COOLDOWN_MS = 60_000;

function isCooledDown(modelId) {
  const until = COOLDOWNS.get(modelId);
  if (!until) return false;
  if (Date.now() >= until) {
    COOLDOWNS.delete(modelId);
    return false;
  }
  return true;
}

export function markRateLimited(modelId) {
  if (!modelId) return;
  COOLDOWNS.set(modelId, Date.now() + COOLDOWN_MS);
}

// ---------- OpenRouter client (fallback chain) ----------

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

// ---------- Google client (Gemini primary) ----------

let _googleClient = null;
function getGoogle() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return null; // permite degradar grácilmente a OR-only si la key no está
  }
  if (!_googleClient) {
    _googleClient = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
  }
  return _googleClient;
}

// ---------- Catálogo de modelos ----------

export const MODELS = {
  primary: {
    provider: "google",
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
  },
  hotFallback: {
    provider: "openrouter",
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "Nemotron 3 Super 120B-A12B",
  },
  coldFallback: {
    provider: "openrouter",
    id: "openai/gpt-oss-120b:free",
    label: "GPT-OSS 120B",
  },
};

/**
 * Devuelve el primer modelo disponible (no-cooldown) en el fallback chain.
 * El llamador debe usar `getChatModel({ tier })` que ya hace este pick.
 */
function pickActiveModel(tier = "primary") {
  const order = tier === "smart"
    ? [MODELS.coldFallback, MODELS.primary, MODELS.hotFallback] // smart: gpt-oss reasoning primero
    : [MODELS.primary, MODELS.hotFallback, MODELS.coldFallback]; // default: Gemini → Nemotron → gpt-oss

  for (const m of order) {
    if (isCooledDown(m.id)) continue;
    if (m.provider === "google" && !getGoogle()) continue; // sin key Gemini
    return m;
  }
  // Si todos están en cooldown, devolvemos el primary igual (mejor intentar
  // que dar 503; el fallback nativo de OR puede salvar la request).
  return order[0];
}

/**
 * Devuelve el handle del modelo a usar para esta request.
 * `tier`: 'primary' (default, fast turn) | 'smart' (razonamiento profundo)
 */
export function getChatModel({ tier = "primary", modelId } = {}) {
  if (modelId) {
    // Override directo (testing). Asume que es un id de OpenRouter.
    return { handle: getOpenRouter().chat(modelId), modelId, provider: "openrouter" };
  }

  const picked = pickActiveModel(tier);

  if (picked.provider === "google") {
    const g = getGoogle();
    return {
      handle: g(picked.id),
      modelId: picked.id,
      provider: "google",
      label: picked.label,
    };
  }

  return {
    handle: getOpenRouter().chat(picked.id),
    modelId: picked.id,
    provider: "openrouter",
    label: picked.label,
  };
}

/**
 * Modelos OpenRouter para `providerOptions.openrouter.models`.
 * Solo aplica cuando el modelo activo ES OpenRouter (no para Gemini).
 * Devuelve los OTROS dos OR para que OR mismo haga el auto-failover upstream.
 */
export function getOpenRouterFallbackModels(activeModelId) {
  const all = [MODELS.hotFallback.id, MODELS.coldFallback.id];
  return all.filter((id) => id !== activeModelId);
}

/**
 * Detecta errores transitorios que ameritan retry / fallback + cooldown.
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

// ---------- Compat layer (transitional) ----------
//
// El código viejo importaba `MODELS.fast / MODELS.smart` y `getFallbackModels`.
// Mientras migramos los call-sites, mantenemos shims:
//
export function getFallbackModels({ tier = "primary" } = {}) {
  const active = pickActiveModel(tier);
  return getOpenRouterFallbackModels(active.id);
}
