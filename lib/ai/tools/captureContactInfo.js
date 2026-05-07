/**
 * Tool: captura información de contacto del cliente PROGRESIVAMENTE.
 * Persiste en chat_visitors.contact_captured (NO en la conversación) — el
 * dato vive a nivel del visitor y está disponible en cualquier thread futuro.
 * NO crea el lead todavía — eso lo hace 'createLead' después del consent.
 */

import { tool } from "ai";
import { z } from "zod";
import { admin } from "./_admin.js";

export const captureContactInfoTool = tool({
  description: [
    "Guarda PARCIALMENTE datos de contacto del cliente (nombre / email / teléfono /",
    "interés). Persiste en chat_visitors.contact_captured (visitor-level, no",
    "conversation-level — el dato sobrevive a nuevas conversaciones).",
    "USE WHEN: el cliente te da CUALQUIERA de estos datos (aunque sea uno solo).",
    "  Ej: 'soy María' → captureContactInfo({name:'María'}). 'mi email es x@y.com' →",
    "  captureContactInfo({email:'x@y.com'}). Llama esta tool CADA VEZ que recibas",
    "  un dato nuevo, no esperes a tener todos.",
    "DO NOT USE: para crear el lead final → eso es createLead (con consent previo).",
    "  No la uses para guardar el destino/preferencia de viaje a menos que sea muy",
    "  específico (interestDetails admite eso pero opcional).",
    "PRECONDITIONS: ninguna. Es safe llamarla con un solo campo.",
    "EXAMPLE FLOW: usuario da nombre → captureContactInfo({name}); luego email →",
    "  captureContactInfo({email}); luego teléfono → captureContactInfo({phone}).",
    "RETURNS: { ok, captured: {name,email,phone}, missingFields: ['email','phone'],",
    "  readyForConsent: bool }. Cuando readyForConsent=true (los 3 campos están),",
    "  el siguiente paso es requestConsent (NO createLead directo).",
  ].join("\n"),
  inputSchema: z
    .object({
      name: z.string().optional().describe("Nombre completo del cliente"),
      email: z.string().email().optional().describe("Email válido"),
      phone: z.string().optional().describe("Teléfono (ej: +584141234567)"),
      interestType: z
        .string()
        .optional()
        .describe(
          "Tipo de interés detectado: 'flight' | 'hotel' | 'package' | 'transfer' | 'insurance' | 'other' (string libre, normalizado server-side)"
        ),
      interestDetails: z.string().optional().describe("Detalles libres del interés (destino, fechas, etc.)"),
    })
    .passthrough(),
  execute: async (input, { experimental_context } = {}) => {
    const conversationId = experimental_context?.conversationId;
    if (!conversationId) {
      return { ok: false, error: "Sin conversationId en contexto" };
    }

    try {
      const sb = admin();
      // Cargar conversación → visitor_id
      const { data: conv, error: getErr } = await sb
        .from("chat_conversations")
        .select("visitor_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (getErr) return { ok: false, error: getErr.message };
      if (!conv || !conv.visitor_id) {
        return { ok: false, error: "Visitor no encontrado para esta conversación" };
      }

      // Cargar contact_captured actual del visitor
      const { data: visitor } = await sb
        .from("chat_visitors")
        .select("contact_captured")
        .eq("id", conv.visitor_id)
        .maybeSingle();

      const captured = { ...(visitor?.contact_captured || {}) };
      if (input.name) captured.name = input.name;
      if (input.email) captured.email = input.email;
      if (input.phone) captured.phone = input.phone;
      if (input.interestType) {
        const VALID = ["flight", "hotel", "package", "transfer", "insurance", "other"];
        const raw = String(input.interestType).toLowerCase();
        const matched = VALID.find((v) => raw.includes(v)) || "other";
        captured.interestType = matched;
      }
      if (input.interestDetails) {
        captured.interestDetails = (captured.interestDetails || "") + " " + input.interestDetails;
        captured.interestDetails = captured.interestDetails.trim().slice(0, 1000);
      }

      const { error: updErr } = await sb
        .from("chat_visitors")
        .update({ contact_captured: captured })
        .eq("id", conv.visitor_id);
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
