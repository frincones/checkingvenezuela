/**
 * Single signature API
 * PATCH  /api/email/signatures/[id] — update
 * DELETE /api/email/signatures/[id] — delete
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const adminClient = createAdminClient();

    if (body.is_default) {
      await adminClient.from("email_signatures").update({ is_default: false }).neq("id", id);
    }

    const updates = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.body_html !== undefined) updates.body_html = body.body_html;
    if (body.is_default !== undefined) updates.is_default = body.is_default;

    const { data, error } = await adminClient
      .from("email_signatures")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const adminClient = createAdminClient();
    await adminClient.from("email_signatures").delete().eq("id", id);
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
