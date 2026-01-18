import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/server";

// GET - Listar inventario
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
    const productType = searchParams.get("type") || searchParams.get("product_type");
    const providerId = searchParams.get("providerId") || searchParams.get("provider_id");
    const destinationId = searchParams.get("destinationId") || searchParams.get("destination_id");
    const featured = searchParams.get("featured") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    let query = adminClient
      .from("service_inventory")
      .select(`
        *,
        provider:tourism_providers(id, name, slug),
        service:catalog_services(id, name, slug),
        destination:destinations(id, name, slug)
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    if (productType) {
      query = query.eq("product_type", productType);
    }

    if (providerId) {
      query = query.eq("provider_id", providerId);
    }

    if (destinationId) {
      query = query.eq("destination_id", destinationId);
    }

    if (featured) {
      query = query.eq("is_featured", true);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching inventory:", error);
      if (error.code === "42P01") {
        return NextResponse.json({
          error: "Tablas de inventario no encontradas. Ejecute la migración.",
          code: error.code
        }, { status: 503 });
      }
      return NextResponse.json({ error: "Error al obtener inventario" }, { status: 500 });
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
    console.error("Error in GET inventory:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// POST - Crear producto en inventario
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const adminClient = createAdminClient();

    if (!body.name || !body.productType) {
      return NextResponse.json({ error: "Nombre y tipo de producto son requeridos" }, { status: 400 });
    }

    const inventoryData = {
      provider_id: body.providerId || body.provider_id || null,
      service_id: body.serviceId || body.service_id || null,
      destination_id: body.destinationId || body.destination_id || null,
      name: body.name,
      sku: body.sku || null,
      description: body.description || null,
      product_type: body.productType || body.product_type,
      cost_price: body.costPrice ?? body.cost_price ?? null,
      sale_price: body.salePrice ?? body.sale_price ?? null,
      currency: body.currency || "USD",
      pricing_details: body.pricingDetails || body.pricing_details || null,
      status: body.status || "available",
      quantity_available: body.quantityAvailable ?? body.quantity_available ?? null,
      valid_from: body.validFrom || body.valid_from || null,
      valid_until: body.validUntil || body.valid_until || null,
      blackout_dates: body.blackoutDates || body.blackout_dates || [],
      details: body.details || {},
      images: body.images || [],
      is_featured: body.isFeatured ?? body.is_featured ?? false,
      is_published: body.isPublished ?? body.is_published ?? true,
      display_order: body.displayOrder ?? body.display_order ?? 0,
      created_by: user.id,
      updated_by: user.id,
    };

    const { data, error } = await adminClient
      .from("service_inventory")
      .insert(inventoryData)
      .select(`
        *,
        provider:tourism_providers(id, name, slug),
        service:catalog_services(id, name, slug),
        destination:destinations(id, name, slug)
      `)
      .single();

    if (error) {
      console.error("Error creating inventory item:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un producto con ese SKU" }, { status: 409 });
      }
      return NextResponse.json({ error: "Error al crear producto" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Error in POST inventory:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
