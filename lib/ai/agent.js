/**
 * Orquestador del agente de chat.
 * Vercel AI SDK 6 + multi-provider (Gemini directo + OpenRouter fallback).
 *
 * NOTA: la persistencia de mensajes la maneja el endpoint /api/chatbot/chat,
 * este módulo solo construye el streamText.
 */

import { streamText, hasToolCall, convertToModelMessages } from "ai";
import {
  getChatModel,
  getOpenRouterFallbackModels,
  isRateLimitError,
  markRateLimited,
} from "./providers.js";
import { getSystemPrompt } from "./prompts/system.js";
import { getAgentTools } from "./tools/index.js";
import { logUsage } from "./usage.js";

// MAX_STEPS = 6 permite recovery: el modelo puede ver un tool error o un
// resultado vacío y reintentar (otra query, otra tool) antes de fallar.
// Antes era 2 → no había chance de recuperar de un 0-result. La cadena
// terminal-tool stop abajo asegura que createLead/talkToHuman cierran el
// turno sin colgarse.
const MAX_STEPS = 6;

// Tools terminales: cuando el modelo las llama, el turno termina.
// createLead = lead creado (asesor humano toma el relevo)
// talkToHuman = handoff explícito (botón WhatsApp)
const TERMINAL_TOOLS = ["createLead", "talkToHuman"];

/**
 * Construye y devuelve un stream de respuesta del agente.
 *
 * @param {object} args
 * @param {Array} args.messages - mensajes en formato AI SDK 6 (UIMessage o ModelMessage)
 * @param {string} args.language - 'es' | 'en'
 * @param {string} args.conversationId - id de chat_conversations
 * @param {string} [args.contextHints] - bloque FACTS para el system prompt
 * @param {"primary"|"smart"} [args.tier] - 'smart' usa modelo de razonamiento profundo
 * @param {string} [args.forceTool] - nombre de tool a forzar (solo casos extremos como human_handoff)
 * @param {string} [args.intent] - hint informativo (no vinculante)
 */
export async function runAgent({
  messages,
  language = "es",
  conversationId,
  contextHints = "",
  tier = "primary",
  forceTool,
  intent,
}) {
  // Compat: el call-site viejo pasaba tier='fast'. Lo mapeamos a 'primary'.
  if (tier === "fast") tier = "primary";

  const tools = getAgentTools();
  const system = getSystemPrompt({ language, contextHints });

  // Limpiar partes 'reasoning' del historial: algunos modelos (gpt-oss-120b)
  // las emiten en la salida pero NO las aceptan en la entrada.
  const cleanedMessages = Array.isArray(messages)
    ? messages.map((m) =>
        Array.isArray(m.parts)
          ? { ...m, parts: m.parts.filter((p) => p.type !== "reasoning") }
          : m
      )
    : messages;

  let modelMessages =
    Array.isArray(cleanedMessages) && cleanedMessages[0]?.parts
      ? await convertToModelMessages(cleanedMessages)
      : cleanedMessages;

  // Truncar history a últimos 8 mensajes (cada turno consume tokens)
  if (Array.isArray(modelMessages) && modelMessages.length > 8) {
    modelMessages = modelMessages.slice(-8);
  }

  // Pick del modelo activo (Gemini si disponible y no en cooldown, sino OR)
  const picked = getChatModel({ tier });
  const primaryModelId = picked.modelId;
  const provider = picked.provider;

  // providerOptions: solo configuramos los del provider activo.
  const providerOptions = {};

  if (provider === "google") {
    // Thinking en modo auto: el modelo decide cuándo gastar reasoning tokens.
    // -1 = dynamic (recomendado para chatbots con casos mixtos)
    providerOptions.google = {
      thinkingConfig: { thinkingBudget: -1, includeThoughts: false },
    };
  } else if (provider === "openrouter") {
    // OpenRouter native fallback: si el modelo activo OR falla upstream,
    // OR prueba estos automáticamente sin que lo veamos.
    providerOptions.openrouter = {
      models: getOpenRouterFallbackModels(primaryModelId),
    };
  }

  const start = Date.now();
  // stopWhen acepta un array de condiciones (OR semántico). El stream para
  // cuando: (a) llegamos al cap de steps, o (b) el modelo llamó una tool
  // terminal (createLead, talkToHuman) — esos cierran el turno.
  const stopWhen = [
    ({ steps }) => steps.length >= MAX_STEPS,
    hasToolCall("createLead"),
    hasToolCall("talkToHuman"),
  ];

  const result = streamText({
    model: picked.handle,
    system,
    messages: modelMessages,
    tools,
    stopWhen,
    temperature: 0.4,
    // forceTool todavía soportado para casos extremos (ej: human_handoff
    // donde el sistema YA sabe que toca talkToHuman). requireTool eliminado
    // — confiamos en que el modelo razone qué hacer leyendo las tool
    // descriptions + FACTS. Si necesita texto puro (chitchat, agradecimiento),
    // ahora puede generarlo sin que lo forcemos a inventar tool calls.
    prepareStep: ({ stepNumber }) => {
      if (stepNumber === 0 && forceTool && tools[forceTool]) {
        return { toolChoice: { type: "tool", toolName: forceTool } };
      }
      return {};
    },
    experimental_context: { conversationId, language },
    // Telemetry estructurada: la AI SDK emite spans OpenTelemetry compatibles
    // con Langfuse / Helicone / Vercel OTel. Para activar ingesta, configurar
    // un OTel SDK en `instrumentation.ts` (ver docs/observability.md).
    // Mientras tanto, los spans están listos pero no se exportan a ningún lado.
    experimental_telemetry: {
      isEnabled: true,
      functionId: "vale-chat",
      metadata: {
        conversationId: conversationId || "unknown",
        language,
        tier,
        intent: intent || "none",
        modelId: primaryModelId,
        provider,
      },
    },
    providerOptions,
    onError: ({ error }) => {
      // Si fue rate-limit, marcamos cooldown del modelo activo para que la
      // próxima request salte a fallback en getChatModel.
      if (isRateLimitError(error)) {
        markRateLimited(primaryModelId);
        console.warn(
          `[agent] rate-limit on ${primaryModelId} — cooldown 60s. msg=${String(error?.message || "").slice(0, 120)}`
        );
      } else {
        console.warn(
          `[agent] stream error (model=${primaryModelId}):`,
          error?.message?.slice(0, 200)
        );
      }
    },
    onFinish: async ({ usage, finishReason, text, response }) => {
      const totalTokens = usage?.totalTokens || usage?.total_tokens || 0;
      const actualModel =
        response?.modelId ||
        response?.providerMetadata?.openrouter?.provider ||
        primaryModelId;
      logUsage({
        provider,
        operation: "chat",
        model: actualModel,
        tokens: totalTokens,
        requests: 1,
        conversationId,
        metadata: {
          latency_ms: Date.now() - start,
          finish_reason: finishReason,
          response_chars: text?.length || 0,
          primary_model: primaryModelId,
          tier,
        },
      });
    },
  });

  return {
    result,
    providerUsed: provider,
    modelUsed: primaryModelId,
  };
}
