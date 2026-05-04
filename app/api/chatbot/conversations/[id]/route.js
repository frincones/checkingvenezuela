/**
 * GET    /api/chatbot/conversations/[id]?visitorToken=...
 *   Devuelve la conversación + mensajes para que el cliente la rehidrate
 *   en formato UIMessage. Verifica que el thread pertenezca al visitor.
 *
 * DELETE /api/chatbot/conversations/[id]?visitorToken=...
 *   Marca la conversación como deleted (soft delete). Solo si pertenece al visitor.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/server";

async function checkOwnership(sb, conversationId, visitorToken) {
  if (!visitorToken) return { error: "visitorToken requerido", status: 400 };
  const { data: visitor } = await sb
    .from("chat_visitors")
    .select("id")
    .eq("visitor_token", visitorToken)
    .maybeSingle();
  if (!visitor) return { error: "Visitor no encontrado", status: 404 };

  const { data: conv } = await sb
    .from("chat_conversations")
    .select(
      "id, visitor_id, session_id, title, language, status, message_count, total_tokens, started_at, last_message_at, lead_id"
    )
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return { error: "Conversación no encontrada", status: 404 };
  if (conv.visitor_id !== visitor.id) {
    return { error: "Conversación no pertenece a este visitor", status: 403 };
  }
  return { conv, visitor };
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const sb = createAdminClient();
    const { searchParams } = new URL(request.url);
    const visitorToken = searchParams.get("visitorToken");

    const check = await checkOwnership(sb, id, visitorToken);
    if (check.error) return NextResponse.json({ ok: false, error: check.error }, { status: check.status });

    // Cargar mensajes (omitimos role='system' / 'tool' para el cliente)
    const { data: messages, error } = await sb
      .from("chat_messages")
      .select("id, role, content, tool_calls, sources, created_at")
      .eq("conversation_id", id)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;

    // Convertir a formato UIMessage de AI SDK 6
    const uiMessages = (messages || []).map((m) => {
      const parts = [];
      // Tool calls del assistant (si los hay)
      if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          const toolName = tc.toolName || tc.name;
          if (!toolName) continue;
          parts.push({
            type: `tool-${toolName}`,
            toolCallId: tc.toolCallId || `legacy-${m.id}-${parts.length}`,
            state: "output-available",
            input: tc.input || {},
            output: tc.output || {},
          });
        }
      }
      if (m.content && m.content.length > 0) {
        parts.push({ type: "text", text: m.content });
      }
      return {
        id: m.id,
        role: m.role,
        parts,
      };
    });

    return NextResponse.json({
      ok: true,
      conversation: {
        id: check.conv.id,
        title: check.conv.title,
        language: check.conv.language,
        status: check.conv.status,
        messageCount: check.conv.message_count || 0,
        hasLead: !!check.conv.lead_id,
      },
      messages: uiMessages,
    });
  } catch (err) {
    console.error("[chatbot/conversations/[id] GET]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const sb = createAdminClient();
    const { searchParams } = new URL(request.url);
    const visitorToken = searchParams.get("visitorToken");

    const check = await checkOwnership(sb, id, visitorToken);
    if (check.error) return NextResponse.json({ ok: false, error: check.error }, { status: check.status });

    // Soft delete: status='closed' (oculta del cliente, sigue visible para admin)
    await sb
      .from("chat_conversations")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[chatbot/conversations/[id] DELETE]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
