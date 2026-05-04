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

const VALID_INTENTS = [
  "chitchat",
  "info",
  "booking",
  "policy",
  "complaint",
  "human_handoff",
  "off_topic",
  "jailbreak",
  "other",
];

/**
 * Detector de jailbreak / prompt injection (heurística simple).
 */
export function isJailbreakAttempt(message) {
  if (!message) return false;
  const t = message.toLowerCase();
  return (
    /ignor[ae] (tus |las )?(instrucciones|reglas|prompt|system)/.test(t) ||
    /eres ahora (chatgpt|gpt|claude|gemini|openai|otro|otra)/.test(t) ||
    /you are now (chatgpt|gpt|claude|gemini|openai)/.test(t) ||
    /reveal (your )?(system )?prompt/.test(t) ||
    /muestrame (tu )?(system )?prompt/.test(t) ||
    /act as (a |an )?[a-z]+ (without|sin) restriction/.test(t) ||
    /jailbreak|dan mode|developer mode/.test(t)
  );
}

/**
 * Detector de off-topic (cosas claramente fuera del dominio de viajes).
 */
export function isOffTopic(message) {
  if (!message) return false;
  const t = message.toLowerCase();
  // Programación / código
  if (
    /\b(javascript|python|java\b|react|nextjs|html|css|sql|c\+\+|c#|typescript|node\.js|node js|nodejs|api rest|event loop|promise|async|await)\b/.test(
      t
    )
  )
    return true;
  // Matemáticas / fórmulas
  if (/\b(integral|derivada|ecuaci[oó]n|teorema|sumatoria|f[oó]rmula matem)/.test(t)) return true;
  // Recetas / cocina
  if (/\b(receta|cocinar|ingredient|hornear)/.test(t)) return true;
  // Salud / médico
  if (/\b(s[ií]ntoma|enfermedad|diagn[oó]stico|medicament|dolor de|fiebre|cancer|covid|vacuna)/.test(t))
    return true;
  // Asesoría legal/financiera no-viajes
  if (/\b(impuesto|inversiones?|criptomoneda|bitcoin|ethereum|forex|trading bursátil)\b/.test(t)) return true;
  // Tareas escolares
  if (/\b(tarea|deber|trabajo escolar|ayuda con mi tarea)/.test(t)) return true;
  return false;
}

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

  // Hablar con humano / asesor real → intent específico (forzamos tool talkToHuman)
  if (
    /\b(asesor|asesora|humano|humana|agente real|persona real|hablar con (?:una? )?(persona|humano|alguien)|talk to (?:a )?human|real person|whatsapp)/.test(
      t
    )
  ) {
    return "human_handoff";
  }

  // Policy: PRIMERO porque keywords como "cancel|reembols|devoluci|política"
  // son señales fuertes incluso cuando el mensaje también menciona reservas
  // (ej: "puedo cancelar mi reserva 5 días antes" → policy, no booking).
  if (/\b(pol[ií]tic|t[eé]rmin|condicion|cancel|reembols|refund|devoluci|garant[ií]|seguridad|seguro|safe)/.test(t)) {
    return "policy";
  }

  // Booking: palabras de intención comercial (prefix-friendly, sin \b al final).
  // 'paqu' captura "paquete/paquetes/paqutes" (typo común sin 'e').
  // 'reserv' captura "reservar/reservas/reservación".
  if (
    /\b(cotiz|reserv|compr|precio|paqu|vuelo|vuelos|hotel|hoteles|tour|escapada|disponibil|book|quote|buy|price)/.test(
      t
    )
  ) {
    return "booking";
  }

  // Booking implícito: mención de destino venezolano + verbo de intención.
  // Ej: "quiero ir a margarita", "voy a los roques", "me interesa canaima"
  const destinations =
    /\b(margarita|los roques|roques|canaima|m[eé]rida|morrocoy|caracas|maracaibo|valencia|isla|playa|caribe|venezuela|tepuy|salto[ -]?[aá]ngel)\b/;
  const intent_verbs =
    /\b(quiero|busco|voy(?:\sa)?|deseo|necesito|me\sinteresa|me\sgustar[ií]a|me\sllama\sla\satenci[oó]n|estoy\sviendo|planeo|i\swant|i'?m\slooking|interest)/;
  if (destinations.test(t) && intent_verbs.test(t)) {
    return "booking";
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

  // 0. Detección de jailbreak / off-topic ANTES de cualquier LLM
  if (isJailbreakAttempt(message)) return "jailbreak";
  if (isOffTopic(message)) return "off_topic";

  // 1. Fast path: keywords
  const fast = fastIntentByKeywords(message);
  if (fast) return fast;

  // 2. LLM fallback
  const promptTemplate = language === "en" ? INTENT_PROMPT_EN : INTENT_PROMPT_ES;
  const prompt = promptTemplate.replace("{MESSAGE}", message.slice(0, 500));

  try {
    const start = Date.now();
    const { text, usage } = await generateText({
      model: getChatModel({ tier: "fast" }),
      prompt,
      temperature: 0,
      maxOutputTokens: 10,
    });
    const latency = Date.now() - start;

    // Log de uso (no bloquea)
    logUsage({
      provider: "openrouter",
      operation: "intent_classify",
      model: "nvidia/nemotron-3-super-120b-a12b:free",
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
