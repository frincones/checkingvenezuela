"use server";

/**
 * Server Action para ingestar contenido al knowledge base del chatbot.
 * Solo usuarios con perfil de advisor pueden ejecutarla.
 *
 * Patrones soportados:
 *  - file: { type: 'docx'|'pdf'|'txt'|'md', name, storagePath, language? }
 *  - url:  { type: 'web', url, name?, language? }
 *  - db:   { type: 'db_destinations'|'db_packages'|'db_services' }
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { revalidatePath } from "next/cache";
import { upsertKbSource, ingestDocuments } from "@/lib/ai/ingestion/pipeline";
import { parseDocx } from "@/lib/ai/ingestion/parsers/docx";
import { parsePdf } from "@/lib/ai/ingestion/parsers/pdf";
import { parseWeb } from "@/lib/ai/ingestion/parsers/web";
import {
  extractDestinations,
  extractCatalogServices,
  extractPackages,
} from "@/lib/ai/ingestion/parsers/db";

async function checkAdvisorAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 };

  const adminClient = createAdminClient();
  const { data: advisor } = await adminClient
    .from("advisors")
    .select("id")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!advisor) return { error: "Acceso restringido a asesores", status: 403 };
  return { user, advisorId: advisor.id };
}

async function downloadFromStorage(bucket, storagePath) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.storage.from(bucket).download(storagePath);
  if (error) throw new Error(`Storage download error: ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Acción principal de ingestion.
 *
 * @param {object} input
 * @param {"docx"|"pdf"|"txt"|"md"|"web"|"db_destinations"|"db_packages"|"db_services"} input.type
 * @param {string} [input.name]
 * @param {string} [input.url]               // para type='web'
 * @param {string} [input.storagePath]       // para archivos
 * @param {string} [input.storageBucket]     // default 'chatbot-kb'
 * @param {string} [input.language='es']
 * @param {object} [input.metadata]
 */
export async function ingestKbAction(input) {
  try {
    const access = await checkAdvisorAccess();
    if (access.error) return { success: false, error: access.error };

    const language = input.language || "es";
    const bucket = input.storageBucket || "chatbot-kb";
    let documents = [];
    let sourceName = input.name;

    switch (input.type) {
      case "docx": {
        if (!input.storagePath) return { success: false, error: "storagePath requerido" };
        const buf = await downloadFromStorage(bucket, input.storagePath);
        const { text } = await parseDocx(buf);
        documents = [{ title: input.name || input.storagePath, content: text }];
        sourceName = sourceName || input.storagePath;
        break;
      }
      case "pdf": {
        if (!input.storagePath) return { success: false, error: "storagePath requerido" };
        const buf = await downloadFromStorage(bucket, input.storagePath);
        const { text } = await parsePdf(buf);
        documents = [{ title: input.name || input.storagePath, content: text }];
        sourceName = sourceName || input.storagePath;
        break;
      }
      case "txt":
      case "md": {
        if (!input.storagePath) return { success: false, error: "storagePath requerido" };
        const buf = await downloadFromStorage(bucket, input.storagePath);
        const text = buf.toString("utf-8");
        documents = [{ title: input.name || input.storagePath, content: text }];
        sourceName = sourceName || input.storagePath;
        break;
      }
      case "web": {
        if (!input.url) return { success: false, error: "url requerida" };
        const { text, title } = await parseWeb(input.url);
        documents = [{ title: input.name || title || input.url, content: text }];
        sourceName = sourceName || input.url;
        break;
      }
      case "db_destinations": {
        documents = await extractDestinations();
        sourceName = sourceName || "Destinos (sync DB)";
        break;
      }
      case "db_packages": {
        documents = await extractPackages();
        sourceName = sourceName || "Paquetes (sync DB)";
        break;
      }
      case "db_services": {
        documents = await extractCatalogServices();
        sourceName = sourceName || "Servicios catálogo (sync DB)";
        break;
      }
      default:
        return { success: false, error: `Tipo no soportado: ${input.type}` };
    }

    if (documents.length === 0) {
      return { success: false, error: "No se extrajo contenido (vacío)" };
    }

    const sourceId = await upsertKbSource({
      type: input.type,
      name: sourceName,
      description: input.description,
      url: input.url,
      storagePath: input.storagePath,
      language,
      createdBy: access.user.id,
      metadata: input.metadata || {},
    });

    // PURGA previa a la re-ingesta de fuentes derivadas de la BD.
    //
    // ingestDocuments hace upsert por (source_id, content_hash): cuando el
    // contenido cambia —al traducirlo, por ejemplo— el hash cambia y se
    // INSERTA un documento nuevo, dejando el viejo huérfano para siempre.
    // Sin esta purga, un re-sync tras la traducción dejaba el índice con las
    // dos versiones y el chatbot recuperaba español obsoleto y precios viejos.
    //
    // Solo aplica a las fuentes db_* / manual, que se regeneran enteras desde
    // la BD. Los documentos subidos a mano (docx/pdf/web) no se tocan.
    if (String(input.type).startsWith("db_") || input.purgeBeforeIngest === true) {
      const { error: purgeErr } = await createAdminClient()
        .from("kb_documents")
        .delete()
        .eq("source_id", sourceId); // kb_chunks cae por ON DELETE CASCADE
      if (purgeErr) console.error("[ingestKbAction] purga fallida:", purgeErr.message);
    }

    const result = await ingestDocuments({ sourceId, documents, language });

    revalidatePath("/dashboard/chatbot/knowledge-base");
    return { success: true, ...result };
  } catch (err) {
    console.error("[ingestKbAction]", err);
    return { success: false, error: err.message };
  }
}
