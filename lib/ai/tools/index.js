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

export function getAgentTools() {
  return {
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
}

export const TOOL_NAMES = [
  "searchKb",
  "searchDestinations",
  "searchPackages",
  "searchFlights",
  "searchHotels",
  "captureContactInfo",
  "requestConsent",
  "createLead",
  "talkToHuman",
];
