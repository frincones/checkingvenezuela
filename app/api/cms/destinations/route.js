import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/server";

// GET - Listar destinos
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId") || searchParams.get("category_id");
    const destinationType = searchParams.get("type") || searchParams.get("destination_type");
    const activeOnly = searchParams.get("active") === "true";
    const featured = searchParams.get("featured") === "true";

    let query = adminClient
      .from("destinations")
      .select("*, category:destination_categories(id, name, slug)")
      .order("display_order", { ascending: true });

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    if (destinationType) {
      query = query.eq("destination_type", destinationType);
    }

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    if (featured) {
      query = query.eq("is_featured", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching destinations:", error);
      if (error.code === "42P01") {
        return NextResponse.json({
          error: "Tablas CMS no encontradas. Ejecute la migración.",
          code: error.code
        }, { status: 503 });
      }
      return NextResponse.json({ error: "Error al obtener destinos" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Error in GET destinations:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// POST - Crear destino
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const adminClient = createAdminClient();

    if (!body.name || !body.slug || !body.destinationType) {
      return NextResponse.json({
        error: "Nombre, slug y tipo de destino son requeridos"
      }, { status: 400 });
    }

    const destinationData = {
      category_id: body.categoryId || body.category_id || null,
      destination_type: body.destinationType || body.destination_type,
      name: body.name,
      slug: body.slug,
      description: body.description || null,
      short_description: body.shortDescription || body.short_description || null,
      country: body.country || null,
      city: body.city || null,
      airport_code: body.airportCode || body.airport_code || null,
      hotel_type: body.hotelType || body.hotel_type || null,
      image_url: body.imageUrl || body.image_url || null,
      gallery: body.gallery || [],
      tags: body.tags || [],
      highlights: body.highlights || [],
      coordinates: body.coordinates || null,
      pricing: body.pricing || null,
      has_online_search: body.hasOnlineSearch ?? body.has_online_search ?? false,
      has_quote_request: body.hasQuoteRequest ?? body.has_quote_request ?? true,
      search_href: body.searchHref || body.search_href || null,
      display_order: body.displayOrder ?? body.display_order ?? 0,
      is_featured: body.isFeatured ?? body.is_featured ?? false,
      is_active: body.isActive ?? body.is_active ?? true,
      metadata: body.metadata || {},
    };

    const { data, error } = await adminClient
      .from("destinations")
      .insert(destinationData)
      .select("*, category:destination_categories(id, name, slug)")
      .single();

    if (error) {
      console.error("Error creating destination:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un destino con ese slug" }, { status: 409 });
      }
      return NextResponse.json({ error: "Error al crear destino" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Error in POST destination:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
