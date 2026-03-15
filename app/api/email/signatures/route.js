/**
 * Email signatures API
 * GET  /api/email/signatures — list signatures
 * POST /api/email/signatures — create signature
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { data: signatures, error } = await adminClient
      .from("email_signatures")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ signatures: signatures || [] });
  } catch (error) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { name, body_html, is_default } = body;

    if (!name || !body_html) {
      return NextResponse.json({ error: "Nombre y contenido requeridos" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // If setting as default, unset others
    if (is_default) {
      await adminClient.from("email_signatures").update({ is_default: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    }

    const { data: sig, error } = await adminClient
      .from("email_signatures")
      .insert({ name, body_html, is_default: is_default || false })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(sig, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
