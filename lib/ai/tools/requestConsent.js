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
  inputSchema: z.object({
    reason: z
      .string()
      .describe("Razón del lead (ej: 'cotizar paquete Margarita', 'reservar vuelo CCS-CUN')"),
  }),
  execute: async ({ reason }, { experimental_context } = {}) => {
    const conversationId = experimental_context?.conversationId;
    if (!conversationId) return { ok: false, error: "Sin conversationId" };

    try {
      const sb = admin();
      const { data: conv } = await sb
        .from("chat_conversations")
        .select("consent_accepted, contact_captured")
        .eq("id", conversationId)
        .maybeSingle();

      if (!conv) return { ok: false, error: "Conversación no encontrada" };

      // Si ya aceptó previamente, no hace falta volver a pedir
      if (conv.consent_accepted) {
        return {
          ok: true,
          consentStatus: "already_accepted",
          message: "El usuario ya aceptó el consentimiento; puedes proceder con createLead.",
        };
      }

      // Validar que tenemos los 3 datos
      const c = conv.contact_captured || {};
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

      // Marcar metadata para que el frontend muestre el ConsentDialog
      await sb
        .from("chat_conversations")
        .update({
          metadata: {
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
