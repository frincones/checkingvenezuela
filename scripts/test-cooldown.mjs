#!/usr/bin/env node
/**
 * Test del cooldown registry + fallback selection en providers.js.
 * Sin LLM call: solo verifica el módulo de routing.
 */
import {
  getChatModel,
  markRateLimited,
  isRateLimitError,
  getOpenRouterFallbackModels,
  MODELS,
} from "../lib/ai/providers.js";

let pass = 0;
let fail = 0;
const fails = [];

function test(label, fn) {
  try {
    fn();
    console.log(`✅ ${label}`);
    pass++;
  } catch (e) {
    console.log(`❌ ${label}`);
    console.log(`     ${e.message}`);
    fail++;
    fails.push({ label, reason: e.message });
  }
}

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`);
}
function assertContains(arr, item, msg) {
  if (!arr.includes(item)) throw new Error(`${msg}: ${JSON.stringify(arr)} does not include ${item}`);
}

console.log("=== Cooldown + fallback test ===\n");

// 1. Modelo primary por default → Gemini
test("Sin cooldown, primary tier devuelve Gemini", () => {
  const m = getChatModel({ tier: "primary" });
  assertEq(m.modelId, MODELS.primary.id, "primary modelId");
  assertEq(m.provider, "google", "primary provider");
});

// 2. Marcar Gemini como rate-limited → siguiente request salta a Nemotron
test("Tras markRateLimited(Gemini), primary tier salta a Nemotron", () => {
  markRateLimited(MODELS.primary.id);
  const m = getChatModel({ tier: "primary" });
  assertEq(m.modelId, MODELS.hotFallback.id, "hot fallback modelId");
  assertEq(m.provider, "openrouter", "fallback provider");
});

// 3. Marcar también Nemotron → cae a gpt-oss
test("Tras 2 cooldowns (Gemini+Nemotron), cae a gpt-oss-120b", () => {
  markRateLimited(MODELS.hotFallback.id);
  const m = getChatModel({ tier: "primary" });
  assertEq(m.modelId, MODELS.coldFallback.id, "cold fallback modelId");
});

// 4. Wait 100ms — los 3 siguen en cooldown (60s default), debería devolver primary igual (mejor intentar)
test("Con todos en cooldown, fallback devuelve primary (mejor intentar que dar 503)", () => {
  markRateLimited(MODELS.coldFallback.id);
  const m = getChatModel({ tier: "primary" });
  // Implementation devuelve order[0] cuando todo está en cooldown
  assertEq(m.modelId, MODELS.primary.id, "fallback to primary anyway");
});

// 5. tier='smart' debe priorizar el reasoning model (gpt-oss)
test("tier=smart prioriza gpt-oss-120b (reasoning) primero", () => {
  // Limpiar cooldowns esperando — pero como son 60s no podemos.
  // Forzamos: los cooldowns siguen activos, pero la order para smart
  // empieza con coldFallback (gpt-oss), y como todo está en cooldown
  // devuelve igual el primero del order.
  const m = getChatModel({ tier: "smart" });
  assertEq(m.modelId, MODELS.coldFallback.id, "smart tier picks gpt-oss first");
});

// 6. getOpenRouterFallbackModels excluye el modelo activo
test("getOpenRouterFallbackModels devuelve los OTROS modelos OR (sin el activo)", () => {
  const arr = getOpenRouterFallbackModels(MODELS.hotFallback.id);
  assertEq(arr.length, 1, "1 modelo restante");
  assertEq(arr[0], MODELS.coldFallback.id, "el restante es coldFallback");
});

// 7. isRateLimitError detecta variantes
test("isRateLimitError detecta 429, 503, mensajes con 'rate limit'", () => {
  if (!isRateLimitError({ status: 429 })) throw new Error("status 429");
  if (!isRateLimitError({ status: 503 })) throw new Error("status 503");
  if (!isRateLimitError({ statusCode: 502 })) throw new Error("statusCode 502");
  if (!isRateLimitError({ message: "rate limit exceeded" })) throw new Error("rate limit");
  if (!isRateLimitError({ message: "quota exceeded" })) throw new Error("quota");
  if (!isRateLimitError({ message: "Too Many Requests" })) throw new Error("too many");
  if (isRateLimitError({ status: 200 })) throw new Error("false positive on 200");
  if (isRateLimitError(null)) throw new Error("false positive on null");
});

console.log(`\n=========================================`);
console.log(`SUMMARY: ${pass}/${pass + fail} passed | ${fail} failed`);
if (fails.length) {
  console.log(`\nFails:`);
  fails.forEach((f) => console.log(`  ${f.label}: ${f.reason}`));
}
console.log(`=========================================`);
process.exit(fail > 0 ? 1 : 0);
