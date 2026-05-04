/**
 * Reproduce un flujo multi-turn como el usuario:
 * 1. quiero cotizar margarita → agente muestra opciones + pide nombre
 * 2. freddy → agente debe llamar captureContactInfo y pedir email
 * 3. freddy@test.com → captureContactInfo y pedir teléfono
 * 4. +584141234567 → captureContactInfo + requestConsent
 *
 * Uso: node scripts/test-multi-turn.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const aiPath = (rel) => path.join(__dirname, "..", "lib", "ai", rel);
const toUrl = (p) => `file:///${p.replace(/\\/g, "/")}`;
const { runAgent } = await import(toUrl(aiPath("agent.js")));
const { classifyIntent } = await import(toUrl(aiPath("prompts/intent.js")));

// Setup: crear una conversación dummy en DB
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const sessionId = `test-${Date.now()}`;
const { data: conv } = await sb
  .from("chat_conversations")
  .insert({ session_id: sessionId, language: "es", status: "active" })
  .select("id")
  .single();
const conversationId = conv.id;
console.log("Conversación creada:", conversationId);

const userTurns = [
  "quiero cotizar margarita",
  "freddy",
  "freddy@test.com",
  "+584141234567",
];

let allMessages = [];
let assistantId = 0;

for (const userText of userTurns) {
  console.log("\n========================================");
  console.log("👤 USUARIO:", userText);
  console.log("========================================");

  const userMsg = {
    id: `u-${allMessages.length}`,
    role: "user",
    parts: [{ type: "text", text: userText }],
  };
  allMessages.push(userMsg);

  // Intent
  const intent = await classifyIntent({
    message: userText,
    language: "es",
    conversationId,
  });
  console.log(`[intent] ${intent}`);

  // Pull current conversation state for context hints
  const { data: c } = await sb
    .from("chat_conversations")
    .select("contact_captured, consent_accepted, lead_id")
    .eq("id", conversationId)
    .single();
  const captured = c?.contact_captured || {};
  const hintsLines = [];
  if (captured.name) hintsLines.push(`- Nombre del cliente: ${captured.name}`);
  if (captured.email) hintsLines.push(`- Email: ${captured.email}`);
  if (captured.phone) hintsLines.push(`- Teléfono: ${captured.phone}`);
  if (c?.consent_accepted) hintsLines.push("- Consentimiento: ACEPTADO");
  if (c?.lead_id) hintsLines.push(`- Lead creado (ID: ${c.lead_id})`);
  if (intent === "booking") {
    hintsLines.push(
      "- Intent detectado: BOOKING. Llama searchPackages AHORA si el cliente no te ha dado destino + opciones, sino sigue avanzando la captura."
    );
  }
  if (!c?.lead_id) {
    const missing = [];
    if (!captured.name) missing.push("nombre");
    if (!captured.email) missing.push("email");
    if (!captured.phone) missing.push("teléfono");
    if (missing.length > 0 && (captured.name || captured.email || captured.phone)) {
      hintsLines.push(
        `- AVANZA LA CAPTURA: ya tienes ${Object.keys(captured).filter((k) => captured[k]).join(", ")}. Pide ahora: ${missing[0]}.`
      );
    }
    if (missing.length === 0 && !c?.consent_accepted) {
      hintsLines.push("- TIENES LOS 3 DATOS. Llama AHORA 'requestConsent'.");
    }
  }
  const contextHints = hintsLines.join("\n");
  console.log("[hints]", contextHints || "(ninguno)");

  const tier =
    intent === "booking" || intent === "policy" || intent === "complaint"
      ? "smart"
      : "fast";
  console.log("[tier]", tier);

  let result, providerUsed, modelUsed;
  try {
    ({ result, providerUsed, modelUsed } = await runAgent({
      messages: allMessages,
      language: "es",
      conversationId,
      contextHints,
      tier,
    }));
    console.log(`[model] ${providerUsed}/${modelUsed}`);
  } catch (err) {
    console.error("❌ runAgent error:", err.message);
    console.error("   stack:", err.stack?.split("\n").slice(0, 5).join("\n"));
    break;
  }

  let assistantText = "";
  const assistantParts = [];
  try {
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        assistantText += part.text;
      } else if (part.type === "tool-call") {
        console.log(`[tool-call] ${part.toolName} args=`, JSON.stringify(part.input));
        assistantParts.push({
          type: `tool-${part.toolName}`,
          toolCallId: part.toolCallId,
          state: "input-available",
          input: part.input,
        });
      } else if (part.type === "tool-result") {
        console.log(
          `[tool-result] ${part.toolName} ok=${part.output?.ok} count=${(part.output?.results || []).length} err=${part.output?.error || "-"}`
        );
        const idx = assistantParts.findIndex(
          (p) => p.toolCallId === part.toolCallId
        );
        if (idx >= 0) {
          assistantParts[idx] = { ...assistantParts[idx], state: "output-available", output: part.output };
        }
      } else if (part.type === "error") {
        console.error("[stream-error]", part.error);
      }
    }
  } catch (err) {
    console.error("❌ stream error:", err.message);
    break;
  }

  if (assistantText) assistantParts.push({ type: "text", text: assistantText });
  console.log("\n🤖 VALE:", assistantText || "(sin texto)");

  allMessages.push({
    id: `a-${assistantId++}`,
    role: "assistant",
    parts: assistantParts,
  });
}

// Cleanup
await sb.from("chat_messages").delete().eq("conversation_id", conversationId);
await sb.from("chat_conversations").delete().eq("id", conversationId);
console.log("\n🧹 Conversación de prueba eliminada");
