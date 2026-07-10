/**
 * Email signatures API — scoped per user
 * GET  /api/email/signatures — list current user's signatures
 * POST /api/email/signatures — create signature for current user
 *
 * Row ownership is enforced both at the API layer (explicit user_id filter
 * on every query) and at the DB layer (RLS policies from migration
 * 20260710_email_signatures_user_scope.sql). Even the admin client uses the
 * filter so that a bug in this file cannot leak signatures across users.
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { data: signatures, error } = await adminClient
      .from("email_signatures")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ signatures: signatures || [] });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { name, body_html, is_default } = body;

    if (!name || !body_html) {
      return NextResponse.json(
        { error: "Nombre y contenido requeridos" },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();

    // If setting as default, clear the previous default for THIS user only.
    if (is_default) {
      await adminClient
        .from("email_signatures")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .eq("is_default", true);
    }

    const { data: sig, error } = await adminClient
      .from("email_signatures")
      .insert({
        user_id: user.id,
        name,
        body_html,
        is_default: is_default || false,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(sig, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
