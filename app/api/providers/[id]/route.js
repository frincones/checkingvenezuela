import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/server";

// GET - Obtener un proveedor por ID
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
      .from("tourism_providers")
      .select("*, contracts:provider_contracts(*)")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
      }
      return NextResponse.json({ error: "Error al obtener proveedor" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in GET provider:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// PATCH - Actualizar proveedor
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
      "name", "slug", "type", "logo_url", "description",
      "contact_name", "contact_email", "contact_phone", "website",
      "country", "city", "address", "tax_id", "commission_rate",
      "payment_terms", "currency", "api_enabled", "api_credentials",
      "status", "services_offered", "destinations_covered", "rating", "notes"
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

    // Si se aprueba el proveedor, agregar fecha de verificación
    if (updateData.status === "active" && body.approve) {
      updateData.verified_at = new Date().toISOString();
      updateData.verified_by = user.id;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No hay datos para actualizar" }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("tourism_providers")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating provider:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un proveedor con ese slug" }, { status: 409 });
      }
      return NextResponse.json({ error: "Error al actualizar proveedor" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in PATCH provider:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// DELETE - Eliminar proveedor
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verificar si hay inventario asociado
    const { count } = await adminClient
      .from("service_inventory")
      .select("*", { count: "exact", head: true })
      .eq("provider_id", id);

    if (count > 0) {
      return NextResponse.json({
        error: "No se puede eliminar el proveedor porque tiene productos en inventario"
      }, { status: 400 });
    }

    const { error } = await adminClient
      .from("tourism_providers")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting provider:", error);
      return NextResponse.json({ error: "Error al eliminar proveedor" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE provider:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
