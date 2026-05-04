/**
 * GET /api/crm/chatbot/conversations
 * Lista conversaciones del chatbot con filtros y paginación.
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const language = searchParams.get("language");
    const status = searchParams.get("status");
    const hasLead = searchParams.get("has_lead"); // 'true' | 'false'
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    const offset = (page - 1) * limit;

    let query = adminClient
      .from("chat_conversations")
      .select(
        `
        id, session_id, language, status, message_count, total_tokens,
        consent_accepted, consent_accepted_at, contact_captured,
        lead_id, started_at, last_message_at, created_at,
        lead:leads!chat_conversations_lead_id_fkey(id, contact_name, contact_email, status, interest_type)
      `,
        { count: "exact" }
      )
      .order("last_message_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (language) query = query.eq("language", language);
    if (status) query = query.eq("status", status);
    if (hasLead === "true") query = query.not("lead_id", "is", null);
    if (hasLead === "false") query = query.is("lead_id", null);
    if (dateFrom) query = query.gte("started_at", dateFrom);
    if (dateTo) query = query.lte("started_at", dateTo);

    const { data, error, count } = await query;
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return NextResponse.json(
          { error: "Tabla chat_conversations no existe. Aplica la migración 009." },
          { status: 503 }
        );
      }
      throw error;
    }

    let conversations = data || [];

    // Búsqueda por contenido (busca en chat_messages.content)
    if (search) {
      const { data: matchedConvIds } = await adminClient
        .from("chat_messages")
        .select("conversation_id")
        .ilike("content", `%${search}%`)
        .limit(200);
      const ids = new Set((matchedConvIds || []).map((r) => r.conversation_id));
      conversations = conversations.filter((c) => ids.has(c.id));
    }

    return NextResponse.json({
      data: conversations,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error("[crm/chatbot/conversations]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
