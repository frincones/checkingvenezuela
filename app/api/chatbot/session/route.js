/**
 * POST /api/chatbot/session
 * Crea (o reutiliza) una conversación. Setea cookie httpOnly con session_id.
 *
 * GET /api/chatbot/session
 * Devuelve estado actual de la sesión (consent, lead vinculado, etc.).
 */

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { generateSessionId, hashIp } from "@/lib/ai/utils";

const COOKIE_NAME = "vv_chat_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

async function getOrCreateConversation({ sessionId, profileId, userAgent, ipHash, language }) {
  const sb = createAdminClient();

  // Buscar existente por session_id
  const { data: existing } = await sb
    .from("chat_conversations")
    .select("id, session_id, language, consent_accepted, lead_id, status, contact_captured")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existing) {
    // Si está closed, reactivar
    if (existing.status === "closed") {
      await sb
        .from("chat_conversations")
        .update({ status: "active", last_message_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
    return existing;
  }

  const { data: created, error } = await sb
    .from("chat_conversations")
    .insert({
      session_id: sessionId,
      profile_id: profileId || null,
      language: language || "es",
      status: "active",
      user_agent: userAgent || null,
      ip_hash: ipHash || null,
    })
    .select("id, session_id, language, consent_accepted, lead_id, status, contact_captured")
    .single();
  if (error) throw error;
  return created;
}

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const headerStore = await headers();
    const supabase = await createClient();

    let sessionId = cookieStore.get(COOKIE_NAME)?.value;
    if (!sessionId) sessionId = generateSessionId();

    // Auth opcional
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const ua = headerStore.get("user-agent") || "";
    const ip =
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerStore.get("x-real-ip") ||
      null;
    const ipHash = await hashIp(ip);

    let body = {};
    try {
      body = await request.json();
    } catch {
      // body vacío OK
    }

    const conv = await getOrCreateConversation({
      sessionId,
      profileId: user?.id || null,
      userAgent: ua,
      ipHash,
      language: body.language || "es",
    });

    const res = NextResponse.json({
      ok: true,
      conversationId: conv.id,
      sessionId: conv.session_id,
      language: conv.language,
      consentAccepted: conv.consent_accepted,
      leadId: conv.lead_id,
      contactCaptured: conv.contact_captured || {},
    });

    res.cookies.set(COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return res;
  } catch (err) {
    console.error("[chatbot/session POST]", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error creando sesión" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chatbot/session
 * Cierra la conversación actual y borra la cookie. Si hay datos capturados
 * sin lead creado, los descarta. Útil para "Nueva conversación".
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(COOKIE_NAME)?.value;
    if (sessionId) {
      const sb = createAdminClient();
      // Marcar la conversación como cerrada (mantenemos el historial)
      await sb
        .from("chat_conversations")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("session_id", sessionId);
    }
    const res = NextResponse.json({ ok: true });
    // Borra la cookie en el navegador
    res.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("[chatbot/session DELETE]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(COOKIE_NAME)?.value;
    if (!sessionId) return NextResponse.json({ ok: true, exists: false });

    const sb = createAdminClient();
    const { data, error } = await sb
      .from("chat_conversations")
      .select("id, language, consent_accepted, lead_id, status, contact_captured, message_count")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ ok: true, exists: false });

    return NextResponse.json({
      ok: true,
      exists: true,
      conversationId: data.id,
      language: data.language,
      consentAccepted: data.consent_accepted,
      leadId: data.lead_id,
      status: data.status,
      contactCaptured: data.contact_captured || {},
      messageCount: data.message_count,
    });
  } catch (err) {
    console.error("[chatbot/session GET]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
