import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/db/supabase/server";

// Normaliza el slug para evitar tildes, mayúsculas o caracteres especiales
// que rompen el routing (ej: `/blog/guía-Mérida` → 404 por mismatch de encoding).
function normalizeSlug(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50");

    const admin = createAdminClient();
    let query = admin.from("blog_posts").select("*, destination:destinations(id, name, slug)").order("created_at", { ascending: false }).limit(limit);

    if (status) query = query.eq("status", status);
    if (category) query = query.eq("category", category);

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

    // Defensa en profundidad: aunque el form genera slug automáticamente,
    // aquí nos aseguramos que nunca entren tildes/mayúsculas a la DB.
    const normalizedSlug = normalizeSlug(body.slug || body.title);
    if (!normalizedSlug) {
      return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("blog_posts")
      .insert({
        title: body.title,
        slug: normalizedSlug,
        excerpt: body.excerpt || null,
        content: body.content || "",
        cover_image: body.cover_image || null,
        category: body.category || "general",
        tags: body.tags || [],
        author_name: body.author_name || null,
        destination_id: body.destination_id || null,
        status: body.status || "draft",
        published_at: body.status === "published" ? new Date().toISOString() : null,
        meta_title: body.meta_title || null,
        meta_description: body.meta_description || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Ya existe un post con ese slug" }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
