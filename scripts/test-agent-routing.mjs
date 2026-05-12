#!/usr/bin/env node
/**
 * Test de routing: ¿llama la tool correcta para cada tipo de mensaje?
 *
 * Mockea las tools (no toca Supabase) y verifica que el modelo:
 *  - llama searchPackages para "quiero ir a X"
 *  - llama searchKb para "política de cancelación"
 *  - llama searchDestinations para "qué destinos hay"
 *  - NO inventa precios (rule #5)
 *  - genera texto puro para chitchat
 *
 * El test pasa si la tool llamada en cada escenario coincide con la esperada,
 * o si es razonable llamar una tool relacionada (ej: searchKb en vez de
 * searchDestinations).
 */
import { tool, generateText } from "ai";
import { z } from "zod";
import { getChatModel } from "../lib/ai/providers.js";
import { getSystemPrompt } from "../lib/ai/prompts/system.js";

// Re-export las descriptions REALES (no mockeadas) — el routing depende de ellas
import { searchKbTool } from "../lib/ai/tools/searchKb.js";
import { searchDestinationsTool } from "../lib/ai/tools/searchDestinations.js";
import { searchPackagesTool } from "../lib/ai/tools/searchPackages.js";
import { searchFlightsTool } from "../lib/ai/tools/searchFlights.js";
import { searchHotelsTool } from "../lib/ai/tools/searchHotels.js";
import { captureContactInfoTool } from "../lib/ai/tools/captureContactInfo.js";
import { requestConsentTool } from "../lib/ai/tools/requestConsent.js";
import { createLeadTool } from "../lib/ai/tools/createLead.js";
import { talkToHumanTool } from "../lib/ai/tools/talkToHuman.js";

// Mock execute para cada tool — devuelve resultado verosímil sin tocar DB
const mockResults = {
  searchPackages: { ok: true, count: 2, results: [
    { name: "Los Roques 3D/2N", price: 1250, currency: "USD", destination: "Los Roques", summary: "Vuelo + posada" },
    { name: "Margarita All Inc", price: 950, currency: "USD", destination: "Margarita", summary: "Hotel 4*" },
  ]},
  searchHotels: { ok: true, count: 1, results: [
    { name: "Posada El Caracol", location: "Los Roques", category: "boutique", amenities: ["wifi","desayuno"] },
  ]},
  searchFlights: { ok: true, count: 1, results: [
    { name: "Vuelo CCS-PMV", origin: "Caracas", destination: "Margarita", price: 180, currency: "USD" },
  ]},
  searchDestinations: { ok: true, count: 3, results: [
    { name: "Los Roques", location: "Caribe Venezolano", summary: "Archipiélago de 350 islas", highlights: ["snorkel","playa"] },
    { name: "Canaima", location: "Bolívar", summary: "Salto Ángel", highlights: ["tepuyes","río"] },
    { name: "Mérida", location: "Andes", summary: "Teleférico, montaña", highlights: ["aventura","frío"] },
  ]},
  searchKb: { ok: true, count: 2, results: [
    { title: "Política de cancelación", snippet: "Cancelación gratis hasta 7 días antes. Después aplica 30% penalidad.", source: "T&C", url: "/policies" },
  ]},
  captureContactInfo: { ok: true, captured: { name: null, email: null, phone: null }, missingFields: ["name","email","phone"], readyForConsent: false },
  requestConsent: { ok: false, error: "Faltan datos antes de pedir consentimiento", missingFields: ["name","email","phone"] },
  createLead: { ok: false, error: "Consentimiento no aceptado." },
  talkToHuman: { ok: true, action: "open_whatsapp", url: "https://wa.me/X", label: "Hablar con asesor" },
};

// Re-empaquetar las tools del codebase con execute mockeado
function mockTool(name, originalTool) {
  return tool({
    description: originalTool.description,
    inputSchema: originalTool.inputSchema,
    execute: async (args) => {
      console.log(`    [tool:${name}] called with:`, JSON.stringify(args).slice(0, 100));
      return mockResults[name] || { ok: true };
    },
  });
}

const tools = {
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

const SCENARIOS = [
  {
    id: 1,
    label: "Booking explícito con destino + presupuesto",
    user: "Quiero ir a Los Roques con mi pareja, presupuesto 2000 USD para 3 días",
    facts: { name: null, email: null, phone: null, consent: false, lead: false },
    expected_tools: ["searchPackages"],
    forbidden_phrases: ["$XXX", "desde $???", "$0", "no tengo acceso al catálogo"],
  },
  {
    id: 2,
    label: "Catálogo abierto",
    user: "Hola, qué destinos tienen?",
    facts: { name: null, email: null, phone: null, consent: false, lead: false },
    expected_tools: ["searchDestinations", "searchPackages"],
    forbidden_phrases: ["$XXX"],
  },
  {
    id: 3,
    label: "Política de cancelación",
    user: "Si reservo y luego cancelo 5 días antes, me devuelven el dinero?",
    facts: { name: null, email: null, phone: null, consent: false, lead: false },
    expected_tools: ["searchKb"],
    forbidden_phrases: ["no tengo esa información"],
  },
  {
    id: 4,
    label: "Hotel suelto",
    user: "Necesito un hotel boutique en Los Roques, sin paquete",
    facts: { name: null, email: null, phone: null, consent: false, lead: false },
    expected_tools: ["searchHotels", "searchPackages"],
    forbidden_phrases: [],
  },
  {
    id: 5,
    label: "Vuelo suelto",
    user: "Cuánto cuesta un vuelo Caracas-Margarita?",
    facts: { name: null, email: null, phone: null, consent: false, lead: false },
    expected_tools: ["searchFlights", "searchPackages"],
    forbidden_phrases: [],
  },
  {
    id: 6,
    label: "Captura: usuario da nombre tras ver paquetes",
    user: "Me interesa el primero, soy Carlos",
    facts: { name: null, email: null, phone: null, consent: false, lead: false, last_search: "2 paquetes mostrados" },
    expected_tools: ["captureContactInfo"],
    forbidden_phrases: [],
  },
  {
    id: 7,
    label: "Chitchat puro",
    user: "Gracias, déjame pensarlo",
    facts: { name: null, email: null, phone: null, consent: false, lead: false },
    expected_tools: [],  // No tool needed — pure text
    forbidden_phrases: [],
  },
  {
    id: 8,
    label: "Listo para consent (3 datos completos)",
    user: "Mi teléfono es +584141234567",
    facts: { name: "Carlos", email: "carlos@x.com", phone: null, consent: false, lead: false },
    expected_tools: ["captureContactInfo", "requestConsent"],
    forbidden_phrases: [],
  },
];

const picked = getChatModel({ tier: "primary" });
console.log(`\n=== Test routing — ${picked.label} (${picked.provider}/${picked.modelId}) ===\n`);

const buildFacts = (f) => `FACTS (estado verificable de la conversación):
  visitor.name: ${f.name ? JSON.stringify(f.name) : "null"}
  visitor.email: ${f.email ? JSON.stringify(f.email) : "null"}
  visitor.phone: ${f.phone ? JSON.stringify(f.phone) : "null"}
  visitor.consent_accepted: ${!!f.consent}
  conversation.lead_created: ${!!f.lead}
  conversation.language: "es"${f.last_search ? `
  conversation.last_assistant_action: "${f.last_search}"` : ""}`;

let pass = 0;
let fail = 0;
const fails = [];

for (const sc of SCENARIOS) {
  console.log(`\n[${sc.id}] ${sc.label}`);
  console.log(`    user: "${sc.user}"`);
  const start = Date.now();
  let result;
  try {
    result = await generateText({
      model: picked.handle,
      system: getSystemPrompt({ language: "es", contextHints: buildFacts(sc.facts) }),
      prompt: sc.user,
      tools,
      providerOptions: picked.provider === "google"
        ? { google: { thinkingConfig: { thinkingBudget: -1 } } }
        : {},
      stopWhen: ({ steps }) => steps.length >= 4,
      temperature: 0.4,
    });
  } catch (e) {
    console.log(`    ❌ EXCEPTION: ${e.message}`);
    fail++;
    fails.push({ id: sc.id, reason: "exception: " + e.message });
    continue;
  }
  const elapsed = Date.now() - start;

  // Extraer todas las tools llamadas a través de los steps
  const allCalls = (result.steps || []).flatMap((s) => s.toolCalls || []);
  const calledTools = [...new Set(allCalls.map((c) => c.toolName))];
  const text = result.text || "";

  console.log(`    elapsed: ${elapsed}ms | steps: ${result.steps?.length || 0}`);
  console.log(`    tools_called: ${calledTools.length ? calledTools.join(", ") : "(none — pure text)"}`);
  console.log(`    text: ${text.slice(0, 180).replace(/\n/g, " ")}${text.length > 180 ? "…" : ""}`);

  // Validar
  let scenarioPass = true;
  const reasons = [];

  // Check 1: tool routing
  if (sc.expected_tools.length === 0) {
    if (calledTools.length > 0) {
      scenarioPass = false;
      reasons.push(`expected pure text, but called: ${calledTools.join(",")}`);
    }
  } else {
    const hit = calledTools.some((t) => sc.expected_tools.includes(t));
    if (!hit) {
      scenarioPass = false;
      reasons.push(`expected one of [${sc.expected_tools.join(",")}], got [${calledTools.join(",")||"none"}]`);
    }
  }

  // Check 2: forbidden phrases
  for (const phrase of sc.forbidden_phrases) {
    if (text.includes(phrase)) {
      scenarioPass = false;
      reasons.push(`leaked forbidden phrase: "${phrase}"`);
    }
  }

  if (scenarioPass) {
    console.log(`    ✅ PASS`);
    pass++;
  } else {
    console.log(`    ❌ FAIL: ${reasons.join("; ")}`);
    fail++;
    fails.push({ id: sc.id, reason: reasons.join("; ") });
  }

  // Pacing para evitar 429 de Gemini (10 RPM)
  await new Promise((r) => setTimeout(r, 7000));
}

console.log(`\n\n=========================================`);
console.log(`SUMMARY: ${pass}/${SCENARIOS.length} passed | ${fail} failed`);
if (fails.length) {
  console.log(`\nFails:`);
  fails.forEach((f) => console.log(`  [${f.id}] ${f.reason}`));
}
console.log(`=========================================`);
process.exit(fail > 0 ? 1 : 0);
