import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/server";

// GET - Obtener un servicio por ID
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
      .from("catalog_services")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
      }
      return NextResponse.json({ error: "Error al obtener servicio" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in GET service:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// PATCH - Actualizar servicio
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

    // Campos permitidos para actualizar
    const allowedFields = [
      "name", "slug", "description", "icon", "image_url",
      "status", "has_online_purchase", "has_quote_request",
      "href", "display_order", "metadata"
    ];

    const updateData = {};
    for (const field of allowedFields) {
      // Manejar camelCase a snake_case
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
      .from("catalog_services")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating service:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un servicio con ese slug" }, { status: 409 });
      }
      return NextResponse.json({ error: "Error al actualizar servicio" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in PATCH service:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// DELETE - Eliminar servicio
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("catalog_services")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting service:", error);
      return NextResponse.json({ error: "Error al eliminar servicio" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE service:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
