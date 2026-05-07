#!/usr/bin/env node
/**
 * Benchmark Gemini free tier (2.5 flash / flash-lite) vs ganadores previos.
 * Mide: latencia end-to-end, tokens, throughput, tool-calling, thinking budget.
 */

const G_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const C_KEY = process.env.CEREBRAS_API_KEY;
const OR_KEY = process.env.OPENROUTER_API_KEY;

const PROMPT_TOOL = "Hola, qué paquetes tienen para Los Roques? Busco algo bueno bonito y barato.";
const PROMPT_TEXT = "En 2 frases recomiéndame un destino playero en Venezuela para 2 personas con $1500.";

const SYSTEM = `Eres "Vale", asistente de Venezuela Voyages. Tono casual. Cuando el usuario pida info de viajes, llama searchPackages antes de responder.`;

// Tools en formato Gemini
const GEMINI_TOOLS = [
  {
    function_declarations: [
      {
        name: "searchPackages",
        description: "Busca paquetes turísticos. Úsala cuando el cliente pida cotización, precios o ver paquetes de un destino.",
        parameters: {
          type: "object",
          properties: {
            destination: { type: "string", description: "Destino (ej: Los Roques, Margarita)" },
            maxPrice: { type: "number" },
          },
        },
      },
    ],
  },
];

// Tools en formato OpenAI (para Cerebras / OpenRouter comparativo)
const OAI_TOOLS = [
  {
    type: "function",
    function: {
      name: "searchPackages",
      description: "Busca paquetes turísticos. Úsala cuando el cliente pida cotización, precios o ver paquetes de un destino.",
      parameters: {
        type: "object",
        properties: {
          destination: { type: "string" },
          maxPrice: { type: "number" },
        },
      },
    },
  },
];

async function benchGemini(model, prompt, withTools, thinkingBudget = null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${G_KEY}`;
  const body = {
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 250,
      ...(thinkingBudget !== null && {
        thinkingConfig: { thinkingBudget },
      }),
    },
    ...(withTools && { tools: GEMINI_TOOLS, tool_config: { function_calling_config: { mode: "AUTO" } } }),
  };
  const start = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const elapsed = Date.now() - start;
  if (!res.ok) {
    const txt = await res.text();
    return { error: `HTTP ${res.status}: ${txt.slice(0, 200)}`, elapsed };
  }
  const j = await res.json();
  const candidate = j.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const text = parts.find((p) => p.text)?.text || "";
  const fnCall = parts.find((p) => p.functionCall)?.functionCall;
  const usage = j.usageMetadata || {};
  return {
    elapsed,
    tokens_in: usage.promptTokenCount,
    tokens_out: usage.candidatesTokenCount,
    thinking_tokens: usage.thoughtsTokenCount || 0,
    total_tokens: usage.totalTokenCount,
    tool_called: fnCall?.name || null,
    tool_args: fnCall?.args,
    text: text.slice(0, 150),
  };
}

async function benchOpenAI(label, url, headers, model, prompt, withTools) {
  const start = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      max_tokens: 250,
      ...(withTools && { tools: OAI_TOOLS, tool_choice: "auto" }),
    }),
  });
  const elapsed = Date.now() - start;
  if (!res.ok) {
    const txt = await res.text();
    return { error: `HTTP ${res.status}: ${txt.slice(0, 200)}`, elapsed };
  }
  const j = await res.json();
  const msg = j.choices?.[0]?.message;
  return {
    elapsed,
    tokens_out: j.usage?.completion_tokens,
    tool_called: msg?.tool_calls?.[0]?.function?.name || null,
    text: (msg?.content || "").slice(0, 150),
  };
}

async function runs(label, fn, n = 3) {
  const results = [];
  for (let i = 0; i < n; i++) {
    const r = await fn();
    results.push(r);
    if (r.error) {
      console.log(`  [run ${i + 1}] ERROR: ${r.error}`);
      break;
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  const ok = results.filter((r) => !r.error);
  if (ok.length === 0) return { label, error: results[0]?.error };
  ok.sort((a, b) => a.elapsed - b.elapsed);
  const med = ok[Math.floor(ok.length / 2)];
  return { label, ms: ok.map((r) => r.elapsed), median: med };
}

console.log("=== ROUND 1: Tool-calling scenario ===");
console.log(`Prompt: "${PROMPT_TOOL}"\n`);

const tests1 = [
  ["Gemini 2.5 Flash (thinking ON, default)", () => benchGemini("gemini-2.5-flash", PROMPT_TOOL, true)],
  ["Gemini 2.5 Flash (thinking OFF)", () => benchGemini("gemini-2.5-flash", PROMPT_TOOL, true, 0)],
  ["Gemini 2.5 Flash-Lite (thinking OFF)", () => benchGemini("gemini-2.5-flash-lite", PROMPT_TOOL, true, 0)],
  ["Cerebras llama3.1-8b", () => benchOpenAI("cer-llama", "https://api.cerebras.ai/v1/chat/completions", { Authorization: `Bearer ${C_KEY}` }, "llama3.1-8b", PROMPT_TOOL, true)],
];

for (const [label, fn] of tests1) {
  const r = await runs(label, fn);
  if (r.error) {
    console.log(`${label}: FAIL — ${r.error}\n`);
    continue;
  }
  console.log(label);
  console.log(`  runs(ms): ${r.ms.join(", ")} | median: ${r.median.elapsed}ms`);
  console.log(`  tool: ${r.median.tool_called || "(none)"} | text: ${r.median.text || "(empty — went straight to tool)"}`);
  if (r.median.thinking_tokens) console.log(`  thinking_tokens: ${r.median.thinking_tokens}`);
  console.log();
}

console.log("\n=== ROUND 2: Free-text recommendation ===");
console.log(`Prompt: "${PROMPT_TEXT}"\n`);

const tests2 = [
  ["Gemini 2.5 Flash (thinking ON)", () => benchGemini("gemini-2.5-flash", PROMPT_TEXT, false)],
  ["Gemini 2.5 Flash (thinking OFF)", () => benchGemini("gemini-2.5-flash", PROMPT_TEXT, false, 0)],
  ["Gemini 2.5 Flash-Lite (thinking OFF)", () => benchGemini("gemini-2.5-flash-lite", PROMPT_TEXT, false, 0)],
  ["Cerebras llama3.1-8b", () => benchOpenAI("cer-llama", "https://api.cerebras.ai/v1/chat/completions", { Authorization: `Bearer ${C_KEY}` }, "llama3.1-8b", PROMPT_TEXT, false)],
  ["OpenRouter gpt-oss-120b:free", () => benchOpenAI("or-gpt", "https://openrouter.ai/api/v1/chat/completions", { Authorization: `Bearer ${OR_KEY}`, "HTTP-Referer": "http://localhost:3000" }, "openai/gpt-oss-120b:free", PROMPT_TEXT, false)],
];

for (const [label, fn] of tests2) {
  const r = await runs(label, fn);
  if (r.error) {
    console.log(`${label}: FAIL — ${r.error}\n`);
    continue;
  }
  const tokens = r.median.tokens_out || 0;
  const tps = tokens > 0 && r.median.elapsed > 0 ? Math.round((tokens / r.median.elapsed) * 1000) : 0;
  console.log(label);
  console.log(`  runs(ms): ${r.ms.join(", ")} | median: ${r.median.elapsed}ms | ${tokens} tok | ~${tps} tok/s`);
  if (r.median.thinking_tokens) console.log(`  thinking_tokens: ${r.median.thinking_tokens}`);
  console.log(`  text: ${r.median.text}`);
  console.log();
}
