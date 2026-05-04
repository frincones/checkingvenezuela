/**
 * Clasificador de intent ligero (1 llamada al modelo fast).
 * Decide si vale la pena gastar tokens en RAG / tools, o responder directo.
 *
 * Categorías:
 *  - chitchat: saludos, agradecimientos, despedidas → responde directo
 *  - info: pregunta sobre destinos, atracciones, clima → searchKb + searchDestinations
 *  - booking: intención de comprar/reservar → searchPackages + lead capture
 *  - policy: pregunta sobre políticas, T&C, devoluciones → searchKb (filter políticas)
 *  - complaint: queja, reclamo → escala + captura lead urgente
 *  - other: ambiguo → procede con tools
 */

import { generateText } from "ai";
import { getChatModel } from "../providers.js";
import { logUsage } from "../usage.js";

const VALID_INTENTS = ["chitchat", "info", "booking", "policy", "complaint", "other"];

const INTENT_PROMPT_ES = `Clasifica el siguiente mensaje del usuario de una agencia de viajes en UNA categoría. Responde SOLO con la palabra de la categoría, nada más.

Categorías:
- chitchat: saludos ("hola"), agradecimientos, charla casual sin pregunta concreta.
- info: pregunta sobre destinos, clima, atracciones, recomendaciones de viaje.
- booking: usuario quiere cotizar, reservar, comprar, ver paquetes/vuelos/hoteles.
- policy: pregunta sobre términos, condiciones, políticas, devoluciones, cancelaciones.
- complaint: queja, problema con servicio, reclamo, frustración.
- other: cualquier otra cosa.

Mensaje del usuario: "{MESSAGE}"

Categoría:`;

const INTENT_PROMPT_EN = `Classify the following user message from a travel agency into ONE category. Respond ONLY with the category word, nothing else.

Categories:
- chitchat: greetings ("hi"), thanks, casual chat with no specific question.
- info: question about destinations, weather, attractions, travel recommendations.
- booking: user wants to quote, book, buy, see packages/flights/hotels.
- policy: question about terms, conditions, policies, refunds, cancellations.
- complaint: complaint, service issue, frustration.
- other: anything else.

User message: "{MESSAGE}"

Category:`;

/**
 * Clasifica intent. Si falla, devuelve 'other' (no rompe el flujo).
 */
export async function classifyIntent({ message, language = "es", conversationId } = {}) {
  if (!message) return "other";
  const promptTemplate = language === "en" ? INTENT_PROMPT_EN : INTENT_PROMPT_ES;
  const prompt = promptTemplate.replace("{MESSAGE}", message.slice(0, 500));

  try {
    const start = Date.now();
    const { text, usage } = await generateText({
      model: getChatModel({ tier: "fast", provider: "groq" }),
      prompt,
      temperature: 0,
      maxOutputTokens: 10,
    });
    const latency = Date.now() - start;

    // Log de uso (no bloquea)
    logUsage({
      provider: "groq",
      operation: "intent_classify",
      model: "llama-3.1-8b-instant",
      tokens: (usage?.totalTokens || usage?.total_tokens || 0),
      conversationId,
      metadata: { latency_ms: latency },
    });

    const cleaned = text.trim().toLowerCase().split(/[\s\n.,!?]/)[0];
    if (VALID_INTENTS.includes(cleaned)) return cleaned;
    return "other";
  } catch (err) {
    console.warn("[intent] classify error:", err.message);
    return "other";
  }
}
