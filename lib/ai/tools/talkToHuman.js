/**
 * Tool: ofrece al usuario un botón rápido para escribir a un asesor humano por WhatsApp.
 * Devuelve la URL de WhatsApp + el texto del CTA para que el widget renderice un botón.
 *
 * Llama esta tool cuando el cliente:
 *  - Pide explícitamente hablar con un humano / asesor / agente / persona real
 *  - Tiene una duda compleja que requiere expertise humana
 *  - Quiere cerrar la compra YA y prefiere atención directa
 *  - Después de capturar el lead, como atajo opcional al canal directo
 */

import { tool } from "ai";
import { z } from "zod";
import { admin } from "./_admin.js";

const WHATSAPP_NUMBER = "584264034052";

export const talkToHumanTool = tool({
  description: [
    "TERMINAL TOOL: genera un botón que abre WhatsApp con un asesor humano. Es la",
    "salida 'escape' del agente.",
    "USE WHEN: (a) el cliente pide explícitamente humano/asesor/persona real; (b) una",
    "  search* devolvió 0 resultados y necesitas ofrecer cotización manual;",
    "  (c) queja seria que necesita atención humana inmediata; (d) duda compleja",
    "  fuera del alcance del catálogo.",
    "DO NOT USE: como atajo cuando una search* puede resolver la consulta. NO la",
    "  uses para deflectar — primero intenta search*. Tampoco la uses tras un",
    "  createLead exitoso (el asesor ya va a llamar; ofrecer WA es redundante).",
    "PRECONDITIONS: ninguna, pero si hay nombre capturado se pre-rellena el msg.",
    "EXAMPLE: usuario dice 'quiero hablar con alguien' → talkToHuman({ reason:",
    "  'consulta general sobre viajes a Venezuela' }). Si la búsqueda devolvió 0",
    "  paquetes a destino X → talkToHuman({ reason: 'cotizar viaje a X (no había",
    "  paquete pre-armado)' }).",
    "RETURNS: { ok, action: 'open_whatsapp', url, label, prefilledMessage }. El",
    "  widget renderiza el botón debajo de tu respuesta. En el texto al cliente",
    "  menciona que aparece un botón abajo, pero NO pegues la URL ni el número.",
  ].join("\n"),
  inputSchema: z
    .object({
      reason: z
        .string()
        .min(3)
        .describe(
          "Motivo del contacto que se enviará pre-rellenado en WhatsApp (ej: 'Cotizar paquete Margarita 3D/2N')"
        ),
    })
    .passthrough(),
  execute: async ({ reason }, { experimental_context } = {}) => {
    const conversationId = experimental_context?.conversationId;
    let prefillName = "";

    // Si tenemos el nombre capturado, lo incluimos en el mensaje pre-rellenado
    if (conversationId) {
      try {
        const sb = admin();
        const { data: conv } = await sb
          .from("chat_conversations")
          .select("contact_captured")
          .eq("id", conversationId)
          .maybeSingle();
        const name = conv?.contact_captured?.name;
        if (name) prefillName = `Hola, soy ${name}. `;
      } catch {
        // best-effort
      }
    }

    const message = `${prefillName}${reason}`.trim();
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    return {
      ok: true,
      action: "open_whatsapp",
      url,
      label: "💬 Hablar con asesor por WhatsApp",
      labelEn: "💬 Talk to advisor on WhatsApp",
      phone: `+${WHATSAPP_NUMBER}`,
      prefilledMessage: message,
      message:
        "Generé un botón para que hables directamente con un asesor por WhatsApp. " +
        "Aparece debajo de este mensaje.",
    };
  },
});
