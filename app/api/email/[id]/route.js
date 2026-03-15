/**
 * Single email API
 * GET    /api/email/[id] — get full email
 * PATCH  /api/email/[id] — update (read, starred, folder)
 * DELETE /api/email/[id] — move to trash or delete permanently
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const adminClient = createAdminClient();

    const { data: email, error } = await adminClient
      .from("emails")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !email) {
      return NextResponse.json({ error: "Email no encontrado" }, { status: 404 });
    }

    // Mark as read
    if (!email.is_read) {
      await adminClient
        .from("emails")
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq("id", id);
      email.is_read = true;
    }

    return NextResponse.json(email);
  } catch (error) {
    console.error("GET /api/email/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const adminClient = createAdminClient();

    const allowedFields = ["is_read", "is_starred", "folder"];
    const updates = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    const { data: updated, error } = await adminClient
      .from("emails")
      .update(updates)
      .eq("id", id)
      .select("id, is_read, is_starred, folder")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/email/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const adminClient = createAdminClient();

    // Check current folder
    const { data: email } = await adminClient
      .from("emails")
      .select("folder")
      .eq("id", id)
      .single();

    if (!email) {
      return NextResponse.json({ error: "Email no encontrado" }, { status: 404 });
    }

    if (email.folder === "trash") {
      // Permanently delete
      await adminClient.from("emails").delete().eq("id", id);
      return NextResponse.json({ deleted: true });
    }

    // Move to trash
    await adminClient
      .from("emails")
      .update({ folder: "trash", updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ trashed: true });
  } catch (error) {
    console.error("DELETE /api/email/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
