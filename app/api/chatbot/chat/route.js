/**
 * POST /api/chatbot/chat
 * Body: { messages: UIMessage[], language?: 'es'|'en' }
 *
 * Streamea la respuesta del agente. Persiste mensajes en chat_messages.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/server";
import { runAgent } from "@/lib/ai/agent";
import { detectLanguage } from "@/lib/ai/utils";
import { classifyIntent } from "@/lib/ai/prompts/intent";

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

    const sb = createAdminClient();
    const { data: conv, error: convErr } = await sb
      .from("chat_conversations")
      .select("id, language, status, contact_captured, consent_accepted, lead_id")
      .eq("session_id", sessionId)
      .maybeSingle();
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

    // Determinar idioma (preferencia: body > conversación > detección del último msg user)
    let language = body.language || conv.language;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const lastUserText = extractText(lastUser);
    if (!language && lastUserText) language = detectLanguage(lastUserText);
    if (!language) language = "es";

    // Si la conversación tiene otro idioma persistido, actualizar si cambió
    if (conv.language !== language) {
      await sb.from("chat_conversations").update({ language }).eq("id", conv.id);
    }

    // Persistir el último mensaje del usuario (si no fue persistido aún)
    let intent = null;
    if (lastUser && lastUserText) {
      // Clasificar intent (no bloquea respuesta — promesa en paralelo)
      intent = await classifyIntent({
        message: lastUserText,
        language,
        conversationId: conv.id,
      });

      await sb.from("chat_messages").insert({
        conversation_id: conv.id,
        role: "user",
        content: lastUserText,
        intent,
      });
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

    // Si ya tenemos algunos datos pero no todos, indicar siguiente
    if (!conv.lead_id) {
      const missing = [];
      if (!captured.name) missing.push("nombre");
      if (!captured.email) missing.push("email");
      if (!captured.phone) missing.push("teléfono");
      if (missing.length > 0 && (captured.name || captured.email || captured.phone)) {
        hintsLines.push(
          `- AVANZA LA CAPTURA: ya tienes ${Object.keys(captured).filter((k) => captured[k]).join(", ")}. Pide el siguiente dato faltante: ${missing[0]}.`
        );
      }
      if (missing.length === 0 && !conv.consent_accepted) {
        hintsLines.push(
          "- TIENES LOS 3 DATOS. Llama AHORA 'requestConsent' para mostrar el dialog al usuario."
        );
      }
    }

    const contextHints = hintsLines.length ? hintsLines.join("\n") : "";

    // Modelo: usa el smart (gpt-oss-120b) cuando haya intent comercial / consulta KB / handoff
    const useSmartTier =
      intent === "booking" ||
      intent === "policy" ||
      intent === "complaint" ||
      intent === "human_handoff";
    const tier = useSmartTier ? "smart" : "fast";

    // Forzar la tool talkToHuman cuando el cliente pide explícitamente un humano
    const forceTool = intent === "human_handoff" ? "talkToHuman" : undefined;

    // Ejecutar agente con fallback chain
    const { result, providerUsed, modelUsed } = await runAgent({
      messages,
      language,
      conversationId: conv.id,
      contextHints,
      tier,
      forceTool,
    });

    // Hook onFinish (después de stream): persistir respuesta del assistant
    // Lo hacemos vía consumeStream pattern: pasamos un callback en options
    return result.toUIMessageStreamResponse({
      onFinish: async ({ messages: finalMessages }) => {
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
