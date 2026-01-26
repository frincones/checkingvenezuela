import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/server";

// GET - Obtener paquetes turísticos
export async function GET(request) {
  try {
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);

    const featured = searchParams.get("featured") === "true";
    const destination = searchParams.get("destination");
    const status = searchParams.get("status") || "available";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");

    let query = adminClient
      .from("service_inventory")
      .select(`
        *,
        provider:tourism_providers(id, name, slug, logo_url),
        destination:destinations(id, name, slug, image_url, country)
      `, { count: "exact" })
      .eq("product_type", "package")
      .eq("is_published", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (featured) {
      query = query.eq("is_featured", true);
    }

    if (destination) {
      query = query.eq("destination_id", destination);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching packages:", error);
      return NextResponse.json(
        { error: "Error al obtener paquetes", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error("Error in GET /api/packages:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
