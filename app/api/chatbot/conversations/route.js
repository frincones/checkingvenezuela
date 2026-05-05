/**
 * GET  /api/chatbot/conversations?visitorToken=...
 *   Lista los threads del visitor (últimos N, ordenados por last_message_at).
 *
 * POST /api/chatbot/conversations
 *   Body: { visitorToken, language? }
 *   Crea un nuevo thread vacío para el visitor.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/server";
import { generateSessionId } from "@/lib/ai/utils";

const MAX_LIST = 30;

async function findVisitor(sb, visitorToken) {
  if (!visitorToken) return null;
  const { data } = await sb
    .from("chat_visitors")
    .select("id, preferred_language, contact_captured, consent_accepted")
    .eq("visitor_token", visitorToken)
    .maybeSingle();
  return data;
}

export async function GET(request) {
  try {
    const sb = createAdminClient();
    const { searchParams } = new URL(request.url);
    const visitorToken = searchParams.get("visitorToken");
    const visitor = await findVisitor(sb, visitorToken);
    if (!visitor) {
      return NextResponse.json({ ok: true, conversations: [] });
    }

    const { data, error } = await sb
      .from("chat_conversations")
      .select(
        "id, session_id, title, language, status, message_count, total_tokens, started_at, last_message_at, lead_id"
      )
      .eq("visitor_id", visitor.id)
      .neq("status", "closed") // 'closed' = soft-deleted desde el cliente
      .order("last_message_at", { ascending: false })
      .limit(MAX_LIST);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      conversations: (data || []).map((c) => ({
        id: c.id,
        title: c.title || autoTitle(c),
        language: c.language,
        status: c.status,
        messageCount: c.message_count || 0,
        startedAt: c.started_at,
        lastMessageAt: c.last_message_at,
        hasLead: !!c.lead_id,
      })),
    });
  } catch (err) {
    console.error("[chatbot/conversations GET]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const sb = createAdminClient();
    const body = await request.json();
    const visitor = await findVisitor(sb, body.visitorToken);
    if (!visitor) {
      return NextResponse.json(
        { ok: false, error: "Visitor no encontrado. Llama a /api/chatbot/visitor primero." },
        { status: 400 }
      );
    }

    const sessionId = generateSessionId();
    const { data, error } = await sb
      .from("chat_conversations")
      .insert({
        session_id: sessionId,
        visitor_id: visitor.id,
        language: body.language || visitor.preferred_language || "es",
        status: "active",
      })
      .select("id, session_id, language, status, started_at, last_message_at")
      .single();
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      conversation: {
        id: data.id,
        title: null,
        language: data.language,
        status: data.status,
        messageCount: 0,
        startedAt: data.started_at,
        lastMessageAt: data.last_message_at,
        hasLead: false,
      },
    });
  } catch (err) {
    console.error("[chatbot/conversations POST]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

function autoTitle(conv) {
  // Si no hay título, generar uno por fecha
  if (!conv.last_message_at) return "Nueva conversación";
  const d = new Date(conv.last_message_at);
  const today = new Date();
  const diffH = (today - d) / 1000 / 60 / 60;
  if (diffH < 24) return "Hoy " + d.toTimeString().slice(0, 5);
  if (diffH < 48) return "Ayer " + d.toTimeString().slice(0, 5);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
