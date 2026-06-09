/**
 * PATCH  /api/email/labels/[id]  — rename / recolor
 * DELETE /api/email/labels/[id]  — remove (cascade removes links)
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
    const patch = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.color === "string") patch.color = body.color;
    if (Number.isInteger(body.display_order)) patch.display_order = body.display_order;

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("email_labels")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe una etiqueta con ese nombre" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ label: data });
  } catch (err) {
    console.error("PATCH /api/email/labels/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
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
    const admin = createAdminClient();
    const { error } = await admin.from("email_labels").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/email/labels/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
