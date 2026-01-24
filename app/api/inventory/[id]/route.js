import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/server";

// GET - Obtener un producto por ID
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
      .from("service_inventory")
      .select(`
        *,
        provider:tourism_providers(id, name, slug, type),
        service:catalog_services(id, name, slug),
        destination:destinations(id, name, slug, country),
        price_history:inventory_price_history(*)
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
      }
      return NextResponse.json({ error: "Error al obtener producto" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in GET inventory item:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// PATCH - Actualizar producto
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
      "provider_id", "service_id", "destination_id", "name", "sku",
      "description", "product_type", "cost_price", "sale_price", "currency",
      "pricing_details", "status", "quantity_available", "valid_from",
      "valid_until", "blackout_dates", "details", "images", "is_featured",
      "is_published", "display_order"
    ];

    const updateData = { updated_by: user.id };
    for (const field of allowedFields) {
      const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      } else if (body[camelField] !== undefined) {
        updateData[field] = body[camelField];
      }
    }

    if (Object.keys(updateData).length <= 1) {
      return NextResponse.json({ error: "No hay datos para actualizar" }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("service_inventory")
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        provider:tourism_providers(id, name, slug),
        service:catalog_services(id, name, slug),
        destination:destinations(id, name, slug)
      `)
      .single();

    if (error) {
      console.error("Error updating inventory item:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un producto con ese SKU" }, { status: 409 });
      }
      return NextResponse.json({ error: "Error al actualizar producto" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in PATCH inventory item:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// DELETE - Eliminar producto
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
      .from("service_inventory")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting inventory item:", error);
      return NextResponse.json({ error: "Error al eliminar producto" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE inventory item:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
