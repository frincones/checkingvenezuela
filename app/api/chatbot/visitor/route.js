/**
 * POST /api/chatbot/visitor
 * Bootstrap del visitor identity. Body: { visitorToken?: string, language?: 'es'|'en' }
 *
 * - Si llega visitorToken válido → busca/actualiza el visitor existente
 * - Si no llega o no existe en DB → crea uno nuevo
 *
 * Devuelve: { ok, visitorToken, visitorId, contactCaptured, consentAccepted, preferredLanguage }
 *
 * El cliente guarda visitorToken en localStorage (NO cookie httpOnly).
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/db/supabase/server";
import { generateSessionId, hashIp } from "@/lib/ai/utils";

export async function POST(request) {
  try {
    const headerStore = await headers();
    const sb = createAdminClient();

    let body = {};
    try {
      body = await request.json();
    } catch {}

    const ua = headerStore.get("user-agent") || "";
    const ip =
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerStore.get("x-real-ip") ||
      null;
    const ipHash = await hashIp(ip);

    let visitor = null;
    if (body.visitorToken && typeof body.visitorToken === "string") {
      const { data } = await sb
        .from("chat_visitors")
        .select(
          "id, visitor_token, contact_captured, consent_accepted, consent_accepted_at, preferred_language"
        )
        .eq("visitor_token", body.visitorToken)
        .maybeSingle();
      if (data) {
        visitor = data;
        // Refrescar last_seen
        await sb
          .from("chat_visitors")
          .update({
            last_seen_at: new Date().toISOString(),
            user_agent: ua || data.user_agent,
            ip_hash: ipHash || data.ip_hash,
            ...(body.language ? { preferred_language: body.language } : {}),
          })
          .eq("id", data.id);
      }
    }

    if (!visitor) {
      const newToken = generateSessionId();
      const { data: created, error } = await sb
        .from("chat_visitors")
        .insert({
          visitor_token: newToken,
          preferred_language: body.language || "es",
          user_agent: ua || null,
          ip_hash: ipHash || null,
        })
        .select(
          "id, visitor_token, contact_captured, consent_accepted, consent_accepted_at, preferred_language"
        )
        .single();
      if (error) throw error;
      visitor = created;
    }

    return NextResponse.json({
      ok: true,
      visitorId: visitor.id,
      visitorToken: visitor.visitor_token,
      contactCaptured: visitor.contact_captured || {},
      consentAccepted: !!visitor.consent_accepted,
      consentAcceptedAt: visitor.consent_accepted_at,
      preferredLanguage: visitor.preferred_language || "es",
    });
  } catch (err) {
    console.error("[chatbot/visitor]", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error bootstrap visitor" },
      { status: 500 }
    );
  }
}
