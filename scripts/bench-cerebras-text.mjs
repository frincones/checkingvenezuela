#!/usr/bin/env node
/**
 * Segunda ronda: medimos throughput REAL en respuesta libre (sin tool call),
 * y rate-limit headers, para qwen-3-235b y llama3.1-8b.
 */

const KEY = process.env.CEREBRAS_API_KEY;

async function bench(model, msg) {
  console.log(`\n=== ${model} ===`);
  const start = Date.now();
  let firstTokenAt = null;
  let totalTokens = 0;
  let textChunks = [];

  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Eres Vale, asistente de Venezuela Voyages. Tono casual." },
        { role: "user", content: msg },
      ],
      max_tokens: 250,
      stream: true,
    }),
  });

  // Rate limit headers
  const rl = {
    rpm_limit: res.headers.get("x-ratelimit-limit-requests-minute"),
    rpm_remain: res.headers.get("x-ratelimit-remaining-requests-minute"),
    rpd_limit: res.headers.get("x-ratelimit-limit-requests-day"),
    rpd_remain: res.headers.get("x-ratelimit-remaining-requests-day"),
    tpm_limit: res.headers.get("x-ratelimit-limit-tokens-minute"),
  };

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
        const c = j.choices?.[0]?.delta?.content;
        if (c) {
          if (firstTokenAt === null) firstTokenAt = Date.now();
          textChunks.push(c);
          totalTokens++;
        }
      } catch {}
    }
  }

  const total = Date.now() - start;
  const ttft = firstTokenAt ? firstTokenAt - start : null;
  const genTime = firstTokenAt ? total - ttft : 0;
  const tps = genTime > 0 ? ((totalTokens / genTime) * 1000).toFixed(0) : "n/a";

  console.log(`  TTFT: ${ttft}ms | total: ${total}ms | tokens: ${totalTokens} | ${tps} tok/s`);
  console.log(`  Rate limits: ${JSON.stringify(rl)}`);
  console.log(`  Output: ${textChunks.join("").slice(0, 200)}…`);
}

const prompt =
  "Tengo 4 días para viajar en julio, presupuesto $1500 por persona, somos 2. Quiero playa caribeña y buen snorkel. Qué me recomiendas?";

await bench("qwen-3-235b-a22b-instruct-2507", prompt);
await bench("llama3.1-8b", prompt);
await bench("zai-glm-4.7", prompt);
