/**
 * GET    /api/email/labels       — list labels
 * POST   /api/email/labels       — create label { name, color, display_order }
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

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("email_labels")
      .select("id, name, color, display_order")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ labels: data || [] });
  } catch (err) {
    console.error("GET /api/email/labels error:", err);
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
    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }
    if (name.length > 60) {
      return NextResponse.json(
        { error: "Nombre demasiado largo (máx 60)" },
        { status: 400 }
      );
    }
    const color = body.color || "#0A1A44";
    const display_order = Number.isInteger(body.display_order) ? body.display_order : 0;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("email_labels")
      .insert({ name, color, display_order })
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
    return NextResponse.json({ label: data }, { status: 201 });
  } catch (err) {
    console.error("POST /api/email/labels error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
