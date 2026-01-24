import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/server";

// GET - Obtener una categoría por ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("destination_categories")
      .select("*, destinations(*)")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
      }
      return NextResponse.json({ error: "Error al obtener categoría" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in GET category:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// PATCH - Actualizar categoría
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const adminClient = createAdminClient();

    const allowedFields = ["name", "slug", "subtitle", "icon", "display_order", "is_active"];
    const updateData = {};

    for (const field of allowedFields) {
      const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      } else if (body[camelField] !== undefined) {
        updateData[field] = body[camelField];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No hay datos para actualizar" }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("destination_categories")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating category:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe una categoría con ese slug" }, { status: 409 });
      }
      return NextResponse.json({ error: "Error al actualizar categoría" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in PATCH category:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// DELETE - Eliminar categoría
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verificar si hay destinos asociados
    const { count } = await adminClient
      .from("destinations")
      .select("*", { count: "exact", head: true })
      .eq("category_id", id);

    if (count > 0) {
      return NextResponse.json({
        error: "No se puede eliminar la categoría porque tiene destinos asociados"
      }, { status: 400 });
    }

    const { error } = await adminClient
      .from("destination_categories")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting category:", error);
      return NextResponse.json({ error: "Error al eliminar categoría" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE category:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
