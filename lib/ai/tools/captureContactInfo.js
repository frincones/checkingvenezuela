/**
 * Tool: captura información de contacto del cliente PROGRESIVAMENTE.
 * NO crea el lead todavía — solo guarda en chat_conversations.contact_captured.
 *
 * El agente debe pedir nombre → email → teléfono uno a uno y llamar esta tool
 * cada vez que recibe un dato.
 */

import { tool } from "ai";
import { z } from "zod";
import { admin } from "./_admin.js";

export const captureContactInfoTool = tool({
  description:
    "Guarda parcialmente datos de contacto del cliente (nombre, email o teléfono) durante la conversación. " +
    "Llama esta tool CADA VEZ que el cliente te dé uno de estos datos. " +
    "NO crea el lead todavía — eso lo hace 'createLead' después del consentimiento.",
  inputSchema: z.object({
    name: z.string().optional().describe("Nombre completo del cliente"),
    email: z.string().email().optional().describe("Email válido"),
    phone: z.string().optional().describe("Teléfono (ej: +584141234567)"),
    interestType: z
      .enum(["flight", "hotel", "package", "transfer", "insurance", "other"])
      .optional()
      .describe("Tipo de interés detectado"),
    interestDetails: z.string().optional().describe("Detalles libres del interés (destino, fechas, etc.)"),
  }),
  execute: async (input, { experimental_context } = {}) => {
    const conversationId = experimental_context?.conversationId;
    if (!conversationId) {
      return { ok: false, error: "Sin conversationId en contexto" };
    }

    try {
      const sb = admin();
      const { data: conv, error: getErr } = await sb
        .from("chat_conversations")
        .select("contact_captured, metadata")
        .eq("id", conversationId)
        .maybeSingle();
      if (getErr) return { ok: false, error: getErr.message };
      if (!conv) return { ok: false, error: "Conversación no encontrada" };

      const captured = { ...(conv.contact_captured || {}) };
      if (input.name) captured.name = input.name;
      if (input.email) captured.email = input.email;
      if (input.phone) captured.phone = input.phone;
      if (input.interestType) captured.interestType = input.interestType;
      if (input.interestDetails) {
        captured.interestDetails = (captured.interestDetails || "") + " " + input.interestDetails;
        captured.interestDetails = captured.interestDetails.trim().slice(0, 1000);
      }

      const { error: updErr } = await sb
        .from("chat_conversations")
        .update({ contact_captured: captured })
        .eq("id", conversationId);
      if (updErr) return { ok: false, error: updErr.message };

      // Estado: qué falta
      const missing = [];
      if (!captured.name) missing.push("name");
      if (!captured.email) missing.push("email");
      if (!captured.phone) missing.push("phone");

      return {
        ok: true,
        captured: {
          name: captured.name || null,
          email: captured.email || null,
          phone: captured.phone || null,
        },
        missingFields: missing,
        readyForConsent: missing.length === 0,
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
});
