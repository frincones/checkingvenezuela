/**
 * GET /api/crm/chatbot/conversations/[id]
 * Devuelve la conversación completa con todos sus mensajes.
 *
 * PATCH /api/crm/chatbot/conversations/[id]
 * Body: { advisor_notes?, status? }
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

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const adminClient = createAdminClient();

    const { data: conv, error: convErr } = await adminClient
      .from("chat_conversations")
      .select(
        `
        *,
        lead:leads(id, contact_name, contact_email, contact_phone, status, interest_type, advisor_id),
        profile:profiles(id, first_name, last_name, email)
      `
      )
      .eq("id", id)
      .maybeSingle();
    if (convErr) {
      if (convErr.code === "42P01" || convErr.code === "PGRST205") {
        return NextResponse.json({ error: "Migración 009 no aplicada" }, { status: 503 });
      }
      throw convErr;
    }
    if (!conv) {
      return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    }

    const { data: messages, error: msgErr } = await adminClient
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (msgErr) throw msgErr;

    return NextResponse.json({ conversation: conv, messages: messages || [] });
  } catch (err) {
    console.error("[crm/chatbot/conversations/[id] GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requireAuth();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const update = {};
    if (typeof body.status === "string") update.status = body.status;
    if (typeof body.advisor_notes === "string") {
      // Guardamos en metadata para no requerir nueva columna
      const adminClient = createAdminClient();
      const { data: cur } = await adminClient
        .from("chat_conversations")
        .select("metadata")
        .eq("id", id)
        .maybeSingle();
      update.metadata = {
        ...(cur?.metadata || {}),
        advisor_notes: body.advisor_notes,
        advisor_notes_updated_at: new Date().toISOString(),
        advisor_notes_by: auth.user.id,
      };
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("chat_conversations")
      .update(update)
      .eq("id", id)
      .select("id, status, metadata")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, conversation: data });
  } catch (err) {
    console.error("[crm/chatbot/conversations/[id] PATCH]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
