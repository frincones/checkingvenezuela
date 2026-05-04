/**
 * POST /api/chatbot/session
 *   Body: { visitorToken, language? }
 *   Devuelve la conversación activa del visitor (la más reciente NO closed)
 *   o crea una nueva si no hay ninguna utilizable.
 *
 * GET /api/chatbot/session?visitorToken=...
 *   Devuelve estado de la conversación activa.
 *
 * Nota: ya NO usamos cookie httpOnly. La identidad vive en localStorage
 * del cliente (visitorToken). Cada conversación es un thread distinto
 * — el cliente decide cuál abrir vía el sidebar.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/server";
import { generateSessionId } from "@/lib/ai/utils";

const IDLE_TO_CLOSED_MS = 24 * 60 * 60 * 1000; // 24h sin actividad → idle se vuelve closed

async function findVisitor(sb, visitorToken) {
  if (!visitorToken) return null;
  const { data } = await sb
    .from("chat_visitors")
    .select("id, preferred_language, contact_captured, consent_accepted")
    .eq("visitor_token", visitorToken)
    .maybeSingle();
  return data;
}

async function getActiveConversation(sb, visitorId, preferredLang) {
  // Buscar la conversación más reciente del visitor que NO esté closed
  const { data: existing } = await sb
    .from("chat_conversations")
    .select("id, session_id, language, status, message_count, lead_id, last_message_at, contact_captured")
    .eq("visitor_id", visitorId)
    .neq("status", "closed")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Si llevaba >24h idle, marcarla como closed y crear nueva
    const idleMs = existing.last_message_at
      ? Date.now() - new Date(existing.last_message_at).getTime()
      : 0;
    if (idleMs > IDLE_TO_CLOSED_MS) {
      await sb
        .from("chat_conversations")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      return existing;
    }
  }

  // Crear nueva conversación
  const sessionId = generateSessionId();
  const { data: created, error } = await sb
    .from("chat_conversations")
    .insert({
      session_id: sessionId,
      visitor_id: visitorId,
      language: preferredLang || "es",
      status: "active",
    })
    .select("id, session_id, language, status, message_count, lead_id, contact_captured")
    .single();
  if (error) throw error;
  return created;
}

export async function POST(request) {
  try {
    const sb = createAdminClient();
    const body = await request.json().catch(() => ({}));
    const visitor = await findVisitor(sb, body.visitorToken);
    if (!visitor) {
      return NextResponse.json(
        {
          ok: false,
          error: "Visitor no encontrado. Llama a /api/chatbot/visitor primero.",
        },
        { status: 400 }
      );
    }

    const conv = await getActiveConversation(
      sb,
      visitor.id,
      body.language || visitor.preferred_language
    );

    return NextResponse.json({
      ok: true,
      conversationId: conv.id,
      language: conv.language,
      status: conv.status,
      messageCount: conv.message_count || 0,
      hasLead: !!conv.lead_id,
      // Datos del visitor (NO de la conversación) — para el cliente saber
      // si ya tiene PII guardada (no para mostrarla pero sí para skip
      // captura repetida)
      contactCaptured: visitor.contact_captured || {},
      consentAccepted: !!visitor.consent_accepted,
    });
  } catch (err) {
    console.error("[chatbot/session POST]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const sb = createAdminClient();
    const { searchParams } = new URL(request.url);
    const visitorToken = searchParams.get("visitorToken");
    const visitor = await findVisitor(sb, visitorToken);
    if (!visitor) return NextResponse.json({ ok: true, exists: false });

    const { data: conv } = await sb
      .from("chat_conversations")
      .select("id, language, status, message_count, lead_id")
      .eq("visitor_id", visitor.id)
      .neq("status", "closed")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conv) return NextResponse.json({ ok: true, exists: false });

    return NextResponse.json({
      ok: true,
      exists: true,
      conversationId: conv.id,
      language: conv.language,
      status: conv.status,
      messageCount: conv.message_count,
      hasLead: !!conv.lead_id,
      contactCaptured: visitor.contact_captured || {},
      consentAccepted: !!visitor.consent_accepted,
    });
  } catch (err) {
    console.error("[chatbot/session GET]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
