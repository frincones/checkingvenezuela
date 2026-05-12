/**
 * GET /api/email/[id]/attachments/[idx]
 *
 * Returns a short-lived signed URL (via 302 redirect) to download the
 * Nth attachment of an email row. Auth check is identical to the rest of
 * the email module (only `supabase.auth.getUser()` — no per-mailbox ACL),
 * keeping parity with /api/email/route.js and /api/email/[id]/route.js.
 *
 * Why redirect instead of streaming bytes:
 *   - Zero bandwidth on the Vercel function (Supabase CDN serves the file).
 *   - Signed URL TTL is 60s — leaked URLs are useless seconds later.
 *
 * Three error shapes:
 *   - 401 (unauthenticated)
 *   - 404 (email not found / index out of range)
 *   - 410 Gone (legacy attachment without storage_path — pre-fix rows that
 *     still point to cdn.resend.app and can't be served from our infra).
 *     The frontend should disable those links; this handler is the defense
 *     in depth for the case where the UI was bypassed.
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";
import { getInboundSignedUrl } from "@/lib/email/attachmentStorage";

const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(request, { params }) {
  try {
    // 1. Auth — matches the pattern used by /api/email/[id]
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Resolve params (Next 14 App Router: params is a Promise)
    const { id, idx } = await params;
    const index = Number.parseInt(idx, 10);
    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json(
        { error: "Índice de adjunto inválido" },
        { status: 400 }
      );
    }

    // 3. Load email row (admin client to bypass RLS — auth is enforced above)
    const admin = createAdminClient();
    const { data: email, error: loadErr } = await admin
      .from("emails")
      .select("id, attachments")
      .eq("id", id)
      .maybeSingle();

    if (loadErr) {
      console.error(
        "[email/attachment] load error",
        id,
        idx,
        loadErr.message
      );
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
    if (!email) {
      return NextResponse.json(
        { error: "Email no encontrado" },
        { status: 404 }
      );
    }

    const attachments = Array.isArray(email.attachments) ? email.attachments : [];
    const att = attachments[index];
    if (!att) {
      return NextResponse.json(
        { error: "Adjunto no encontrado" },
        { status: 404 }
      );
    }

    // 4. Legacy row without storage_path → can't serve from our infra.
    //    The UI disables the link, but defense in depth in case it's hit.
    if (!att.storage_path) {
      return NextResponse.json(
        {
          error:
            "Adjunto no disponible en nuestro almacenamiento (correo recibido antes de la migración).",
          legacy: true,
        },
        { status: 410 }
      );
    }

    // 5. Mint a signed URL and redirect. The browser follows the 302 and
    //    downloads directly from Supabase CDN — no bandwidth in our function.
    const signed = await getInboundSignedUrl(
      att.storage_path,
      SIGNED_URL_TTL_SECONDS,
      att.filename || undefined
    );
    if (!signed) {
      console.error(
        "[email/attachment] signed URL failed for",
        att.storage_path
      );
      return NextResponse.json(
        { error: "No se pudo generar enlace de descarga" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(signed, 302);
  } catch (err) {
    console.error("GET /api/email/[id]/attachments/[idx] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
