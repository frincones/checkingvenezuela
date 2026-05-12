#!/usr/bin/env node
/**
 * E2E smoke: simula 1 turno real del nuevo agente "free-routing".
 * Carga las 9 tools, FACTS block, y verifica que Gemini decide correctamente.
 */
import { generateText } from "ai";
import { getChatModel } from "../lib/ai/providers.js";
import { getAgentTools } from "../lib/ai/tools/index.js";
import { getSystemPrompt } from "../lib/ai/prompts/system.js";

const tools = getAgentTools();
const picked = getChatModel({ tier: "primary" });
console.log(`Provider: ${picked.label} (${picked.provider}/${picked.modelId})`);

const FACTS = `FACTS (estado verificable de la conversación):
  visitor.name: null
  visitor.email: null
  visitor.phone: null
  visitor.consent_accepted: false
  conversation.lead_created: false
  conversation.language: "es"`;

const cases = [
  "Hola, qué paquetes tienen para Los Roques?",
  "Sí me interesa el primero, mi nombre es María",
  "Mi email es maria@test.com",
];

for (const userMsg of cases) {
  console.log(`\n--- USER: ${userMsg} ---`);
  const start = Date.now();
  const r = await generateText({
    model: picked.handle,
    system: getSystemPrompt({ language: "es", contextHints: FACTS }),
    prompt: userMsg,
    tools,
    providerOptions: picked.provider === "google"
      ? { google: { thinkingConfig: { thinkingBudget: -1 } } }
      : {},
    stopWhen: ({ steps }) => steps.length >= 4,
  });
  console.log(`Elapsed: ${Date.now() - start}ms | steps: ${r.steps?.length || 0}`);
  console.log(`Tools called: ${r.toolCalls?.map(c => c.toolName).join(", ") || "(none)"}`);
  console.log(`Text: ${r.text?.slice(0, 250) || "(empty — straight to tool)"}`);
}
