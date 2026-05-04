/**
 * Wrapper para Jina Embeddings v3 (multilingual, 1024 dims).
 * Free tier: 1M tokens/mes sin tarjeta.
 *
 * Uso:
 *   import { embed, embedBatch } from "@/lib/ai/embeddings";
 *   const vec = await embed("texto");
 *   const vecs = await embedBatch(["t1", "t2"]);
 */

import crypto from "crypto";

const JINA_URL = "https://api.jina.ai/v1/embeddings";
const JINA_MODEL = "jina-embeddings-v3";
const EMBEDDING_DIMS = 1024;
const BATCH_SIZE = 100;

// In-memory cache (por contenido hash) para evitar re-embed en una misma run
const cache = new Map();
const MAX_CACHE_SIZE = 1000;

function hashContent(text) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function setCache(hash, vec) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(hash, vec);
}

/**
 * Llama directamente a la API REST de Jina con retry.
 *
 * @param {string[]} texts - máximo 100 textos por llamada (Jina max)
 * @param {object} opts
 * @param {"retrieval.passage"|"retrieval.query"|"text-matching"} [opts.task="retrieval.passage"]
 *   Usa "retrieval.passage" para indexar docs y "retrieval.query" para queries de búsqueda.
 */
async function callJina(texts, { task = "retrieval.passage" } = {}) {
  if (!process.env.JINA_API_KEY) {
    throw new Error("JINA_API_KEY no configurada en .env");
  }
  if (texts.length === 0) return [];
  if (texts.length > BATCH_SIZE) {
    throw new Error(`Batch máximo es ${BATCH_SIZE} textos (recibido: ${texts.length})`);
  }

  const body = {
    model: JINA_MODEL,
    task,
    dimensions: EMBEDDING_DIMS,
    embedding_type: "float",
    input: texts,
  };

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(JINA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.JINA_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        const err = new Error(`Jina API ${res.status}: ${errText.slice(0, 200)}`);
        err.statusCode = res.status;
        if (res.status === 429 && attempt < 2) {
          // backoff exponencial
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          lastError = err;
          continue;
        }
        throw err;
      }

      const data = await res.json();
      // data.data = [{ index, embedding }]; ordenado o no, normalizamos por index
      const result = new Array(texts.length);
      for (const item of data.data) {
        result[item.index] = item.embedding;
      }
      return {
        embeddings: result,
        usage: data.usage || { total_tokens: 0, prompt_tokens: 0 },
      };
    } catch (err) {
      lastError = err;
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

/**
 * Genera embedding para UN texto.
 * @returns {Promise<number[]>} vector de 1024 floats
 */
export async function embed(text, opts = {}) {
  if (!text || typeof text !== "string") throw new Error("embed: text requerido");
  const hash = hashContent(text);
  if (cache.has(hash)) return cache.get(hash);

  const { embeddings } = await callJina([text], opts);
  setCache(hash, embeddings[0]);
  return embeddings[0];
}

/**
 * Genera embeddings en batch (auto-chunkea si supera BATCH_SIZE).
 *
 * @param {string[]} texts
 * @returns {Promise<{embeddings: number[][], totalTokens: number}>}
 */
export async function embedBatch(texts, opts = {}) {
  if (!Array.isArray(texts)) throw new Error("embedBatch: texts debe ser array");
  if (texts.length === 0) return { embeddings: [], totalTokens: 0 };

  const result = new Array(texts.length);
  let totalTokens = 0;

  // Separar cached vs por-pedir
  const toFetch = [];
  const toFetchIdx = [];
  for (let i = 0; i < texts.length; i++) {
    const hash = hashContent(texts[i]);
    if (cache.has(hash)) {
      result[i] = cache.get(hash);
    } else {
      toFetch.push(texts[i]);
      toFetchIdx.push(i);
    }
  }

  // Procesar en batches de BATCH_SIZE
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    const batchIdx = toFetchIdx.slice(i, i + BATCH_SIZE);
    const { embeddings, usage } = await callJina(batch, opts);
    totalTokens += usage.total_tokens || 0;
    for (let j = 0; j < embeddings.length; j++) {
      const originalIdx = batchIdx[j];
      result[originalIdx] = embeddings[j];
      setCache(hashContent(texts[originalIdx]), embeddings[j]);
    }
  }

  return { embeddings: result, totalTokens };
}

/**
 * Genera embedding optimizado para QUERY (no para indexing).
 * Usa task='retrieval.query' como recomienda Jina v3.
 */
export async function embedQuery(text) {
  return embed(text, { task: "retrieval.query" });
}

export const EMBEDDING_DIMENSIONS = EMBEDDING_DIMS;
