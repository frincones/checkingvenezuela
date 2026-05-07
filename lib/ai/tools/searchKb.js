/**
 * Tool: hybrid search sobre el knowledge base (vector + trigram).
 * Devuelve los top-k chunks más relevantes con metadata de fuente.
 */

import { tool } from "ai";
import { z } from "zod";
import { admin } from "./_admin.js";
import { embedQuery } from "../embeddings.js";
import { logUsage } from "../usage.js";
import { truncate } from "../utils.js";

export const searchKbTool = tool({
  description: [
    "Hybrid search (vector + trigram) sobre la knowledge base: políticas, T&C,",
    "devoluciones, garantías, seguridad, info corporativa, FAQ.",
    "USE WHEN: el cliente pregunta '¿pueden cancelar?', '¿hay reembolso?',",
    "  '¿son seguros?', '¿cómo es la política de X?', 'términos y condiciones',",
    "  '¿quiénes son ustedes?'. También para info enciclopédica que no esté en",
    "  destinos/paquetes (ej. requisitos de visa, vacunas, qué llevar).",
    "DO NOT USE: para precios, paquetes, hoteles ni vuelos — usa search* específicos.",
    "EXAMPLE: 'puedo cancelar 5 días antes?' → searchKb({ query: 'política',",
    "  cancelación 5 días' }).",
    "RETURNS: { ok, count, results: [{title, snippet, source, url, score}] }. Cita",
    "  textualmente; NO inventes cláusulas que no estén en el snippet devuelto.",
  ].join("\n"),
  inputSchema: z
    .object({
      query: z.string().min(2).describe("Pregunta o texto a buscar en la base de conocimiento"),
      language: z
        .enum(["es", "en"])
        .optional()
        .describe("Filtrar por idioma del documento (opcional)"),
      topK: z.number().int().min(1).max(10).optional().describe("Cuántos resultados devolver (default 4)"),
    })
    .passthrough(),
  execute: async ({ query, language, topK = 4 }, { experimental_context } = {}) => {
    try {
      const sb = admin();
      const queryVec = await embedQuery(query);

      // Log uso del embedding query
      logUsage({
        provider: "jina",
        operation: "embed_query",
        model: "jina-embeddings-v3",
        tokens: Math.ceil(query.length / 4),
        conversationId: experimental_context?.conversationId,
        metadata: { query: truncate(query, 100) },
      });

      const { data, error } = await sb.rpc("match_kb_chunks", {
        query_embedding: queryVec,
        query_text: query,
        match_threshold: 0.3,
        match_count: topK,
        filter_language: language || null,
      });

      if (error) {
        return {
          ok: false,
          error: `Error en búsqueda: ${error.message}`,
          results: [],
        };
      }

      const results = (data || []).map((r) => ({
        content: r.content,
        source: r.source_name,
        sourceType: r.source_type,
        documentTitle: r.document_title,
        score: Number(r.combined_score?.toFixed(3)),
      }));

      return { ok: true, count: results.length, results };
    } catch (err) {
      return { ok: false, error: err.message, results: [] };
    }
  },
});
