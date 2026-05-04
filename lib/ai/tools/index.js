/**
 * Registry de tools disponibles para el agente.
 * Devuelve un objeto compatible con el parámetro `tools` de streamText.
 */

import { searchKbTool } from "./searchKb.js";
import { searchDestinationsTool } from "./searchDestinations.js";
import { searchPackagesTool } from "./searchPackages.js";
import { searchFlightsTool } from "./searchFlights.js";
import { searchHotelsTool } from "./searchHotels.js";
import { captureContactInfoTool } from "./captureContactInfo.js";
import { requestConsentTool } from "./requestConsent.js";
import { createLeadTool } from "./createLead.js";
import { talkToHumanTool } from "./talkToHuman.js";

const ALL_TOOLS = {
  searchKb: searchKbTool,
  searchDestinations: searchDestinationsTool,
  searchPackages: searchPackagesTool,
  searchFlights: searchFlightsTool,
  searchHotels: searchHotelsTool,
  captureContactInfo: captureContactInfoTool,
  requestConsent: requestConsentTool,
  createLead: createLeadTool,
  talkToHuman: talkToHumanTool,
};

/**
 * Filtra el set de tools por intent: pasar 8 tools al modelo aumenta
 * latencia ~25x (Llama 8B 919ms → 22s con todas las tools). Solo activamos
 * las relevantes para el intent actual. Default: subset chico.
 */
export function getAgentTools(intent) {
  switch (intent) {
    case "booking":
      return pick([
        "searchPackages",
        "searchHotels",
        "searchFlights",
        "captureContactInfo",
        "requestConsent",
        "createLead",
        "talkToHuman",
      ]);
    case "info":
      return pick([
        "searchKb",
        "searchDestinations",
        "searchPackages",
        "captureContactInfo",
      ]);
    case "policy":
      return pick(["searchKb", "captureContactInfo"]);
    case "complaint":
      return pick([
        "captureContactInfo",
        "requestConsent",
        "createLead",
        "talkToHuman",
      ]);
    case "human_handoff":
      return pick(["talkToHuman"]);
    case "chitchat":
    case "other":
    default:
      // Mínimo viable: que pueda escalar a humano si el cliente lo pide,
      // y empezar a buscar destinos si menciona uno
      return pick(["searchDestinations", "talkToHuman"]);
  }
}

function pick(names) {
  const out = {};
  for (const n of names) {
    if (ALL_TOOLS[n]) out[n] = ALL_TOOLS[n];
  }
  return out;
}

export const TOOL_NAMES = Object.keys(ALL_TOOLS);
