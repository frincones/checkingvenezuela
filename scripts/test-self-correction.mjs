#!/usr/bin/env node
/**
 * Test de self-correction: el modelo debe recuperarse cuando una tool
 * retorna 0 resultados o un error.
 *
 * Antes (MAX_STEPS=2 + toolChoice none@1+) era IMPOSIBLE: el modelo no
 * podía intentar otra tool ni reformular. Ahora con MAX_STEPS=6 sí.
 */
import { tool, generateText } from "ai";
import { getChatModel, markRateLimited, MODELS } from "../lib/ai/providers.js";
import { getSystemPrompt } from "../lib/ai/prompts/system.js";

// Forzar fallback a Nemotron (Gemini rate-limited del test previo)
markRateLimited(MODELS.primary.id);

import { searchKbTool } from "../lib/ai/tools/searchKb.js";
import { searchDestinationsTool } from "../lib/ai/tools/searchDestinations.js";
import { searchPackagesTool } from "../lib/ai/tools/searchPackages.js";
import { searchFlightsTool } from "../lib/ai/tools/searchFlights.js";
import { searchHotelsTool } from "../lib/ai/tools/searchHotels.js";
import { captureContactInfoTool } from "../lib/ai/tools/captureContactInfo.js";
import { requestConsentTool } from "../lib/ai/tools/requestConsent.js";
import { createLeadTool } from "../lib/ai/tools/createLead.js";
import { talkToHumanTool } from "../lib/ai/tools/talkToHuman.js";

// Mock que devuelve respuesta configurable por escenario
function makeMock(name, original, fakeResult) {
  return tool({
    description: original.description,
    inputSchema: original.inputSchema,
    execute: async (args) => {
      console.log(`    [tool:${name}] called with: ${JSON.stringify(args).slice(0, 80)}`);
      const r = typeof fakeResult === "function" ? fakeResult(args) : fakeResult;
      console.log(`    [tool:${name}] returning: ${JSON.stringify(r).slice(0, 100)}`);
      return r;
    },
  });
}

const SCENARIOS = [
  {
    id: 1,
    label: "searchPackages devuelve 0 resultados",
    user: "Quiero un paquete a Punta Arenas Antártida con presupuesto 500 USD",
    fakes: {
      // Primera llamada: 0 resultados (destino no existe)
      searchPackages: { ok: true, count: 0, results: [] },
    },
    expectations: {
      // El modelo debe (a) reconocer que no hay paquetes y (b) ofrecer alternativa
      // (búsqueda más amplia, otra tool como searchDestinations, o talkToHuman)
      text_must_contain_one_of: [
        "no encontr", "no tenemos", "no hay", "no encontre", "lo sentimos",
        "asesor", "humano", "whatsapp", "talk", "alternativ",
      ],
      // Citar el destino que pidió el usuario está bien; lo malo sería inventar
      // PRECIOS o paquetes inexistentes. Verificamos que NO haya placeholders.
      text_must_not_contain: ["$XXX", "$0", "desde $???"],
    },
  },
  {
    id: 2,
    label: "searchKb timeout estructurado",
    user: "Cuál es la política de cancelación si llueve el día del viaje?",
    fakes: {
      searchKb: {
        ok: false,
        error: "timeout",
        errorDetail: "searchKb excedió 12000ms. Reintenta con otros parámetros o sugiere al cliente cotización manual via talkToHuman.",
        retryable: true,
      },
    },
    expectations: {
      // El modelo debe ofrecer talkToHuman o ser honesto sobre no poder consultar
      text_must_contain_one_of: ["asesor", "humano", "whatsapp", "talk", "no pudimos", "no logre", "intenta", "lluvia"],
      text_must_not_contain: [],
    },
  },
];

const fullToolset = (overrides = {}) => ({
  searchKb: makeMock("searchKb", searchKbTool, overrides.searchKb || { ok: true, count: 0, results: [] }),
  searchDestinations: makeMock("searchDestinations", searchDestinationsTool, overrides.searchDestinations || { ok: true, count: 0, results: [] }),
  searchPackages: makeMock("searchPackages", searchPackagesTool, overrides.searchPackages || { ok: true, count: 0, results: [] }),
  searchFlights: makeMock("searchFlights", searchFlightsTool, overrides.searchFlights || { ok: true, count: 0, results: [] }),
  searchHotels: makeMock("searchHotels", searchHotelsTool, overrides.searchHotels || { ok: true, count: 0, results: [] }),
  captureContactInfo: makeMock("captureContactInfo", captureContactInfoTool, { ok: true, captured: {}, missingFields: ["name","email","phone"], readyForConsent: false }),
  requestConsent: makeMock("requestConsent", requestConsentTool, { ok: false, error: "Faltan datos" }),
  createLead: makeMock("createLead", createLeadTool, { ok: false, error: "Consent no aceptado" }),
  talkToHuman: makeMock("talkToHuman", talkToHumanTool, { ok: true, action: "open_whatsapp", url: "https://wa.me/X" }),
});

const FACTS = `FACTS (estado verificable de la conversación):
  visitor.name: null
  visitor.email: null
  visitor.phone: null
  visitor.consent_accepted: false
  conversation.lead_created: false
  conversation.language: "es"`;

const picked = getChatModel({ tier: "primary" });
console.log(`=== Self-correction test — ${picked.label} (${picked.provider}) ===\n`);

let pass = 0;
let fail = 0;
const fails = [];

for (const sc of SCENARIOS) {
  console.log(`\n[${sc.id}] ${sc.label}`);
  console.log(`    user: "${sc.user}"`);

  const tools = fullToolset(sc.fakes);
  const start = Date.now();
  let result;
  try {
    result = await generateText({
      model: picked.handle,
      system: getSystemPrompt({ language: "es", contextHints: FACTS }),
      prompt: sc.user,
      tools,
      providerOptions: picked.provider === "google" ? { google: { thinkingConfig: { thinkingBudget: -1 } } } : {},
      stopWhen: ({ steps }) => steps.length >= 6,
      temperature: 0.4,
    });
  } catch (e) {
    console.log(`    ❌ EXCEPTION: ${e.message.slice(0, 200)}`);
    fail++;
    fails.push({ id: sc.id, reason: "exception" });
    continue;
  }
  const elapsed = Date.now() - start;
  const text = (result.text || "").toLowerCase();
  const allCalls = (result.steps || []).flatMap((s) => s.toolCalls || []);
  const calledTools = [...new Set(allCalls.map((c) => c.toolName))];

  console.log(`    elapsed: ${elapsed}ms | steps: ${result.steps?.length || 0}`);
  console.log(`    tools_called: ${calledTools.join(", ") || "(none)"}`);
  console.log(`    text: ${result.text?.slice(0, 200)?.replace(/\n/g, " ") || "(empty)"}`);

  let scenarioPass = true;
  const reasons = [];

  // Must contain at least ONE of the keywords
  if (sc.expectations.text_must_contain_one_of.length) {
    const hit = sc.expectations.text_must_contain_one_of.some((kw) => text.includes(kw.toLowerCase()));
    if (!hit) {
      scenarioPass = false;
      reasons.push(`text didn't contain any of [${sc.expectations.text_must_contain_one_of.join(", ")}]`);
    }
  }

  // Must NOT contain any of these
  for (const phrase of sc.expectations.text_must_not_contain) {
    if (text.includes(phrase.toLowerCase())) {
      scenarioPass = false;
      reasons.push(`leaked: "${phrase}"`);
    }
  }

  // Self-correction implícito: que haya CALLED al menos una tool
  if (calledTools.length === 0) {
    scenarioPass = false;
    reasons.push("no tool called");
  }

  if (scenarioPass) {
    console.log(`    ✅ PASS`);
    pass++;
  } else {
    console.log(`    ❌ FAIL: ${reasons.join("; ")}`);
    fail++;
    fails.push({ id: sc.id, reason: reasons.join("; ") });
  }

  // Pacing entre tests para no saturar Gemini RPM
  await new Promise((r) => setTimeout(r, 8000));
}

console.log(`\n\n=========================================`);
console.log(`SUMMARY: ${pass}/${SCENARIOS.length} passed | ${fail} failed`);
if (fails.length) fails.forEach((f) => console.log(`  [${f.id}] ${f.reason}`));
console.log(`=========================================`);
process.exit(fail > 0 ? 1 : 0);
