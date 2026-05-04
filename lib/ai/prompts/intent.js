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

/**
 * Pre-clasificación rápida por keywords (sin LLM call).
 * Devuelve null si no hay match claro → cae al clasificador LLM.
 */
function fastIntentByKeywords(message) {
  if (!message) return null;
  const t = message.toLowerCase().trim();

  // Chitchat ultra-corto
  if (/^(hola|hi|hello|hey|buenos? d[ií]as|buenas|gracias|thanks|adi[oó]s|chao|bye|ok|okay|listo|perfecto|s[íi]\b|no\b)[\s!.?¡¿]*$/.test(t)) {
    return "chitchat";
  }

  // Booking: palabras de intención comercial (prefix-friendly, sin \b al final)
  if (/\b(cotiz|reserv|compr|precio|paquet|vuelo|vuelos|hotel|hoteles|tour|escapada|disponibil|book|quote|buy|price)/.test(t)) {
    return "booking";
  }

  // Policy: políticas, T&C, reembolsos
  if (/\b(pol[ií]tic|t[eé]rmin|condicion|cancel|reembols|refund|devoluci|garant[ií]|seguridad)/.test(t)) {
    return "policy";
  }

  // Complaint
  if (/\b(queja|reclam|problema|terrible|p[eé]simo|no funciona|complaint|broken|wrong)/.test(t) || /\bmal\b/.test(t)) {
    return "complaint";
  }

  return null;
}

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
 * Clasifica intent. Primero intenta match por keywords (instantáneo, sin LLM).
 * Solo cae al LLM si no hay match claro. Si todo falla, devuelve 'other'.
 */
export async function classifyIntent({ message, language = "es", conversationId } = {}) {
  if (!message) return "other";

  // 1. Fast path: keywords
  const fast = fastIntentByKeywords(message);
  if (fast) return fast;

  // 2. LLM fallback
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
