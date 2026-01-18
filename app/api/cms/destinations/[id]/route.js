import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/server";

// GET - Obtener un destino por ID
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
      .from("destinations")
      .select("*, category:destination_categories(id, name, slug)")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Destino no encontrado" }, { status: 404 });
      }
      return NextResponse.json({ error: "Error al obtener destino" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in GET destination:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// PATCH - Actualizar destino
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

    const allowedFields = [
      "category_id", "destination_type", "name", "slug", "description",
      "short_description", "country", "city", "airport_code", "hotel_type",
      "image_url", "gallery", "tags", "highlights", "coordinates", "pricing",
      "has_online_search", "has_quote_request", "search_href", "display_order",
      "is_featured", "is_active", "metadata"
    ];

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
      .from("destinations")
      .update(updateData)
      .eq("id", id)
      .select("*, category:destination_categories(id, name, slug)")
      .single();

    if (error) {
      console.error("Error updating destination:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un destino con ese slug" }, { status: 409 });
      }
      return NextResponse.json({ error: "Error al actualizar destino" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in PATCH destination:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// DELETE - Eliminar destino
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
      .from("destinations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting destination:", error);
      return NextResponse.json({ error: "Error al eliminar destino" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE destination:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
