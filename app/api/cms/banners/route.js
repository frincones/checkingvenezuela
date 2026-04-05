import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/db/supabase/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active");
    const position = searchParams.get("position");
    const limit = parseInt(searchParams.get("limit") || "50");

    const admin = createAdminClient();
    let query = admin
      .from("banners")
      .select("*")
      .order("display_order", { ascending: true })
      .limit(limit);

    if (active === "true") {
      const now = new Date().toISOString();
      query = query
        .eq("is_active", true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`);
    }

    if (position) query = query.eq("position", position);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("banners")
      .insert({
        title: body.title,
        subtitle: body.subtitle || null,
        image_url: body.image_url || null,
        link_url: body.link_url || null,
        link_label: body.link_label || "Ver más",
        badge_text: body.badge_text || null,
        position: body.position || "hero",
        background_color: body.background_color || "#0A1A44",
        display_order: body.display_order || 0,
        is_active: body.is_active !== undefined ? body.is_active : true,
        starts_at: body.starts_at || null,
        ends_at: body.ends_at || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
