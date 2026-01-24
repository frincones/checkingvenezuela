import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/server";

// GET - Listar categorías
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    let query = adminClient
      .from("destination_categories")
      .select("*, destinations:destinations(count)")
      .order("display_order", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching categories:", error);
      if (error.code === "42P01") {
        return NextResponse.json({
          error: "Tablas CMS no encontradas. Ejecute la migración.",
          code: error.code
        }, { status: 503 });
      }
      return NextResponse.json({ error: "Error al obtener categorías" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Error in GET categories:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// POST - Crear categoría
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const adminClient = createAdminClient();

    if (!body.name || !body.slug) {
      return NextResponse.json({ error: "Nombre y slug son requeridos" }, { status: 400 });
    }

    const categoryData = {
      name: body.name,
      slug: body.slug,
      subtitle: body.subtitle || null,
      icon: body.icon || null,
      display_order: body.displayOrder ?? body.display_order ?? 0,
      is_active: body.isActive ?? body.is_active ?? true,
    };

    const { data, error } = await adminClient
      .from("destination_categories")
      .insert(categoryData)
      .select()
      .single();

    if (error) {
      console.error("Error creating category:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe una categoría con ese slug" }, { status: 409 });
      }
      return NextResponse.json({ error: "Error al crear categoría" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Error in POST category:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
