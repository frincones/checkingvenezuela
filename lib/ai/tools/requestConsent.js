/**
 * Tool: marca que el agente NECESITA el consentimiento del usuario.
 * El frontend detecta este tool-call y muestra el ConsentDialog.
 *
 * Devuelve estado actual de consent — el agente debe esperar a que el usuario
 * acepte (lo cual el cliente reflejará en la próxima llamada al endpoint).
 */

import { tool } from "ai";
import { z } from "zod";
import { admin } from "./_admin.js";

export const requestConsentTool = tool({
  description:
    "Solicita al usuario el consentimiento de tratamiento de datos. " +
    "Llama esta tool DESPUÉS de tener nombre, email y teléfono completos, " +
    "y ANTES de llamar a 'createLead'. El sistema mostrará un dialog al usuario.",
  inputSchema: z
    .object({
      reason: z
        .string()
        .describe("Razón del lead (ej: 'cotizar paquete Margarita', 'reservar vuelo CCS-CUN')"),
    })
    .passthrough(),
  execute: async ({ reason }, { experimental_context } = {}) => {
    const conversationId = experimental_context?.conversationId;
    if (!conversationId) return { ok: false, error: "Sin conversationId" };

    try {
      const sb = admin();
      const { data: conv } = await sb
        .from("chat_conversations")
        .select("visitor_id, metadata")
        .eq("id", conversationId)
        .maybeSingle();
      if (!conv || !conv.visitor_id) {
        return { ok: false, error: "Conversación / visitor no encontrado" };
      }

      // Cargar visitor — el consent y los datos viven a nivel visitor
      const { data: visitor } = await sb
        .from("chat_visitors")
        .select("consent_accepted, contact_captured")
        .eq("id", conv.visitor_id)
        .maybeSingle();
      if (!visitor) return { ok: false, error: "Visitor no encontrado" };

      if (visitor.consent_accepted) {
        return {
          ok: true,
          consentStatus: "already_accepted",
          message:
            "El usuario ya aceptó el consentimiento previamente. Procede directamente con createLead.",
        };
      }

      // Validar que tenemos los 3 datos
      const c = visitor.contact_captured || {};
      const missing = [];
      if (!c.name) missing.push("name");
      if (!c.email) missing.push("email");
      if (!c.phone) missing.push("phone");
      if (missing.length > 0) {
        return {
          ok: false,
          error: `Faltan datos antes de pedir consentimiento: ${missing.join(", ")}`,
          missingFields: missing,
        };
      }

      // Marcar metadata en la conversación para que el frontend muestre el dialog
      await sb
        .from("chat_conversations")
        .update({
          metadata: {
            ...(conv.metadata || {}),
            consent_requested_at: new Date().toISOString(),
            consent_reason: reason,
          },
        })
        .eq("id", conversationId);

      return {
        ok: true,
        consentStatus: "requested",
        action: "show_consent_dialog",
        reason,
        message:
          "Solicitud de consentimiento enviada al usuario. Espera su decisión antes de continuar.",
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
});
