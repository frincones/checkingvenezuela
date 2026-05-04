/**
 * GET    /api/crm/chatbot/kb       - Lista fuentes
 * DELETE /api/crm/chatbot/kb?id=X  - Elimina fuente y sus chunks
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { error: "No autorizado", status: 401 };
  return { user };
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("kb_sources")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return NextResponse.json(
          { error: "Migración 009 no aplicada", data: [] },
          { status: 503 }
        );
      }
      throw error;
    }
    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error("[crm/chatbot/kb GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const adminClient = createAdminClient();

    // Si tiene archivo en storage, intentar borrarlo
    const { data: src } = await adminClient
      .from("kb_sources")
      .select("storage_path, storage_bucket")
      .eq("id", id)
      .maybeSingle();
    if (src?.storage_path) {
      try {
        await adminClient.storage
          .from(src.storage_bucket || "chatbot-kb")
          .remove([src.storage_path]);
      } catch (e) {
        console.warn("[kb DELETE] storage remove failed:", e.message);
      }
    }

    // Cascade DELETE elimina kb_documents y kb_chunks
    const { error } = await adminClient.from("kb_sources").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[crm/chatbot/kb DELETE]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
