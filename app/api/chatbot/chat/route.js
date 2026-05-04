/**
 * POST /api/chatbot/chat
 * Body: { messages: UIMessage[], language?: 'es'|'en' }
 *
 * Streamea la respuesta del agente. Persiste mensajes en chat_messages.
 */

// Vercel function config: el plan Hobby corta a los 10s por default. La
// chain agente + tool + stream puede demorar 5-15s; sin esta línea el
// cliente ve "..." infinito porque Vercel termina la function antes de
// que el stream emita su primer chunk. 60s es el máximo permitido en Hobby.
export const maxDuration = 60;

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/server";
import { runAgent } from "@/lib/ai/agent";
import { detectLanguage } from "@/lib/ai/utils";
import { classifyIntent } from "@/lib/ai/prompts/intent";
import { createUIMessageStreamResponse, createUIMessageStream } from "ai";

// Respuestas canónicas para intents de seguridad — sin pasar por LLM
const CANNED = {
  off_topic: {
    es: "Solo te puedo ayudar con temas de viajes y Venezuela Voyages 🌴. ¿Quieres que te muestre destinos o paquetes?",
    en: "I can only help with travel topics and Venezuela Voyages 🌴. Want me to show you destinations or packages?",
  },
  jailbreak: {
    es: "Soy Vale, asistente de Venezuela Voyages, y solo puedo ayudarte con temas de viajes 🌴. ¿En qué viaje te ayudo?",
    en: "I'm Vale, Venezuela Voyages assistant, and I only help with travel topics 🌴. What trip can I help you with?",
  },
};

/**
 * Persiste un milestone de timing al log_persistente para diagnóstico server-side
 * cuando los logs de Vercel runtime no son accesibles. Best-effort.
 */
function persistMilestone(sb, conversationId, label, ms, extra = {}) {
  try {
    sb.from("kb_usage_log")
      .insert({
        provider: "trace",
        operation: "chat_milestone",
        model: label,
        tokens: ms,
        conversation_id: conversationId || null,
        metadata: extra,
      })
      .then(() => {})
      .catch(() => {});
  } catch {}
}

function streamCannedResponse(text) {
  // Devuelve un UIMessageStreamResponse con un único text-delta
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const id = "txt-canned";
      writer.write({ type: "start" });
      writer.write({ type: "start-step" });
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: text });
      writer.write({ type: "text-end", id });
      writer.write({ type: "finish-step" });
      writer.write({ type: "finish" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

const COOKIE_NAME = "vv_chat_session";

// Rate limiting in-memory (suficiente para MVP — reemplazar con Redis al escalar)
const rateLimits = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQ = 30;

function checkRateLimit(sessionId) {
  const now = Date.now();
  const entry = rateLimits.get(sessionId) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count++;
  rateLimits.set(sessionId, entry);
  return entry.count <= RATE_MAX_REQ;
}

export async function POST(request) {
  const t0 = Date.now();
  const _trace = []; // milestones para diagnóstico
  let _convIdForTrace = null;
  let _sbForTrace = null;
  const tlog = (label, extra) => {
    const ms = Date.now() - t0;
    console.log(`[chat ${ms.toString().padStart(5)}ms] ${label}`);
    _trace.push({ ms, label, ...(extra || {}) });
    if (_sbForTrace && _convIdForTrace) {
      persistMilestone(_sbForTrace, _convIdForTrace, label, ms, extra || {});
    }
  };
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(COOKIE_NAME)?.value;
    if (!sessionId) {
      return NextResponse.json(
        { error: "Sin sesión activa. Llama primero a /api/chatbot/session" },
        { status: 400 }
      );
    }

    if (!checkRateLimit(sessionId)) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const messages = body.messages || [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages requerido" }, { status: 400 });
    }

    tlog("body parsed");
    const sb = createAdminClient();
    _sbForTrace = sb;
    const { data: conv, error: convErr } = await sb
      .from("chat_conversations")
      .select("id, language, status, contact_captured, consent_accepted, lead_id")
      .eq("session_id", sessionId)
      .maybeSingle();
    _convIdForTrace = conv?.id || null;
    tlog(`conv loaded id=${conv?.id?.slice(0, 8)}`);
    if (convErr) throw convErr;
    if (!conv) {
      return NextResponse.json(
        { error: "Conversación no encontrada. Llama a /api/chatbot/session primero." },
        { status: 404 }
      );
    }
    if (conv.status === "closed") {
      return NextResponse.json({ error: "Conversación cerrada" }, { status: 400 });
    }

    // Idioma: SIEMPRE re-detectar del último mensaje del usuario.
    // Solo si el body lo manda explícito o el mensaje es muy corto, usamos el persistido.
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const lastUserText = extractText(lastUser);
    let language;
    if (body.language) {
      language = body.language;
    } else if (lastUserText && lastUserText.trim().length >= 4) {
      language = detectLanguage(lastUserText);
    } else {
      language = conv.language || "es";
    }
    if (!language) language = "es";

    // Persistir si cambió respecto a la conv (telemetría / siguiente turno)
    if (conv.language !== language) {
      await sb.from("chat_conversations").update({ language }).eq("id", conv.id);
    }

    // Pre-captura server-side defensiva: si el último mensaje contiene un
    // email o teléfono claro, lo persistimos en contact_captured ANTES de
    // pasar al modelo. Así el dato no se pierde si el LLM no llama la tool.
    if (lastUserText && !conv.lead_id) {
      const emailMatch = lastUserText.match(
        /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
      );
      const phoneMatch = lastUserText.match(/\+?\d[\d\s\-().]{7,}\d/);
      const captured = { ...(conv.contact_captured || {}) };
      let dirty = false;
      if (emailMatch && !captured.email) {
        captured.email = emailMatch[0].toLowerCase();
        dirty = true;
      }
      if (phoneMatch && !captured.phone) {
        // Limpiar a solo dígitos + plus inicial
        const cleaned = phoneMatch[0].replace(/[^\d+]/g, "");
        if (cleaned.length >= 8) {
          captured.phone = cleaned;
          dirty = true;
        }
      }
      if (dirty) {
        await sb
          .from("chat_conversations")
          .update({ contact_captured: captured })
          .eq("id", conv.id);
        // Refrescar conv para los hints siguientes
        conv.contact_captured = captured;
      }
    }

    // Persistir el último mensaje del usuario (si no fue persistido aún)
    let intent = null;
    if (lastUser && lastUserText) {
      intent = await classifyIntent({
        message: lastUserText,
        language,
        conversationId: conv.id,
      });

      // Herencia de intent — caso 1: el cliente ya está en captura (tiene
      // algún dato guardado y el lead no se ha creado) → booking forzado.
      const cap = conv.contact_captured || {};
      const inflightCapture =
        !conv.lead_id && (cap.name || cap.email || cap.phone);
      if (inflightCapture && (intent === "other" || intent === "chitchat")) {
        intent = "booking";
      }

      // Herencia de intent — caso 2: respuesta ambigua tras un turno donde
      // el agente usó una tool de búsqueda de productos. Mantenemos booking
      // hasta que el usuario cambie claramente de tema (ej: pide ayuda, queja).
      if (intent === "other" || intent === "chitchat") {
        const { data: prev } = await sb
          .from("chat_messages")
          .select("intent, tool_calls, created_at")
          .eq("conversation_id", conv.id)
          .eq("role", "assistant")
          .order("created_at", { ascending: false })
          .limit(2);
        const recent = Array.isArray(prev) ? prev : [];
        const recentlyUsedSearch = recent.some((m) => {
          const tools = Array.isArray(m.tool_calls) ? m.tool_calls : [];
          return tools.some((t) =>
            [
              "searchPackages",
              "searchHotels",
              "searchFlights",
              "searchDestinations",
            ].includes(t.toolName || t.name)
          );
        });
        if (recentlyUsedSearch || recent[0]?.intent === "booking") {
          intent = "booking";
        } else if (recent[0]?.intent === "policy") {
          intent = "policy";
        } else if (recent[0]?.intent === "human_handoff") {
          intent = "human_handoff";
        }
      }

      await sb.from("chat_messages").insert({
        conversation_id: conv.id,
        role: "user",
        content: lastUserText,
        intent,
      });
      tlog(`intent=${intent} lang=${language}`);
    }

    // Interceptor: jailbreak / off-topic → respuesta canned sin pasar por LLM.
    // Más rápido (cero latencia LLM) y 100% confiable.
    if (intent === "jailbreak" || intent === "off_topic") {
      const reply = (CANNED[intent] && CANNED[intent][language]) || CANNED[intent].es;
      try {
        await sb.from("chat_messages").insert({
          conversation_id: conv.id,
          role: "assistant",
          content: reply,
          intent,
          provider: "canned",
          model: "rule",
        });
      } catch (e) {
        console.warn("[chat] persist canned error:", e.message);
      }
      return streamCannedResponse(reply);
    }

    // Hints para el system prompt
    const captured = conv.contact_captured || {};
    const hintsLines = [];
    if (captured.name) hintsLines.push(`- Nombre del cliente: ${captured.name}`);
    if (captured.email) hintsLines.push(`- Email: ${captured.email}`);
    if (captured.phone) hintsLines.push(`- Teléfono: ${captured.phone}`);
    if (conv.consent_accepted) hintsLines.push("- Consentimiento de datos: ACEPTADO");
    if (conv.lead_id) hintsLines.push(`- Lead ya creado (ID: ${conv.lead_id})`);

    // Inyectar instrucciones específicas por intent (refuerza tool use + lead push)
    if (intent === "booking") {
      hintsLines.push(
        "- Intent detectado: BOOKING. DEBES llamar searchPackages/searchHotels/searchFlights AHORA y luego empujar al cliente a darte sus datos para conectarlo con un asesor."
      );
    } else if (intent === "policy") {
      hintsLines.push(
        "- Intent detectado: POLICY. DEBES llamar searchKb AHORA con la pregunta del usuario y citar la fuente."
      );
    } else if (intent === "info") {
      hintsLines.push(
        "- Intent detectado: INFO. Llama searchKb o searchDestinations según corresponda. Tras responder, pivota: '¿Te gustaría que te muestre paquetes para X?'"
      );
    } else if (intent === "complaint") {
      hintsLines.push(
        "- Intent detectado: COMPLAINT. Empatiza brevemente, captura nombre/email/teléfono y crea lead con urgencia ALTA."
      );
    } else if (intent === "human_handoff") {
      hintsLines.push(
        "- Intent detectado: HUMAN_HANDOFF. El sistema YA va a llamar talkToHuman automáticamente. Tu única tarea: responder breve (1 frase) tipo 'Te conecto con un asesor. Toca el botón abajo.' NO escribas el link ni describas el botón en exceso."
      );
    }

    // Captura progresiva — orden ESTRICTO: nombre → email → teléfono → consent
    if (!conv.lead_id) {
      const ORDER = [
        ["name", "nombre"],
        ["email", "email"],
        ["phone", "teléfono"],
      ];
      const nextMissing = ORDER.find(([k]) => !captured[k]);
      const haveSome = ORDER.some(([k]) => captured[k]);

      if (nextMissing && haveSome) {
        const have = ORDER.filter(([k]) => captured[k])
          .map(([, label]) => label)
          .join(", ");
        hintsLines.push(
          `- CAPTURA EN CURSO: ya tienes [${have}]. Próximo dato a pedir: **${nextMissing[1]}**. NO pidas otra cosa, NO saltes pasos, NO repitas opciones de paquetes.`
        );
      }
      if (!nextMissing && !conv.consent_accepted) {
        hintsLines.push(
          "- TIENES LOS 3 DATOS COMPLETOS (nombre + email + teléfono). Llama AHORA 'requestConsent' con un reason corto. NO pidas más datos."
        );
      }
    }

    const contextHints = hintsLines.length ? hintsLines.join("\n") : "";

    // Modelo: por default usamos el FAST tier (llama-3.1-8b-instant: 14,400 req/día).
    // El SMART tier (gpt-oss-120b) tiene cuota muchísimo más chica (200K tok/día)
    // así que lo reservamos SOLO para human_handoff donde forceTool requiere
    // reliability extra. Si Llama 8B se rate-limita, la cadena de fallback baja
    // a Cerebras / Gemini cuando se configuren.
    const useSmartTier = intent === "human_handoff";
    const tier = useSmartTier ? "smart" : "fast";

    // Forzar la tool talkToHuman cuando el cliente pide explícitamente un humano
    const forceTool = intent === "human_handoff" ? "talkToHuman" : undefined;

    // Para booking / policy / complaint: forzar que el primer step llame ALGUNA
    // tool antes de generar texto. Evita el patrón "preamble + tool + respuesta"
    // que produce el feo efecto de "responde a medias y se queda pensando".
    // Solo aplicamos si el cliente NO está aún en captura de datos (esos turnos
    // son texto puro: el modelo solo agradece y pide el siguiente dato).
    const inCapture =
      captured.name || captured.email || captured.phone;
    const requireTool =
      !inCapture &&
      !forceTool &&
      (intent === "booking" || intent === "policy" || intent === "complaint");

    // Ejecutar agente con fallback chain. Si toda la cadena se rate-limita,
    // devolvemos un mensaje amigable + botón de WhatsApp en lugar de stack trace.
    tlog(`tier=${tier} forceTool=${forceTool || "-"} requireTool=${requireTool} intent=${intent} inCapture=${!!inCapture}`);
    let result, providerUsed, modelUsed;
    try {
      // Watchdog: si runAgent no devuelve en 20s (cuelgue por upstream lento,
      // cold start de Vercel + Jina, etc.), abortamos para no dejar al
      // usuario con "..." infinito.
      const runPromise = runAgent({
        messages,
        language,
        conversationId: conv.id,
        contextHints,
        tier,
        forceTool,
        requireTool,
        intent,
        inCapture: !!inCapture,
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("agent_timeout: runAgent did not return in 20s")),
          20000
        )
      );
      ({ result, providerUsed, modelUsed } = await Promise.race([
        runPromise,
        timeoutPromise,
      ]));
      tlog(`runAgent ready (${providerUsed}/${modelUsed})`);
    } catch (err) {
      const msg = String(err?.message || err || "");
      const isRateLimit = /rate.?limit|too.?many|quota|tokens per/i.test(msg);
      const isTimeout = /agent_timeout|timeout/i.test(msg);
      tlog("runAgent error", {
        rate_limit: isRateLimit,
        timeout: isTimeout,
        msg: msg.slice(0, 300),
      });
      if (isRateLimit || isTimeout) {
        const fallbackText =
          language === "en"
            ? "We're experiencing high demand right now. While we recover, please contact a Venezuela Voyages advisor directly on WhatsApp 🌴: https://wa.me/584264034052"
            : "Estamos con alta demanda en este momento. Mientras nos recuperamos, contacta directamente a un asesor de Venezuela Voyages por WhatsApp 🌴: https://wa.me/584264034052";
        try {
          await sb.from("chat_messages").insert({
            conversation_id: conv.id,
            role: "assistant",
            content: fallbackText,
            intent,
            provider: "fallback",
            model: "rate-limited",
            error: msg.slice(0, 300),
          });
        } catch (e) {
          console.warn("[chat] persist fallback error:", e.message);
        }
        return streamCannedResponse(fallbackText);
      }
      throw err;
    }

    // Hook onFinish (después de stream): persistir respuesta del assistant
    // Lo hacemos vía consumeStream pattern: pasamos un callback en options
    tlog("returning stream response");
    return result.toUIMessageStreamResponse({
      onFinish: async ({ messages: finalMessages }) => {
        tlog("stream onFinish triggered");
        // El último mensaje de finalMessages es el del assistant generado
        try {
          const assistantMsg = [...finalMessages].reverse().find((m) => m.role === "assistant");
          if (!assistantMsg) return;
          const text = extractText(assistantMsg);
          const toolCalls = (assistantMsg.parts || [])
            .filter((p) => p.type?.startsWith("tool-"))
            .map((p) => ({
              toolName: p.type.replace(/^tool-/, ""),
              input: p.input,
              output: p.output,
              state: p.state,
            }));
          const sources = toolCalls
            .filter((t) => t.toolName === "searchKb" && t.output?.results)
            .flatMap((t) =>
              t.output.results.map((r) => ({
                title: r.documentTitle,
                source: r.source,
                score: r.score,
              }))
            );

          await sb.from("chat_messages").insert({
            conversation_id: conv.id,
            role: "assistant",
            content: text || "",
            tool_calls: toolCalls,
            sources,
            intent,
            model: modelUsed,
            provider: providerUsed,
          });
        } catch (e) {
          console.warn("[chatbot/chat] persist assistant error:", e.message);
        }
      },
    });
  } catch (err) {
    console.error("[chatbot/chat POST]", err);
    return NextResponse.json(
      { error: err.message || "Error procesando mensaje" },
      { status: 500 }
    );
  }
}

/**
 * Extrae el texto plano de un UIMessage (que tiene parts: [{type:'text', text:'...'}])
 * o de un mensaje legacy con .content string.
 */
function extractText(msg) {
  if (!msg) return "";
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text || "")
      .join("");
  }
  return "";
}
