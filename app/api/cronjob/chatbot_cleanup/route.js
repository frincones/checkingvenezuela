/**
 * GET /api/cronjob/chatbot_cleanup
 *
 * Limpieza periódica del chatbot:
 *  - Cierra conversaciones inactivas (sin mensajes en 24h) → status='idle'
 *  - Cierra conversaciones idle por más de 7 días → status='closed'
 *  - Borra conversaciones anónimas SIN lead más viejas de 30 días (GDPR-friendly)
 *
 * Configurar en vercel.json o cron de Vercel:
 *   { "path": "/api/cronjob/chatbot_cleanup", "schedule": "0 4 * * *" }
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/server";

export async function GET(req) {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "401" }, { status: 401 });
  }

  const sb = createAdminClient();
  const now = new Date();
  const idleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const closeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const purgeThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const result = { idle: 0, closed: 0, purged: 0, errors: [] };

  try {
    // 1. Marcar idle
    const { data: idleRows, error: idleErr } = await sb
      .from("chat_conversations")
      .update({ status: "idle" })
      .eq("status", "active")
      .lt("last_message_at", idleThreshold)
      .select("id");
    if (idleErr) result.errors.push(`idle: ${idleErr.message}`);
    else result.idle = idleRows?.length || 0;

    // 2. Marcar closed
    const { data: closedRows, error: closedErr } = await sb
      .from("chat_conversations")
      .update({ status: "closed", closed_at: now.toISOString() })
      .eq("status", "idle")
      .lt("last_message_at", closeThreshold)
      .select("id");
    if (closedErr) result.errors.push(`closed: ${closedErr.message}`);
    else result.closed = closedRows?.length || 0;

    // 3. Purgar conversaciones anónimas sin lead viejas (GDPR)
    const { data: purgedRows, error: purgeErr } = await sb
      .from("chat_conversations")
      .delete()
      .is("lead_id", null)
      .is("profile_id", null)
      .lt("started_at", purgeThreshold)
      .select("id");
    if (purgeErr) result.errors.push(`purge: ${purgeErr.message}`);
    else result.purged = purgedRows?.length || 0;

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cronjob/chatbot_cleanup]", err);
    return NextResponse.json({ ok: false, error: err.message, ...result }, { status: 500 });
  }
}
