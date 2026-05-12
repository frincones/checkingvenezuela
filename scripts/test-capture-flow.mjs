#!/usr/bin/env node
/**
 * Test multi-turno del flujo completo: search → name → email → phone →
 * consent → createLead. Cada turno mantiene history y actualiza FACTS.
 *
 * Validación: el agente NO debe pedir datos que ya tiene (verificable
 * porque vamos actualizando los FACTS turno a turno).
 */
import { tool, generateText } from "ai";
import { getChatModel, markRateLimited, MODELS } from "../lib/ai/providers.js";
import { getSystemPrompt } from "../lib/ai/prompts/system.js";

import { searchKbTool } from "../lib/ai/tools/searchKb.js";
import { searchDestinationsTool } from "../lib/ai/tools/searchDestinations.js";
import { searchPackagesTool } from "../lib/ai/tools/searchPackages.js";
import { searchFlightsTool } from "../lib/ai/tools/searchFlights.js";
import { searchHotelsTool } from "../lib/ai/tools/searchHotels.js";
import { captureContactInfoTool } from "../lib/ai/tools/captureContactInfo.js";
import { requestConsentTool } from "../lib/ai/tools/requestConsent.js";
import { createLeadTool } from "../lib/ai/tools/createLead.js";
import { talkToHumanTool } from "../lib/ai/tools/talkToHuman.js";

// Forzar Nemotron (Gemini rate-limited)
markRateLimited(MODELS.primary.id);

// Estado de la conversación (mutable, se actualiza tras cada turno)
const visitor = {
  name: null,
  email: null,
  phone: null,
  consent_accepted: false,
};
let lead_created = false;

const buildFacts = () => `FACTS (estado verificable de la conversación):
  visitor.name: ${visitor.name ? JSON.stringify(visitor.name) : "null"}
  visitor.email: ${visitor.email ? JSON.stringify(visitor.email) : "null"}
  visitor.phone: ${visitor.phone ? JSON.stringify(visitor.phone) : "null"}
  visitor.consent_accepted: ${visitor.consent_accepted}
  conversation.lead_created: ${lead_created}
  conversation.language: "es"`;

// Tool mocks que reflejan el state real
function mockTool(name, original) {
  return tool({
    description: original.description,
    inputSchema: original.inputSchema,
    execute: async (args) => {
      console.log(`     [tool:${name}] ${JSON.stringify(args).slice(0, 120)}`);
      switch (name) {
        case "searchPackages":
          return { ok: true, count: 2, results: [
            { name: "Los Roques 3D/2N", price: 1250, currency: "USD", destination: "Los Roques", summary: "Vuelo+posada" },
            { name: "Margarita All Inc", price: 950, currency: "USD", destination: "Margarita", summary: "Hotel 4*" },
          ]};
        case "captureContactInfo":
          if (args.name) visitor.name = args.name;
          if (args.email) visitor.email = args.email;
          if (args.phone) visitor.phone = args.phone;
          const missing = [];
          if (!visitor.name) missing.push("name");
          if (!visitor.email) missing.push("email");
          if (!visitor.phone) missing.push("phone");
          return {
            ok: true,
            captured: { name: visitor.name, email: visitor.email, phone: visitor.phone },
            missingFields: missing,
            readyForConsent: missing.length === 0,
          };
        case "requestConsent":
          if (!visitor.name || !visitor.email || !visitor.phone) {
            return { ok: false, error: "Faltan datos", missingFields: ["..."] };
          }
          // Simular que el usuario acepta
          visitor.consent_accepted = true;
          return { ok: true, consentStatus: "requested", action: "show_consent_dialog" };
        case "createLead":
          if (!visitor.consent_accepted) return { ok: false, error: "Sin consent" };
          if (lead_created) return { ok: true, alreadyExisted: true };
          lead_created = true;
          return { ok: true, contactName: visitor.name, advisorAssigned: true };
        case "talkToHuman":
          return { ok: true, action: "open_whatsapp", url: "https://wa.me/X" };
        default:
          return { ok: true, count: 0, results: [] };
      }
    },
  });
}

const toolset = {
  searchKb: mockTool("searchKb", searchKbTool),
  searchDestinations: mockTool("searchDestinations", searchDestinationsTool),
  searchPackages: mockTool("searchPackages", searchPackagesTool),
  searchFlights: mockTool("searchFlights", searchFlightsTool),
  searchHotels: mockTool("searchHotels", searchHotelsTool),
  captureContactInfo: mockTool("captureContactInfo", captureContactInfoTool),
  requestConsent: mockTool("requestConsent", requestConsentTool),
  createLead: mockTool("createLead", createLeadTool),
  talkToHuman: mockTool("talkToHuman", talkToHumanTool),
};

const TURNS = [
  { user: "Hola, quiero un paquete para Los Roques con mi pareja", expect: { tools_any: ["searchPackages"] } },
  { user: "Me interesa el primero, soy Carlos Pérez", expect: { tools_any: ["captureContactInfo"], facts_after: { name: "Carlos Pérez" } } },
  { user: "Mi correo es carlos@test.com", expect: { tools_any: ["captureContactInfo"], facts_after: { email: "carlos@test.com" } } },
  { user: "Y mi teléfono es +584141234567", expect: { tools_any: ["captureContactInfo", "requestConsent"], facts_after: { phone: "+584141234567" } } },
  // En este turno, el FACTS ya tendrá los 3 datos + consent_accepted: true
  // (porque requestConsent en el turno previo lo activó). El modelo debería
  // llamar createLead.
  { user: "Sí, acepto el consentimiento", expect: { tools_any: ["createLead"] } },
];

const picked = getChatModel({ tier: "primary" });
console.log(`=== Capture flow test — ${picked.label} (${picked.provider}) ===\n`);

let pass = 0;
let fail = 0;
const fails = [];
const history = []; // ModelMessage[]

for (let i = 0; i < TURNS.length; i++) {
  const turn = TURNS[i];
  console.log(`\n--- Turno ${i + 1}/${TURNS.length} ---`);
  console.log(`  user: "${turn.user}"`);
  console.log(`  FACTS pre-turn: name=${visitor.name || "null"}, email=${visitor.email || "null"}, phone=${visitor.phone || "null"}, consent=${visitor.consent_accepted}, lead=${lead_created}`);

  history.push({ role: "user", content: turn.user });

  let result;
  try {
    result = await generateText({
      model: picked.handle,
      system: getSystemPrompt({ language: "es", contextHints: buildFacts() }),
      messages: history,
      tools: toolset,
      providerOptions: picked.provider === "google" ? { google: { thinkingConfig: { thinkingBudget: -1 } } } : {},
      stopWhen: ({ steps }) => steps.length >= 6,
      temperature: 0.4,
    });
  } catch (e) {
    console.log(`  ❌ EXCEPTION: ${e.message.slice(0, 200)}`);
    fail++;
    fails.push({ turn: i + 1, reason: "exception" });
    break;
  }

  const allCalls = (result.steps || []).flatMap((s) => s.toolCalls || []);
  const calledTools = [...new Set(allCalls.map((c) => c.toolName))];

  // Acumular respuesta + tool messages al history. AI SDK 6 retorna response.messages
  // que YA incluye el último user + tool calls + tool results + assistant text
  const newAssistant = result.response?.messages || [];
  for (const m of newAssistant) {
    if (m.role !== "user") history.push(m);
  }

  console.log(`  tools: ${calledTools.join(", ") || "(none)"}`);
  console.log(`  text: ${result.text?.slice(0, 220)?.replace(/\n/g, " ") || "(empty)"}`);
  console.log(`  steps: ${result.steps?.length || 0} | elapsed: ${Date.now() - Date.now()}ms`);

  // Verificar
  let turnPass = true;
  const reasons = [];

  if (turn.expect.tools_any) {
    const hit = turn.expect.tools_any.some((t) => calledTools.includes(t));
    if (!hit) {
      turnPass = false;
      reasons.push(`expected tool any of [${turn.expect.tools_any.join(",")}], got [${calledTools.join(",")}]`);
    }
  }

  if (turn.expect.facts_after) {
    for (const [k, v] of Object.entries(turn.expect.facts_after)) {
      if (visitor[k] !== v) {
        turnPass = false;
        reasons.push(`expected visitor.${k}="${v}", got "${visitor[k]}"`);
      }
    }
  }

  if (turnPass) {
    console.log(`  ✅ PASS`);
    pass++;
  } else {
    console.log(`  ❌ FAIL: ${reasons.join("; ")}`);
    fail++;
    fails.push({ turn: i + 1, reason: reasons.join("; ") });
  }

  // Pacing
  await new Promise((r) => setTimeout(r, 5000));
}

console.log(`\n\n=========================================`);
console.log(`SUMMARY: ${pass}/${TURNS.length} turns passed | ${fail} failed`);
console.log(`Final state: name=${visitor.name}, email=${visitor.email}, phone=${visitor.phone}, consent=${visitor.consent_accepted}, lead_created=${lead_created}`);
if (fails.length) fails.forEach((f) => console.log(`  Turn ${f.turn}: ${f.reason}`));
console.log(`=========================================`);
process.exit(fail > 0 ? 1 : 0);
