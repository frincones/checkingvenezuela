/**
 * Valida la capa LLM en lib/ai/.
 * Uso: node scripts/test-llm-layer.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.GROQ_API_KEY) {
  console.error("❌ Falta GROQ_API_KEY en .env");
  process.exit(1);
}
if (!process.env.JINA_API_KEY) {
  console.error("❌ Falta JINA_API_KEY en .env");
  process.exit(1);
}

// Imports relativos a lib/ai/ (ESM puro)
const aiPath = (rel) => path.join(__dirname, "..", "lib", "ai", rel);

const { detectLanguage } = await import(`file:///${aiPath("utils.js").replace(/\\/g, "/")}`);
const { embed, embedBatch, EMBEDDING_DIMENSIONS } = await import(
  `file:///${aiPath("embeddings.js").replace(/\\/g, "/")}`
);
const { getChatModel, getFallbackChain } = await import(
  `file:///${aiPath("providers.js").replace(/\\/g, "/")}`
);
const { classifyIntent } = await import(
  `file:///${aiPath("prompts/intent.js").replace(/\\/g, "/")}`
);
const { getSystemPrompt } = await import(
  `file:///${aiPath("prompts/system.js").replace(/\\/g, "/")}`
);
const { getConsentText } = await import(
  `file:///${aiPath("prompts/consent.js").replace(/\\/g, "/")}`
);
const { generateText } = await import("ai");

console.log("🔍 Validando capa LLM (lib/ai/)\n");

// === 1. Detección de idioma ===
console.log("🧪 Test 1: Detección de idioma");
const samples = [
  { text: "hola, quiero ir a Los Roques en julio", expected: "es" },
  { text: "hi, I want to visit Margarita next month", expected: "en" },
  { text: "¿cuál es el mejor mes?", expected: "es" },
  { text: "what is the best month for the beach?", expected: "en" },
];
for (const s of samples) {
  const got = detectLanguage(s.text);
  const ok = got === s.expected ? "✅" : "❌";
  console.log(`   ${ok} "${s.text.slice(0, 40)}..." → ${got} (esperado: ${s.expected})`);
}

// === 2. Embedding Jina ===
console.log("\n🧪 Test 2: Embeddings Jina v3");
let t0 = Date.now();
const vec = await embed(
  "Los Roques es un archipiélago paradisíaco en el Caribe venezolano"
);
const lat1 = Date.now() - t0;
console.log(`   ✅ embed() OK (${lat1} ms)`);
console.log(`   Dimensiones: ${vec.length} (esperado: ${EMBEDDING_DIMENSIONS})`);
console.log(
  `   Primeros 5 valores: [${vec.slice(0, 5).map((n) => n.toFixed(4)).join(", ")}]`
);

t0 = Date.now();
const { embeddings, totalTokens } = await embedBatch([
  "Margarita es la perla del Caribe",
  "Canaima tiene los tepuyes más altos del mundo",
  "Mérida tiene el teleférico más largo del mundo",
]);
const lat2 = Date.now() - t0;
console.log(
  `   ✅ embedBatch(3) OK (${lat2} ms, ${totalTokens} tokens, ${embeddings.length} vectores)`
);

// === 3. Provider + generateText ===
console.log("\n🧪 Test 3: Provider Groq (generateText)");
const model = getChatModel({ tier: "fast", provider: "groq" });
t0 = Date.now();
const { text, usage } = await generateText({
  model,
  prompt: "Di solamente la palabra 'OK' y nada más.",
  temperature: 0,
});
const lat3 = Date.now() - t0;
console.log(`   ✅ generateText OK (${lat3} ms)`);
console.log(`   Respuesta: "${text.trim()}"`);
console.log(`   Tokens: ${JSON.stringify(usage)}`);

// === 4. Cadena de fallback ===
console.log("\n🧪 Test 4: Cadena de fallback");
const chain = getFallbackChain({ tier: "fast" });
console.log(`   ✅ Cadena tiene ${chain.length} proveedor(es):`);
chain.forEach((c, i) => console.log(`      ${i + 1}. ${c.provider} / ${c.modelId}`));

// === 5. Intent classifier ===
console.log("\n🧪 Test 5: Intent classifier");
const intents = [
  { msg: "hola!", expected: "chitchat" },
  { msg: "quiero un paquete a Margarita 5 días", expected: "booking" },
  { msg: "¿puedo cancelar mi reserva con 7 días de anticipación?", expected: "policy" },
  { msg: "me cobraron mal el último viaje, quiero hablar con alguien", expected: "complaint" },
  { msg: "¿qué clima hay en Los Roques en julio?", expected: "info" },
];
for (const i of intents) {
  const got = await classifyIntent({ message: i.msg, language: "es" });
  const ok = got === i.expected ? "✅" : "⚠️ ";
  console.log(`   ${ok} "${i.msg.slice(0, 50)}..." → ${got} (esperado: ${i.expected})`);
}

// === 6. System prompt builder ===
console.log("\n🧪 Test 6: System prompts (es/en)");
const promptEs = getSystemPrompt({ language: "es" });
const promptEn = getSystemPrompt({ language: "en" });
console.log(
  `   ✅ ES prompt: ${promptEs.length} chars (incluye 'amigo viajero': ${promptEs.includes("amigo viajero")})`
);
console.log(
  `   ✅ EN prompt: ${promptEn.length} chars (incluye 'traveling friend': ${promptEn.includes("traveling friend")})`
);

// === 7. Consent text ===
console.log("\n🧪 Test 7: Consent text");
const cEs = getConsentText("es");
const cEn = getConsentText("en");
console.log(`   ✅ ES: "${cEs.title}" → ${cEs.body.length} chars`);
console.log(`   ✅ EN: "${cEn.title}" → ${cEn.body.length} chars`);

console.log("\n✅ Capa LLM validada. Lista para Fase 2.\n");
