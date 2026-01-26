import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/server";

// GET - Listar proveedores
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const activeOnly = searchParams.get("active") === "true";

    let query = adminClient
      .from("tourism_providers")
      .select("*")
      .order("name", { ascending: true });

    if (type) {
      query = query.eq("type", type);
    }

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching providers:", error);
      if (error.code === "42P01") {
        return NextResponse.json({
          error: "Tabla de proveedores no encontrada. Ejecute la migración.",
          code: error.code
        }, { status: 503 });
      }
      return NextResponse.json({ error: "Error al obtener proveedores" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Error in GET providers:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// POST - Crear proveedor
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
      return NextResponse.json({
        error: "Nombre y slug son requeridos"
      }, { status: 400 });
    }

    const providerData = {
      name: body.name,
      slug: body.slug,
      type: body.type || "tour_operator",
      description: body.description || null,
      logo_url: body.logoUrl || body.logo_url || null,
      contact_email: body.contactEmail || body.contact_email || null,
      contact_phone: body.contactPhone || body.contact_phone || null,
      website: body.website || null,
      address: body.address || null,
      services_offered: body.servicesOffered || body.services_offered || [],
      rating: body.rating || null,
      certifications: body.certifications || [],
      is_active: body.isActive ?? body.is_active ?? true,
      metadata: body.metadata || {},
    };

    const { data, error } = await adminClient
      .from("tourism_providers")
      .insert(providerData)
      .select()
      .single();

    if (error) {
      console.error("Error creating provider:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un proveedor con ese slug" }, { status: 409 });
      }
      return NextResponse.json({ error: "Error al crear proveedor" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Error in POST provider:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
