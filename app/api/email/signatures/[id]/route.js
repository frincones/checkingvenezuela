/**
 * Single signature API — scoped per user
 * PATCH  /api/email/signatures/[id] — update owner's signature
 * DELETE /api/email/signatures/[id] — delete owner's signature
 *
 * Ownership is verified twice on purpose:
 *   1. The API filters every mutation by user_id = auth.uid().
 *   2. RLS on the table (from migration 20260710_email_signatures_user_scope.sql)
 *      would block cross-user access even if the API filter regressed.
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const adminClient = createAdminClient();

    // If flipping to default, clear the previous default for THIS user only
    // (not the row we're about to update, and not anyone else's rows).
    if (body.is_default) {
      await adminClient
        .from("email_signatures")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .eq("is_default", true)
        .neq("id", id);
    }

    const updates = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.body_html !== undefined) updates.body_html = body.body_html;
    if (body.is_default !== undefined) updates.is_default = body.is_default;

    const { data, error } = await adminClient
      .from("email_signatures")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const adminClient = createAdminClient();
    await adminClient
      .from("email_signatures")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
