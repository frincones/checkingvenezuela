/**
 * Orquestador del agente de chat.
 * Vercel AI SDK 6 + multi-provider (Gemini directo + OpenRouter fallback).
 *
 * NOTA: la persistencia de mensajes la maneja el endpoint /api/chatbot/chat,
 * este módulo solo construye el streamText.
 */

import { streamText, stepCountIs, convertToModelMessages } from "ai";
import {
  getChatModel,
  getOpenRouterFallbackModels,
  isRateLimitError,
  markRateLimited,
} from "./providers.js";
import { getSystemPrompt } from "./prompts/system.js";
import { getAgentTools } from "./tools/index.js";
import { logUsage } from "./usage.js";

// MAX_STEPS = 2 es suficiente: step 0 = 1 tool call, step 1 = generar texto.
// Si lo subimos, el modelo encadena tools sin nunca generar respuesta y el
// usuario ve "..." infinito.
// (TODO commit 6: subir a 6 una vez tengamos buenas tool descriptions)
const MAX_STEPS = 2;

/**
 * Construye y devuelve un stream de respuesta del agente.
 *
 * @param {object} args
 * @param {Array} args.messages - mensajes en formato AI SDK 6 (UIMessage o ModelMessage)
 * @param {string} args.language - 'es' | 'en'
 * @param {string} args.conversationId - id de chat_conversations
 * @param {string} [args.contextHints] - info adicional para system prompt
 * @param {"primary"|"smart"} [args.tier] - 'smart' usa modelo de razonamiento profundo
 * @param {string} [args.forceTool] - nombre de tool a forzar (toolChoice exact)
 * @param {boolean} [args.requireTool] - forzar al modelo a llamar CUALQUIER tool en step 0
 * @param {string} [args.intent] - filtra el set de tools cargadas para reducir latencia
 */
export async function runAgent({
  messages,
  language = "es",
  conversationId,
  contextHints = "",
  tier = "primary",
  forceTool,
  requireTool = false,
  intent,
  inCapture = false,
}) {
  // Compat: el call-site viejo pasaba tier='fast'. Lo mapeamos a 'primary'.
  if (tier === "fast") tier = "primary";

  const tools = getAgentTools(intent, { inCapture });
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
  const result = streamText({
    model: picked.handle,
    system,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    temperature: 0.4,
    prepareStep: ({ stepNumber }) => {
      if (stepNumber === 0) {
        if (forceTool && tools[forceTool]) {
          return { toolChoice: { type: "tool", toolName: forceTool } };
        }
        if (requireTool) {
          return { toolChoice: "required" };
        }
      }
      // Step 1+: NO más tool calls — el modelo DEBE generar texto con los
      // resultados que ya tiene. Sin esto, los modelos pequeños (Ling /
      // gemma) tienden a encadenar searchPackages → searchHotels →
      // searchFlights sin nunca producir respuesta, dejando al cliente con
      // un "..." infinito.
      if (stepNumber >= 1) {
        return { toolChoice: "none" };
      }
      return {};
    },
    experimental_context: { conversationId, language },
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
