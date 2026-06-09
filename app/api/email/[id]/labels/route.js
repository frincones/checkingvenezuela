/**
 * GET  /api/email/[id]/labels                    — list labels on this email
 * POST /api/email/[id]/labels  { label_ids: [] } — replace the email's labels
 *                                                  with the given set (idempotent)
 */

import { createClient, createAdminClient } from "@/lib/db/supabase/server";
import { NextResponse } from "next/server";

export async function GET(_request, { params }) {
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
    const { data, error } = await admin
      .from("email_label_links")
      .select("label:email_labels(id, name, color)")
      .eq("email_id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      labels: (data || []).map((r) => r.label).filter(Boolean),
    });
  } catch (err) {
    console.error("GET labels error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
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
    const labelIds = Array.isArray(body.label_ids)
      ? body.label_ids.filter(Boolean)
      : [];

    const admin = createAdminClient();
    // Replace strategy: delete existing links then insert the new set.
    await admin.from("email_label_links").delete().eq("email_id", id);
    if (labelIds.length) {
      const rows = labelIds.map((lid) => ({ email_id: id, label_id: lid }));
      const { error: insErr } = await admin.from("email_label_links").insert(rows);
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }
    return NextResponse.json({ success: true, count: labelIds.length });
  } catch (err) {
    console.error("POST labels error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
