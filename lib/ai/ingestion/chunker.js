/**
 * Chunker semántico simple — respeta párrafos y frases.
 * Default: 800 tokens (~3200 chars), overlap 150 tokens (~600 chars).
 */

import { estimateTokens } from "../utils.js";

const DEFAULT_CHUNK_SIZE_CHARS = 3200; // ~800 tokens
const DEFAULT_OVERLAP_CHARS = 600; // ~150 tokens
const MIN_CHUNK_SIZE_CHARS = 200;

/**
 * Divide texto en chunks preservando límites de párrafo cuando es posible.
 *
 * @param {string} text
 * @param {object} opts
 * @param {number} [opts.chunkSize=3200] caracteres por chunk
 * @param {number} [opts.overlap=600] caracteres de overlap entre chunks
 * @returns {Array<{order: number, content: string, tokens: number}>}
 */
export function chunkText(text, opts = {}) {
  const chunkSize = opts.chunkSize || DEFAULT_CHUNK_SIZE_CHARS;
  const overlap = opts.overlap || DEFAULT_OVERLAP_CHARS;

  if (!text || typeof text !== "string") return [];
  const cleaned = text.trim();
  if (cleaned.length <= chunkSize) {
    return [{ order: 0, content: cleaned, tokens: estimateTokens(cleaned) }];
  }

  // 1. Dividir por párrafos primero
  const paragraphs = cleaned.split(/\n\n+/).filter((p) => p.trim().length > 0);

  const chunks = [];
  let current = "";
  let order = 0;

  function flush() {
    if (current.trim().length >= MIN_CHUNK_SIZE_CHARS) {
      chunks.push({
        order: order++,
        content: current.trim(),
        tokens: estimateTokens(current),
      });
    } else if (current.trim().length > 0 && chunks.length > 0) {
      // Pegar al chunk anterior si es muy chico
      chunks[chunks.length - 1].content += "\n\n" + current.trim();
      chunks[chunks.length - 1].tokens = estimateTokens(
        chunks[chunks.length - 1].content
      );
    }
  }

  for (const para of paragraphs) {
    if (para.length > chunkSize) {
      // Párrafo gigante: dividir por frases
      flush();
      current = "";
      const sentences = splitBySentences(para);
      for (const sent of sentences) {
        if ((current + sent).length > chunkSize) {
          flush();
          current = (chunks.length > 0 ? tail(current, overlap) : "") + sent + " ";
        } else {
          current += sent + " ";
        }
      }
      flush();
      current = "";
      continue;
    }

    if ((current + "\n\n" + para).length > chunkSize) {
      flush();
      // overlap: arrastrar el final del chunk anterior
      current = (chunks.length > 0 ? tail(current, overlap) : "") + "\n\n" + para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  flush();

  return chunks;
}

function splitBySentences(text) {
  // Heurística simple: ., !, ?, seguido de espacio + mayúscula o salto de línea
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/g)
    .filter((s) => s.trim().length > 0);
}

function tail(text, chars) {
  if (!text || text.length <= chars) return text || "";
  // Cortar en límite de palabra
  const cut = text.slice(-chars);
  const firstSpace = cut.indexOf(" ");
  return firstSpace > 0 ? cut.slice(firstSpace + 1) : cut;
}
