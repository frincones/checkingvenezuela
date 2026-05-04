/**
 * POST /api/crm/chatbot/kb/upload
 * multipart/form-data: file, type (docx|pdf|txt|md), name?, language?
 *
 * Sube el archivo a Supabase Storage (bucket chatbot-kb) y dispara la ingesta.
 */

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { ingestKbAction } from "@/lib/actions/chatbot/ingestKbAction";

const ALLOWED_TYPES = ["docx", "pdf", "txt", "md"];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { error: "No autorizado", status: 401 };
  return { user };
}

export async function POST(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const formData = await request.formData();
    const file = formData.get("file");
    const type = formData.get("type");
    const name = formData.get("name");
    const language = formData.get("language") || "es";

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Tipo no soportado. Permitidos: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Archivo excede 50MB" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const safeName = (name || file.name || "doc").replace(/[^\w.-]/g, "_");
    const storagePath = `${type}/${Date.now()}_${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await adminClient.storage
      .from("chatbot-kb")
      .upload(storagePath, Buffer.from(arrayBuffer), {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadErr) {
      return NextResponse.json(
        { error: `Storage error: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    // Ejecutar ingestion (síncrono — para archivos chicos OK; cap está en 50MB)
    const result = await ingestKbAction({
      type,
      name: name || file.name,
      storagePath,
      storageBucket: "chatbot-kb",
      language,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      sourceId: result.sourceId,
      totalDocs: result.totalDocs,
      totalChunks: result.totalChunks,
      totalTokens: result.totalTokens,
    });
  } catch (err) {
    console.error("[kb/upload]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
