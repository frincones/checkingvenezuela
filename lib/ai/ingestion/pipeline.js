/**
 * Pipeline de ingestion: source → parse → chunk → embed → upsert.
 * Idempotente vía content_hash a nivel documento.
 */

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { embedBatch } from "../embeddings.js";
import { logUsage } from "../usage.js";
import { chunkText } from "./chunker.js";
import { detectLanguage } from "../utils.js";

let _client = null;
function admin() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _client;
}

function hash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Crea o reutiliza un kb_source.
 *
 * @param {object} input
 * @param {string} input.type
 * @param {string} input.name
 * @param {string} [input.description]
 * @param {string} [input.url]
 * @param {string} [input.storagePath]
 * @param {string} [input.language]
 * @param {string} [input.createdBy]
 * @param {object} [input.metadata]
 */
export async function upsertKbSource({
  type,
  name,
  description,
  url,
  storagePath,
  language = "es",
  createdBy,
  metadata = {},
}) {
  const sb = admin();

  // Buscar source existente por type + name
  const { data: existing } = await sb
    .from("kb_sources")
    .select("id")
    .eq("type", type)
    .eq("name", name)
    .maybeSingle();

  if (existing) {
    await sb
      .from("kb_sources")
      .update({
        status: "pending",
        ingestion_error: null,
        description: description ?? undefined,
        url: url ?? undefined,
        storage_path: storagePath ?? undefined,
        language,
        metadata,
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data, error } = await sb
    .from("kb_sources")
    .insert({
      type,
      name,
      description,
      url,
      storage_path: storagePath,
      language,
      status: "pending",
      metadata,
      created_by: createdBy || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Ingesta un set de documentos en una source.
 * Cada item: { title, content, metadata? }
 *
 * @param {object} args
 * @param {string} args.sourceId
 * @param {Array<{title: string, content: string, metadata?: object}>} args.documents
 * @param {string} [args.language]
 */
export async function ingestDocuments({ sourceId, documents, language }) {
  if (!sourceId) throw new Error("ingestDocuments: sourceId requerido");
  if (!Array.isArray(documents)) throw new Error("ingestDocuments: documents debe ser array");

  const sb = admin();

  // Marcar source como processing
  await sb
    .from("kb_sources")
    .update({ status: "processing", ingestion_error: null })
    .eq("id", sourceId);

  let totalDocs = 0;
  let totalChunks = 0;
  let totalTokens = 0;

  try {
    for (const doc of documents) {
      if (!doc.content || !doc.content.trim()) continue;

      const docHash = hash(doc.content);
      const docLang = language || detectLanguage(doc.content);

      // Upsert documento por (source_id, content_hash)
      const { data: existing } = await sb
        .from("kb_documents")
        .select("id")
        .eq("source_id", sourceId)
        .eq("content_hash", docHash)
        .maybeSingle();

      let docId;
      if (existing) {
        docId = existing.id;
        // Borrar chunks viejos para re-chunk con la versión actual
        await sb.from("kb_chunks").delete().eq("document_id", docId);
      } else {
        const { data: inserted, error: insErr } = await sb
          .from("kb_documents")
          .insert({
            source_id: sourceId,
            title: doc.title || "Sin título",
            content_hash: docHash,
            raw_content: doc.content.slice(0, 1000000), // cap ~1MB
            language: docLang,
            metadata: doc.metadata || {},
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        docId = inserted.id;
      }

      // Chunkear
      const chunks = chunkText(doc.content);
      if (chunks.length === 0) continue;

      // Embeddings en batch
      const texts = chunks.map((c) => c.content);
      const { embeddings, totalTokens: embedTokens } = await embedBatch(texts);
      totalTokens += embedTokens;

      // Log uso de Jina
      await logUsage({
        provider: "jina",
        operation: "embed",
        model: "jina-embeddings-v3",
        tokens: embedTokens,
        requests: Math.ceil(chunks.length / 100),
        sourceId,
        metadata: { doc_title: doc.title, chunk_count: chunks.length },
      });

      // Insertar chunks (en batches de 50 para no saturar)
      const rows = chunks.map((c, i) => ({
        document_id: docId,
        chunk_order: c.order,
        content: c.content,
        tokens: c.tokens,
        embedding: embeddings[i],
        metadata: { ...(doc.metadata || {}) },
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error: insErr } = await sb.from("kb_chunks").insert(batch);
        if (insErr) throw insErr;
      }

      totalDocs++;
      totalChunks += chunks.length;
    }

    // Marcar source completed
    await sb
      .from("kb_sources")
      .update({
        status: "completed",
        document_count: totalDocs,
        chunk_count: totalChunks,
        total_tokens: totalTokens,
        ingested_at: new Date().toISOString(),
      })
      .eq("id", sourceId);

    return { sourceId, totalDocs, totalChunks, totalTokens };
  } catch (err) {
    // Marcar source failed
    await sb
      .from("kb_sources")
      .update({
        status: "failed",
        ingestion_error: err.message,
      })
      .eq("id", sourceId);
    throw err;
  }
}
