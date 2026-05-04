/**
 * POST /api/chatbot/consent
 * Body: { visitorToken, accepted: boolean }
 * El usuario acepta o rechaza el consentimiento desde el ConsentDialog.
 * El consent vive a nivel del visitor (no por conversación), así que aplica
 * a todos los threads futuros del mismo visitor.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/server";
import { CONSENT_TEXT_VERSION } from "@/lib/ai/prompts/consent";

export async function POST(request) {
  try {
    const body = await request.json();
    const visitorToken = body.visitorToken;
    const accepted = !!body.accepted;

    if (!visitorToken) {
      return NextResponse.json(
        { ok: false, error: "visitorToken requerido" },
        { status: 400 }
      );
    }

    const sb = createAdminClient();
    const { data: visitor, error } = await sb
      .from("chat_visitors")
      .select("id, contact_captured")
      .eq("visitor_token", visitorToken)
      .maybeSingle();
    if (error) throw error;
    if (!visitor) {
      return NextResponse.json(
        { ok: false, error: "Visitor no encontrado" },
        { status: 404 }
      );
    }

    if (accepted) {
      const { error: updErr } = await sb
        .from("chat_visitors")
        .update({
          consent_accepted: true,
          consent_accepted_at: new Date().toISOString(),
          consent_text_version: CONSENT_TEXT_VERSION,
        })
        .eq("id", visitor.id);
      if (updErr) throw updErr;
    } else {
      // Rechazo: solo registramos en captured.consent_declined (no tocamos el flag)
      const captured = { ...(visitor.contact_captured || {}) };
      captured._consent_declined_at = new Date().toISOString();
      await sb.from("chat_visitors").update({ contact_captured: captured }).eq("id", visitor.id);
    }

    return NextResponse.json({ ok: true, accepted });
  } catch (err) {
    console.error("[chatbot/consent]", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
