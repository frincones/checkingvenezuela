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

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("blog_posts")
      .select("*, destination:destinations(id, name, slug)")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: "Post no encontrado" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const admin = createAdminClient();

    const allowedFields = [
      "title", "slug", "excerpt", "content", "cover_image", "category",
      "tags", "author_name", "destination_id", "status", "published_at",
      "meta_title", "meta_description",
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    // Normalizar slug si viene en el payload para evitar tildes/mayúsculas
    if (updateData.slug !== undefined) {
      const normalized = normalizeSlug(updateData.slug);
      if (!normalized) {
        return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
      }
      updateData.slug = normalized;
    }

    if (body.status === "published" && !body.published_at) {
      updateData.published_at = new Date().toISOString();
    }
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await admin
      .from("blog_posts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Ya existe un post con ese slug" }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createAdminClient();
    const { error } = await admin.from("blog_posts").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
