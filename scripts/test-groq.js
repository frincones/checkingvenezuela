/**
 * Valida acceso al free tier de Groq con llama-3.1-8b-instant.
 * Comprueba: API key, chat completion, tool calling, latencia y rate-limit headers.
 *
 * Uso: node scripts/test-groq.js
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const Groq = require("groq-sdk");

const MODEL = "llama-3.1-8b-instant";
const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.error("❌ Falta GROQ_API_KEY en .env");
  console.error("   Obtén una gratis en https://console.groq.com/keys");
  process.exit(1);
}

const groq = new Groq({ apiKey });

function logRateLimit(headers) {
  if (!headers) return;
  const keys = [
    "x-ratelimit-limit-requests",
    "x-ratelimit-remaining-requests",
    "x-ratelimit-limit-tokens",
    "x-ratelimit-remaining-tokens",
    "x-ratelimit-reset-requests",
    "x-ratelimit-reset-tokens",
  ];
  console.log("\n📊 Rate-limit headers:");
  for (const k of keys) {
    const v = headers.get ? headers.get(k) : headers[k];
    if (v) console.log(`   ${k}: ${v}`);
  }
}

async function testChat() {
  console.log(`\n🧪 Test 1: Chat completion básico (${MODEL})`);
  const t0 = Date.now();
  const { data, response } = await groq.chat.completions
    .create({
      model: MODEL,
      messages: [
        { role: "system", content: "Eres un asistente de viajes para Venezuela Voyages. Responde en español, breve." },
        { role: "user", content: "¿Cuál es el mejor mes para visitar Los Roques?" },
      ],
      max_tokens: 150,
      temperature: 0.7,
    })
    .withResponse();

  const latency = Date.now() - t0;
  const choice = data.choices[0];
  console.log(`   ✅ OK (${latency} ms)`);
  console.log(`   Modelo: ${data.model}`);
  console.log(`   Tokens: prompt=${data.usage.prompt_tokens} | completion=${data.usage.completion_tokens} | total=${data.usage.total_tokens}`);
  console.log(`   Respuesta: ${choice.message.content.trim().slice(0, 200)}...`);
  logRateLimit(response.headers);
}

async function testToolCalling() {
  console.log(`\n🧪 Test 2: Tool calling (crítico para multi-agente)`);
  const tools = [
    {
      type: "function",
      function: {
        name: "search_flights",
        description: "Busca vuelos disponibles entre dos ciudades",
        parameters: {
          type: "object",
          properties: {
            origin: { type: "string", description: "Ciudad de origen" },
            destination: { type: "string", description: "Ciudad de destino" },
            date: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
          },
          required: ["origin", "destination", "date"],
        },
      },
    },
  ];

  const t0 = Date.now();
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: "Eres un agente de viajes. Usa las tools disponibles." },
      { role: "user", content: "Busca vuelos de Caracas a Margarita para el 15 de junio de 2026" },
    ],
    tools,
    tool_choice: "auto",
    max_tokens: 200,
  });

  const latency = Date.now() - t0;
  const msg = res.choices[0].message;
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const call = msg.tool_calls[0];
    console.log(`   ✅ Tool call detectado (${latency} ms)`);
    console.log(`   Función: ${call.function.name}`);
    console.log(`   Args: ${call.function.arguments}`);
  } else {
    console.log(`   ⚠️  No se detectó tool call (respondió texto):`);
    console.log(`   ${msg.content?.slice(0, 200)}`);
  }
}

async function testStreaming() {
  console.log(`\n🧪 Test 3: Streaming (para UX de chat)`);
  const t0 = Date.now();
  let firstTokenAt = null;
  let totalChunks = 0;
  let fullText = "";

  const stream = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: "Lista 3 destinos turísticos de Venezuela en una línea cada uno." }],
    stream: true,
    max_tokens: 100,
  });

  for await (const chunk of stream) {
    if (!firstTokenAt) firstTokenAt = Date.now() - t0;
    const delta = chunk.choices[0]?.delta?.content || "";
    fullText += delta;
    totalChunks++;
  }

  const totalTime = Date.now() - t0;
  console.log(`   ✅ Stream OK`);
  console.log(`   Time-to-first-token: ${firstTokenAt} ms`);
  console.log(`   Chunks recibidos: ${totalChunks}`);
  console.log(`   Tiempo total: ${totalTime} ms`);
  console.log(`   Respuesta:\n   ${fullText.trim().split("\n").join("\n   ")}`);
}

(async () => {
  console.log("🔍 Validando acceso a Groq free tier");
  console.log(`   API key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);
  console.log(`   Modelo: ${MODEL}`);
  console.log(`   Límites esperados free: 30 RPM | 14,400 RPD | 6K TPM | 500K TPD | 131K ctx`);

  try {
    await testChat();
    await testToolCalling();
    await testStreaming();
    console.log("\n✅ Validación completa. Groq está listo para integrar.\n");
  } catch (err) {
    console.error("\n❌ Error durante la validación:");
    console.error(`   ${err.message}`);
    if (err.status === 401) console.error("   → API key inválida. Regenera en https://console.groq.com/keys");
    if (err.status === 429) console.error("   → Rate limit alcanzado. Espera un minuto.");
    if (err.status === 404) console.error("   → Modelo no disponible. Revisa https://console.groq.com/docs/models");
    process.exit(1);
  }
})();
