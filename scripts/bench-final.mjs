#!/usr/bin/env node
/**
 * Bench final: 3 corridas por modelo, no-streaming (más confiable),
 * para tener una mediana real.
 */
const KEY = process.env.CEREBRAS_API_KEY;
const OR_KEY = process.env.OPENROUTER_API_KEY;

const PROMPT = "En 2 frases recomiéndame un destino playero en Venezuela para 2 personas con $1500.";
const SYS = "Eres Vale, asistente de Venezuela Voyages. Tono casual.";

async function run(label, url, headers, body) {
  const start = Date.now();
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const elapsed = Date.now() - start;
  if (!res.ok) return { label, error: `HTTP ${res.status}`, elapsed };
  const j = await res.json();
  const tokens = j.usage?.completion_tokens || 0;
  const tps = j.time_info?.completion_time
    ? Math.round(tokens / j.time_info.completion_time)
    : Math.round((tokens / elapsed) * 1000);
  const text = (j.choices?.[0]?.message?.content || "").slice(0, 100);
  return { label, elapsed, tokens, tps, text };
}

const models = [
  ["Cerebras qwen-3-235b", "https://api.cerebras.ai/v1/chat/completions", { Authorization: `Bearer ${KEY}` }, { model: "qwen-3-235b-a22b-instruct-2507", max_tokens: 200 }],
  ["Cerebras llama3.1-8b", "https://api.cerebras.ai/v1/chat/completions", { Authorization: `Bearer ${KEY}` }, { model: "llama3.1-8b", max_tokens: 200 }],
  ["Cerebras zai-glm-4.7", "https://api.cerebras.ai/v1/chat/completions", { Authorization: `Bearer ${KEY}` }, { model: "zai-glm-4.7", max_tokens: 200 }],
  ["OpenRouter gpt-oss-120b:free", "https://openrouter.ai/api/v1/chat/completions", { Authorization: `Bearer ${OR_KEY}`, "HTTP-Referer": "http://localhost:3000" }, { model: "openai/gpt-oss-120b:free", max_tokens: 200 }],
  ["OpenRouter inclusionai/ling (current fast)", "https://openrouter.ai/api/v1/chat/completions", { Authorization: `Bearer ${OR_KEY}`, "HTTP-Referer": "http://localhost:3000" }, { model: "inclusionai/ling-2.6-1t:free", max_tokens: 200 }],
];

const results = [];
for (const [label, url, headers, body] of models) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const r = await run(label, url, headers, { ...body, messages: [{ role: "system", content: SYS }, { role: "user", content: PROMPT }] });
    runs.push(r);
    await new Promise((r) => setTimeout(r, 800));
  }
  const ok = runs.filter((r) => !r.error);
  if (ok.length === 0) {
    console.log(`\n${label}: FAIL (${runs[0].error})`);
    continue;
  }
  ok.sort((a, b) => a.elapsed - b.elapsed);
  const med = ok[Math.floor(ok.length / 2)];
  results.push({ label, median_ms: med.elapsed, tps: med.tps, sample: med.text });
  console.log(`\n${label}`);
  console.log(`  runs (ms): ${ok.map((r) => r.elapsed).join(", ")}`);
  console.log(`  median: ${med.elapsed}ms | ${med.tokens} tok | ${med.tps} tok/s`);
  console.log(`  sample: ${med.text}…`);
}

console.log("\n\n=== FINAL RANKING (median end-to-end ms, lower=better) ===");
results.sort((a, b) => a.median_ms - b.median_ms);
results.forEach((r, i) => {
  console.log(`  ${i + 1}. ${String(r.median_ms).padStart(5)}ms | ${String(r.tps).padStart(4)} tok/s | ${r.label}`);
});
