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
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    let query = adminClient
      .from("tourism_providers")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    if (type) {
      query = query.eq("type", type);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching providers:", error);
      if (error.code === "42P01") {
        return NextResponse.json({
          error: "Tablas de proveedores no encontradas. Ejecute la migración.",
          code: error.code
        }, { status: 503 });
      }
      return NextResponse.json({ error: "Error al obtener proveedores" }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    });
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

    if (!body.name || !body.type) {
      return NextResponse.json({ error: "Nombre y tipo son requeridos" }, { status: 400 });
    }

    // Generar slug si no viene
    const slug = body.slug || body.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const providerData = {
      name: body.name,
      slug: slug,
      type: body.type,
      logo_url: body.logoUrl || body.logo_url || null,
      description: body.description || null,
      contact_name: body.contactName || body.contact_name || null,
      contact_email: body.contactEmail || body.contact_email || null,
      contact_phone: body.contactPhone || body.contact_phone || null,
      website: body.website || null,
      country: body.country || null,
      city: body.city || null,
      address: body.address || null,
      tax_id: body.taxId || body.tax_id || null,
      commission_rate: body.commissionRate || body.commission_rate || null,
      payment_terms: body.paymentTerms || body.payment_terms || null,
      currency: body.currency || "USD",
      api_enabled: body.apiEnabled ?? body.api_enabled ?? false,
      api_credentials: body.apiCredentials || body.api_credentials || null,
      status: body.status || "pending_approval",
      services_offered: body.servicesOffered || body.services_offered || [],
      destinations_covered: body.destinationsCovered || body.destinations_covered || [],
      rating: body.rating || null,
      notes: body.notes || null,
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
