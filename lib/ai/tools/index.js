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
 * Filtra el set de tools por intent + estado de captura.
 * Cada tool definida añade latencia al modelo (más tools = más tiempo
 * procesando definiciones). Mantenemos el set lo más chico posible:
 *
 * - Para booking en fase de SEARCH (aún sin datos del cliente): solo las
 *   tools de búsqueda (searchPackages/Hotels/Flights) + talkToHuman.
 * - Para booking en fase de CAPTURE (ya tenemos algún dato): solo las
 *   tools de captura (captureContactInfo/requestConsent/createLead).
 *
 * @param {string} intent
 * @param {object} [opts]
 * @param {boolean} [opts.inCapture] - true si ya hay nombre/email/teléfono
 */
export function getAgentTools(intent, opts = {}) {
  const inCapture = !!opts.inCapture;

  switch (intent) {
    case "booking":
      if (inCapture) {
        return pick([
          "captureContactInfo",
          "requestConsent",
          "createLead",
          "talkToHuman",
        ]);
      }
      return pick([
        "searchPackages",
        "searchHotels",
        "searchFlights",
        "talkToHuman",
      ]);
    case "info":
      return pick([
        "searchKb",
        "searchDestinations",
        "searchPackages",
      ]);
    case "policy":
      return pick(["searchKb"]);
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
      // Mínimo: escalar a humano si el cliente lo pide, o buscar destino
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
