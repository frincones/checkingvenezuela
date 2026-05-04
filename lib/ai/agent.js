/**
 * Orquestador del agente de chat.
 * Hace streaming con Vercel AI SDK 6 + Groq + tools + fallback chain.
 *
 * NOTA: la persistencia de mensajes la maneja el endpoint /api/chatbot/chat,
 * este módulo solo construye el streamText.
 */

import { streamText, generateText, stepCountIs, convertToModelMessages } from "ai";
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
  forceTool, // opcional: nombre de tool a forzar (toolChoice exact)
  requireTool = false, // opcional: forzar al modelo a llamar CUALQUIER tool en step 0
}) {
  const tools = getAgentTools();
  const system = getSystemPrompt({ language, contextHints });
  const chain = getFallbackChain({ tier });

  // Limpiar partes 'reasoning' del historial: algunos modelos (gpt-oss-120b)
  // las emiten en la salida, pero la mayoría de los modelos NO las aceptan
  // en la entrada. Si fallback cambia de modelo entre turnos, sin esto truena
  // con "reasoning is not supported with this model".
  const cleanedMessages = Array.isArray(messages)
    ? messages.map((m) =>
        Array.isArray(m.parts)
          ? { ...m, parts: m.parts.filter((p) => p.type !== "reasoning") }
          : m
      )
    : messages;

  // Convertir messages tipo UIMessage a ModelMessage si vienen del cliente
  // (convertToModelMessages es async en AI SDK 6)
  const modelMessages =
    Array.isArray(cleanedMessages) && cleanedMessages[0]?.parts
      ? await convertToModelMessages(cleanedMessages)
      : cleanedMessages;

  let lastError;
  for (let i = 0; i < chain.length; i++) {
    const config = chain[i];
    const isLast = i === chain.length - 1;

    // Pre-flight check (solo si no es el último de la cadena): hacemos un
    // generateText mínimo (1 token) para detectar rate-limit ANTES de
    // empezar el streaming real. Si la cuota está exhausta, bajamos al
    // siguiente proveedor sin que el usuario vea un error a medio stream.
    if (!isLast) {
      try {
        await generateText({
          model: config.model,
          prompt: ".",
          temperature: 0,
        });
      } catch (err) {
        lastError = err;
        if (isRateLimitError(err)) {
          console.warn(
            `[agent] ${config.provider}/${config.modelId} rate-limited (pre-flight), bajando a fallback...`
          );
          continue;
        }
        throw err;
      }
    }

    try {
      const start = Date.now();
      const result = streamText({
        model: config.model,
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
              // Cualquier tool — evita que el modelo escriba preámbulo antes de llamar
              return { toolChoice: "required" };
            }
          }
          // Step 1+: refuerza el formato de respuesta con los datos de la tool.
          if (stepNumber > 0 && (requireTool || forceTool)) {
            return {
              system:
                system +
                "\n\n=== INSTRUCCIÓN PARA ESTE PASO ===\n" +
                "Acabas de obtener resultados de una tool. AHORA muestra TODOS los resultados al usuario en el formato establecido (lista con bullets, **nombre** — **precio** — descripción corta). " +
                "NO los resumas en una frase. NO preguntes si quiere más detalles. " +
                "Después de mostrarlos, termina con UNA pregunta de avance al lead (pedir nombre / cuál le interesa más / conectar asesor).",
            };
          }
          return {};
        },
        experimental_context: { conversationId, language },
        onError: ({ error }) => {
          console.warn(
            `[agent] ${config.provider}/${config.modelId} stream error:`,
            error?.message?.slice(0, 200)
          );
        },
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
          `[agent] ${config.provider}/${config.modelId} rate-limited (sync), intentando siguiente...`
        );
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Cadena de proveedores agotada");
}
