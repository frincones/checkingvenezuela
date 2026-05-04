/**
 * POST /api/crm/chatbot/kb/sync
 * Body: { type: 'db_destinations'|'db_packages'|'db_services'|'web', url? }
 * Re-sincroniza fuentes desde DB o ingesta una URL nueva.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { ingestKbAction } from "@/lib/actions/chatbot/ingestKbAction";

const VALID_TYPES = ["db_destinations", "db_packages", "db_services", "web"];

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

    const body = await request.json();
    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json(
        { error: `Tipo no soportado. Válidos: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (body.type === "web" && !body.url) {
      return NextResponse.json({ error: "url requerida para type=web" }, { status: 400 });
    }

    const result = await ingestKbAction({
      type: body.type,
      url: body.url,
      name: body.name,
      language: body.language || "es",
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
    console.error("[kb/sync]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
