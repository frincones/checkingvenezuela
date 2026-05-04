/**
 * Orquestador del agente de chat.
 * Hace streaming con Vercel AI SDK 6 + Groq + tools + fallback chain.
 *
 * NOTA: la persistencia de mensajes la maneja el endpoint /api/chatbot/chat,
 * este módulo solo construye el streamText.
 */

import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { getFallbackChain, isRateLimitError } from "./providers.js";
import { getSystemPrompt } from "./prompts/system.js";
import { getAgentTools } from "./tools/index.js";
import { logUsage } from "./usage.js";

const MAX_STEPS = 5;

/**
 * Construye y devuelve un stream de respuesta del agente.
 *
 * @param {object} args
 * @param {Array} args.messages - mensajes en formato AI SDK 6 (UIMessage o ModelMessage)
 * @param {string} args.language - 'es' | 'en'
 * @param {string} args.conversationId - id de chat_conversations
 * @param {object} [args.contextHints] - info adicional para system prompt
 * @param {"fast"|"smart"} [args.tier] - 'smart' usa modelo más capaz para tool use
 * @returns {Promise<{result: any, providerUsed: string, modelUsed: string}>}
 */
export async function runAgent({
  messages,
  language = "es",
  conversationId,
  contextHints = "",
  tier = "fast",
}) {
  const tools = getAgentTools();
  const system = getSystemPrompt({ language, contextHints });
  const chain = getFallbackChain({ tier });

  // Convertir messages tipo UIMessage a ModelMessage si vienen del cliente
  // (convertToModelMessages es async en AI SDK 6)
  const modelMessages =
    Array.isArray(messages) && messages[0]?.parts
      ? await convertToModelMessages(messages)
      : messages;

  let lastError;
  for (const config of chain) {
    try {
      const start = Date.now();
      const result = streamText({
        model: config.model,
        system,
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(MAX_STEPS),
        temperature: 0.4,
        // Pasamos contexto a las tools vía experimental_context
        experimental_context: { conversationId, language },
        onFinish: async ({ usage, finishReason, text }) => {
          const totalTokens = usage?.totalTokens || usage?.total_tokens || 0;
          logUsage({
            provider: config.provider,
            operation: "chat",
            model: config.modelId,
            tokens: totalTokens,
            requests: 1,
            conversationId,
            metadata: {
              latency_ms: Date.now() - start,
              finish_reason: finishReason,
              response_chars: text?.length || 0,
            },
          });
        },
      });

      return {
        result,
        providerUsed: config.provider,
        modelUsed: config.modelId,
      };
    } catch (err) {
      lastError = err;
      if (isRateLimitError(err)) {
        console.warn(
          `[agent] ${config.provider}/${config.modelId} rate-limited, intentando siguiente...`
        );
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Cadena de proveedores agotada");
}
