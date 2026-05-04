/**
 * Prueba el agente con tools localmente (sin endpoint).
 * Detecta errores de streamText/tools antes de que lleguen al cliente.
 *
 * Uso: node scripts/test-agent-local.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const aiPath = (rel) => path.join(__dirname, "..", "lib", "ai", rel);
const toUrl = (p) => `file:///${p.replace(/\\/g, "/")}`;

const { runAgent } = await import(toUrl(aiPath("agent.js")));

console.log("🧪 Test agente local: 'hola'\n");

// Mensaje en formato UIMessage v6 (lo que envía useChat)
const messages = [
  {
    id: "msg-1",
    role: "user",
    parts: [{ type: "text", text: "hola" }],
  },
];

try {
  const { result, providerUsed, modelUsed } = await runAgent({
    messages,
    language: "es",
    conversationId: "test-conv-id-no-existe",
  });
  console.log("Provider:", providerUsed, "/", modelUsed);
  console.log("---STREAM---");
  for await (const part of result.fullStream) {
    console.log(part.type, JSON.stringify(part).slice(0, 200));
  }
  console.log("\n✅ Stream completo");
} catch (err) {
  console.error("\n❌ Error en runAgent:");
  console.error(err);
  console.error("\nStack:", err.stack);
}
