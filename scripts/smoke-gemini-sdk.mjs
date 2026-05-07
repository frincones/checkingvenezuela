#!/usr/bin/env node
/**
 * Smoke test: AI SDK 6 + @ai-sdk/google con thinkingConfig.
 * Verifica que la nueva integración en providers.js funciona end-to-end.
 */
import { generateText, tool } from "ai";
import { z } from "zod";
import { getChatModel } from "../lib/ai/providers.js";

const searchPackages = tool({
  description: "Busca paquetes turísticos. Úsala cuando el cliente pida cotización o ver paquetes.",
  inputSchema: z.object({
    destination: z.string(),
    maxPrice: z.number().optional(),
  }),
  execute: async ({ destination }) => ({ ok: true, results: [{ name: `Mock paquete a ${destination}`, price: 1200 }] }),
});

const picked = getChatModel({ tier: "primary" });
console.log(`Active model: ${picked.label} (${picked.provider}/${picked.modelId})`);

const start = Date.now();
const r = await generateText({
  model: picked.handle,
  system: "Eres Vale, asistente de Venezuela Voyages. Tono casual.",
  prompt: "Hola, qué tienen para Los Roques?",
  tools: { searchPackages },
  providerOptions: picked.provider === "google"
    ? { google: { thinkingConfig: { thinkingBudget: -1 } } }
    : {},
  stopWhen: ({ steps }) => steps.length >= 3,
});
const elapsed = Date.now() - start;

console.log(`\nElapsed: ${elapsed}ms`);
console.log(`Steps: ${r.steps?.length || 0}`);
console.log(`Tool calls: ${r.toolCalls?.map((c) => c.toolName).join(", ") || "(none)"}`);
console.log(`Text: ${r.text?.slice(0, 200) || "(empty)"}`);
console.log(`Tokens: ${JSON.stringify(r.usage)}`);
