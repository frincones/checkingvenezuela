#!/usr/bin/env node
/**
 * Benchmark: Cerebras gpt-oss-120b vs OpenRouter gpt-oss-120b:free
 * Mide TTFT + throughput + tool-calling con un caso real de Vale.
 */

const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

if (!CEREBRAS_KEY) {
  console.error("CEREBRAS_API_KEY missing");
  process.exit(1);
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "searchPackages",
      description:
        "Busca paquetes turísticos. Úsala cuando el cliente pida cotización, precios o ver paquetes de un destino.",
      parameters: {
        type: "object",
        properties: {
          destination: { type: "string", description: "Destino (ej: Los Roques, Margarita)" },
          maxPrice: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchDestinations",
      description:
        "Lista destinos del catálogo. Úsala cuando el cliente pregunte qué destinos hay o qué ofrecen.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
      },
    },
  },
];

const SYSTEM = `Eres "Vale", asistente de Venezuela Voyages. Tono casual, amigo viajero. Brevísimo (máx 3 frases). Llama tools antes de responder cuando el usuario pida info de viajes.`;

async function bench(name, url, headers, body) {
  console.log(`\n=== ${name} ===`);
  const start = Date.now();
  let firstTokenAt = null;
  let totalTokens = 0;
  let toolCalled = null;
  let textChunks = [];

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`  HTTP ${res.status}: ${txt.slice(0, 300)}`);
      return null;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta;
          if (!delta) continue;
          if (firstTokenAt === null) firstTokenAt = Date.now();
          if (delta.content) {
            textChunks.push(delta.content);
            totalTokens++;
          }
          if (delta.tool_calls) {
            toolCalled = delta.tool_calls[0]?.function?.name || "(unknown)";
          }
        } catch {}
      }
    }

    const total = Date.now() - start;
    const ttft = firstTokenAt ? firstTokenAt - start : null;
    const genTime = firstTokenAt ? total - ttft : 0;
    const tps = genTime > 0 ? ((totalTokens / genTime) * 1000).toFixed(0) : 0;

    console.log(`  TTFT:        ${ttft}ms`);
    console.log(`  Total:       ${total}ms`);
    console.log(`  Tokens out:  ${totalTokens}`);
    console.log(`  Throughput:  ${tps} tok/s`);
    console.log(`  Tool called: ${toolCalled || "(none)"}`);
    console.log(`  Text:        ${textChunks.join("").slice(0, 120)}${textChunks.length > 120 ? "…" : ""}`);

    return { ttft, total, tps: Number(tps), toolCalled };
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
    return null;
  }
}

const userMsg = "Hola, qué paquetes tienen para Los Roques? Busco algo bueno bonito y barato.";

const cases = [
  {
    name: "Cerebras gpt-oss-120b (with tools)",
    url: "https://api.cerebras.ai/v1/chat/completions",
    headers: { Authorization: `Bearer ${CEREBRAS_KEY}` },
    body: {
      model: "gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 300,
    },
  },
  {
    name: "Cerebras gpt-oss-120b (no tools, plain chat)",
    url: "https://api.cerebras.ai/v1/chat/completions",
    headers: { Authorization: `Bearer ${CEREBRAS_KEY}` },
    body: {
      model: "gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: "Hola, cómo estás?" },
      ],
      max_tokens: 100,
    },
  },
  {
    name: "Cerebras qwen-3-235b (with tools)",
    url: "https://api.cerebras.ai/v1/chat/completions",
    headers: { Authorization: `Bearer ${CEREBRAS_KEY}` },
    body: {
      model: "qwen-3-235b-a22b-instruct-2507",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 300,
    },
  },
  {
    name: "Cerebras llama3.1-8b (with tools)",
    url: "https://api.cerebras.ai/v1/chat/completions",
    headers: { Authorization: `Bearer ${CEREBRAS_KEY}` },
    body: {
      model: "llama3.1-8b",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 300,
    },
  },
];

if (OPENROUTER_KEY) {
  cases.push({
    name: "OpenRouter gpt-oss-120b:free (with tools)",
    url: "https://openrouter.ai/api/v1/chat/completions",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Vale Bench",
    },
    body: {
      model: "openai/gpt-oss-120b:free",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg },
      ],
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 300,
    },
  });
}

console.log(`Benchmark started. Prompt: "${userMsg}"`);

const results = [];
for (const c of cases) {
  const r = await bench(c.name, c.url, c.headers, c.body);
  if (r) results.push({ name: c.name, ...r });
  await new Promise((r) => setTimeout(r, 500));
}

console.log("\n\n=== SUMMARY (sorted by TTFT) ===");
results
  .sort((a, b) => (a.ttft || 99999) - (b.ttft || 99999))
  .forEach((r) => {
    console.log(
      `  ${String(r.ttft).padStart(5)}ms TTFT | ${String(r.tps).padStart(5)} tok/s | tool=${r.toolCalled || "no"} | ${r.name}`
    );
  });
