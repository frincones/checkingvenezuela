/**
 * Registry de tools disponibles para el agente.
 * Devuelve un objeto compatible con el parámetro `tools` de streamText.
 *
 * DISEÑO (post 2026-05-06):
 *
 * Siempre cargamos las 9 tools — el modelo decide cuál llamar leyendo las
 * tool descriptions (que ya encodean USE WHEN / DO NOT USE / preconditions).
 *
 * Antes filtrábamos por intent (booking-search, booking-capture, etc.) lo
 * que causaba errores "tool createLead not in request.tools" cuando el
 * intent classifier se equivocaba o el modelo razonaba diferente. El costo
 * extra de cargar 9 vs 4 tools es ~200 tokens en el prompt — aceptable a
 * cambio de eliminar toda esa categoría de bugs.
 *
 * `getAgentTools(intent, opts)` mantiene su firma para compat con call-sites
 * existentes pero ignora ambos argumentos.
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
 * Devuelve TODAS las tools. Los argumentos se ignoran (compat).
 *
 * @param {string} [_intent] - ignorado (deprecado)
 * @param {object} [_opts]   - ignorado (deprecado)
 * @returns {object} las 9 tools
 */
export function getAgentTools(_intent, _opts) {
  return { ...ALL_TOOLS };
}

export const TOOL_NAMES = Object.keys(ALL_TOOLS);
