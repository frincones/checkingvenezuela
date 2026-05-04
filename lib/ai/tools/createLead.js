/**
 * Tool: crea el lead en la tabla `leads` con datos capturados.
 * REQUIERE consent_accepted=true en la conversación. Si no, falla.
 */

import { tool } from "ai";
import { z } from "zod";
import { admin } from "./_admin.js";
import { CONSENT_TEXT_VERSION } from "../prompts/consent.js";

export const createLeadTool = tool({
  description:
    "Crea formalmente el lead en el CRM con los datos capturados. " +
    "REQUIERE que el usuario haya aceptado el consentimiento (consent_accepted=true). " +
    "Llama esta tool SOLO después de 'requestConsent' y de que el usuario haya aceptado.",
  inputSchema: z.object({
    interestType: z
      .enum(["flight", "hotel", "package", "transfer", "insurance", "other"])
      .describe("Tipo de interés principal"),
    summary: z
      .string()
      .min(5)
      .describe(
        "Resumen del interés del lead (ej: 'Paquete a Margarita 5 días en julio para 2 adultos')"
      ),
    urgency: z.enum(["low", "medium", "high"]).optional().describe("Urgencia del lead"),
  }),
  execute: async ({ interestType, summary, urgency = "medium" }, { experimental_context } = {}) => {
    const conversationId = experimental_context?.conversationId;
    if (!conversationId) return { ok: false, error: "Sin conversationId" };

    try {
      const sb = admin();

      // Cargar conversación + verificar consent
      const { data: conv, error: convErr } = await sb
        .from("chat_conversations")
        .select("id, profile_id, contact_captured, consent_accepted, language, lead_id, metadata, landing_page, referrer_url")
        .eq("id", conversationId)
        .maybeSingle();
      if (convErr) return { ok: false, error: convErr.message };
      if (!conv) return { ok: false, error: "Conversación no encontrada" };

      if (!conv.consent_accepted) {
        return {
          ok: false,
          error: "Consentimiento no aceptado. Llama primero a 'requestConsent' y espera aceptación del usuario.",
        };
      }

      // Si ya tiene lead, devolver el existente
      if (conv.lead_id) {
        return {
          ok: true,
          leadId: conv.lead_id,
          alreadyExisted: true,
          message: "Ya existía un lead vinculado a esta conversación.",
        };
      }

      const c = conv.contact_captured || {};
      if (!c.name || !c.email || !c.phone) {
        return {
          ok: false,
          error: "Faltan datos de contacto (nombre, email o teléfono).",
        };
      }

      // Asignar advisor por round-robin (simple): el menos cargado
      const { data: advisors } = await sb
        .from("advisors")
        .select("id")
        .eq("is_active", true)
        .limit(1);
      const advisorId = advisors?.[0]?.id || null;

      // Insertar lead con consent
      const leadPayload = {
        source: "chatbot",
        status: "new",
        contact_name: c.name,
        contact_email: c.email,
        contact_phone: c.phone,
        contact_phone_dial_code: detectDialCode(c.phone),
        preferred_contact_method: "whatsapp",
        interest_type: interestType,
        interest_details: {
          summary,
          urgency,
          captured_via: "chatbot",
          language: conv.language || "es",
          ...(c.interestDetails ? { extra: c.interestDetails } : {}),
        },
        profile_id: conv.profile_id || null,
        chatbot_conversation_id: conversationId,
        consent_accepted_at: new Date().toISOString(),
        consent_text_version: CONSENT_TEXT_VERSION,
        advisor_id: advisorId,
        assigned_at: advisorId ? new Date().toISOString() : null,
        landing_page: conv.landing_page || null,
        referrer_url: conv.referrer_url || null,
      };

      const { data: lead, error: leadErr } = await sb
        .from("leads")
        .insert(leadPayload)
        .select("id, contact_name")
        .single();
      if (leadErr) return { ok: false, error: leadErr.message };

      // Vincular lead → conversation
      await sb
        .from("chat_conversations")
        .update({ lead_id: lead.id })
        .eq("id", conversationId);

      // Registrar interaction system de origen chatbot
      await sb.from("lead_interactions").insert({
        lead_id: lead.id,
        type: "system",
        content: `Lead creado por chatbot. Interés: ${summary}`,
        metadata: {
          source: "chatbot",
          conversation_id: conversationId,
          urgency,
        },
      });

      return {
        ok: true,
        leadId: lead.id,
        contactName: lead.contact_name,
        advisorAssigned: !!advisorId,
        message: `Lead creado. Un asesor contactará a ${lead.contact_name} pronto.`,
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
});

function detectDialCode(phone) {
  if (!phone) return "+58";
  const m = phone.replace(/\s/g, "").match(/^\+(\d{1,3})/);
  return m ? `+${m[1]}` : "+58";
}
