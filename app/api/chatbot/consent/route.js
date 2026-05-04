/**
 * POST /api/chatbot/consent
 * Body: { accepted: boolean }
 * El usuario acepta o rechaza el consentimiento desde el ConsentDialog del widget.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/db/supabase/server";
import { CONSENT_TEXT_VERSION } from "@/lib/ai/prompts/consent";

const COOKIE_NAME = "vv_chat_session";

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(COOKIE_NAME)?.value;
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "Sin sesión activa" }, { status: 400 });
    }

    const body = await request.json();
    const accepted = !!body.accepted;

    const sb = createAdminClient();
    const { data: conv, error } = await sb
      .from("chat_conversations")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!conv) {
      return NextResponse.json({ ok: false, error: "Conversación no encontrada" }, { status: 404 });
    }

    const update = accepted
      ? {
          consent_accepted: true,
          consent_accepted_at: new Date().toISOString(),
          consent_text_version: CONSENT_TEXT_VERSION,
        }
      : {
          consent_accepted: false,
          metadata: {
            consent_declined_at: new Date().toISOString(),
          },
        };

    const { error: updErr } = await sb.from("chat_conversations").update(update).eq("id", conv.id);
    if (updErr) throw updErr;

    return NextResponse.json({ ok: true, conversationId: conv.id, accepted });
  } catch (err) {
    console.error("[chatbot/consent]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
