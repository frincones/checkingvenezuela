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

const userText = process.argv[2] || "quiero cotizar un paquete para margarita que tienen?";
console.log(`🧪 Test agente local: "${userText}"\n`);

// Mensaje en formato UIMessage v6 (lo que envía useChat)
const messages = [
  {
    id: "msg-1",
    role: "user",
    parts: [{ type: "text", text: userText }],
  },
];

try {
  const tier = process.argv[3] || "fast"; // pass "smart" as 3rd arg for gpt-oss-120b
  const { result, providerUsed, modelUsed } = await runAgent({
    messages,
    language: "es",
    conversationId: "test-conv-id-no-existe",
    contextHints:
      "- Intent detectado: BOOKING. DEBES llamar searchPackages AHORA y luego pedir nombre del cliente.",
    tier,
  });
  console.log("Provider:", providerUsed, "/", modelUsed);
  console.log("---RESPUESTA---\n");
  let fullText = "";
  const toolCalls = [];
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      process.stdout.write(part.text);
      fullText += part.text;
    } else if (part.type === "tool-call") {
      toolCalls.push({ name: part.toolName, input: part.input });
      console.log(`\n[tool-call ${part.toolName}]`, JSON.stringify(part.input));
    } else if (part.type === "tool-result") {
      console.log(
        `[tool-result ${part.toolName}] count=${(part.output?.results || []).length}`,
        "ok=", part.output?.ok,
        "err=", part.output?.error || "-"
      );
    }
  }
  console.log("\n\n---STATS---");
  console.log("Caracteres:", fullText.length);
  console.log("Frases (~):", (fullText.match(/[.!?]+/g) || []).length);
  console.log("Tools llamadas:", toolCalls.map((t) => t.name).join(", ") || "ninguna");
  console.log("\n✅ Stream completo");
} catch (err) {
  console.error("\n❌ Error en runAgent:");
  console.error(err);
  console.error("\nStack:", err.stack);
}
