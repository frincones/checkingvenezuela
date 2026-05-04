/**
 * Diagnóstico de latencia: tiempo por etapa.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const T = Date.now();
const lap = (label) => console.log(`[+${(Date.now() - T).toString().padStart(5)}ms] ${label}`);

lap("dotenv loaded");

const aiPath = (rel) => path.join(__dirname, "..", "lib", "ai", rel);
const toUrl = (p) => `file:///${p.replace(/\\/g, "/")}`;

lap("before imports");
const { runAgent } = await import(toUrl(aiPath("agent.js")));
lap("agent imported");

const { streamText } = await import("ai");
const { createGroq } = await import("@ai-sdk/groq");
lap("ai sdk imported");

// === Test 1: streamText DIRECTO sin agente ===
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const model = groq("llama-3.1-8b-instant");
lap("model handle ready");

let t = Date.now();
const direct = streamText({
  model,
  messages: [{ role: "user", content: "di hola" }],
});
let chunks = 0;
for await (const part of direct.fullStream) {
  if (part.type === "text-delta") chunks++;
}
lap(`direct streamText (no tools, no system): ${Date.now() - t}ms, ${chunks} chunks`);

// === Test 2: streamText con system prompt grande ===
const { getSystemPrompt } = await import(toUrl(aiPath("prompts/system.js")));
const system = getSystemPrompt({ language: "es" });
console.log("  system prompt size:", system.length, "chars");
t = Date.now();
const withSystem = streamText({
  model,
  system,
  messages: [{ role: "user", content: "hola" }],
});
chunks = 0;
for await (const part of withSystem.fullStream) {
  if (part.type === "text-delta") chunks++;
}
lap(`streamText with system prompt: ${Date.now() - t}ms, ${chunks} chunks`);

// === Test 3: streamText con tools ===
const { getAgentTools } = await import(toUrl(aiPath("tools/index.js")));
const tools = getAgentTools();
lap("tools loaded");
t = Date.now();
const withTools = streamText({
  model,
  system,
  tools,
  messages: [{ role: "user", content: "hola" }],
});
chunks = 0;
for await (const part of withTools.fullStream) {
  if (part.type === "text-delta") chunks++;
}
lap(`streamText with system + tools (no requireTool): ${Date.now() - t}ms, ${chunks} chunks`);

// === Test 4: runAgent SIN intent (usa default min) ===
t = Date.now();
const r1 = await runAgent({
  messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "hola" }] }],
  language: "es",
  tier: "fast",
  intent: "chitchat",
});
chunks = 0;
for await (const part of r1.result.fullStream) {
  if (part.type === "text-delta") chunks++;
}
lap(`runAgent (intent=chitchat, 2 tools): ${Date.now() - t}ms, ${chunks} chunks`);

// === Test 5: runAgent intent=booking ===
t = Date.now();
const r2 = await runAgent({
  messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "quiero margarita" }] }],
  language: "es",
  tier: "fast",
  intent: "booking",
  requireTool: true,
});
chunks = 0;
let tools_called = 0;
for await (const part of r2.result.fullStream) {
  if (part.type === "text-delta") chunks++;
  if (part.type === "tool-call") tools_called++;
}
lap(`runAgent (intent=booking, 7 tools, requireTool): ${Date.now() - t}ms, ${chunks} chunks, ${tools_called} tools`);

console.log("\nDONE");
