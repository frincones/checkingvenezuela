import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/server";

// GET - Listar servicios
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

    let query = adminClient
      .from("catalog_services")
      .select("*")
      .order("display_order", { ascending: true });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching services:", error);
      if (error.code === "42P01") {
        return NextResponse.json({
          error: "Tablas CMS no encontradas. Ejecute la migración: supabase/migrations/003_cms_providers_inventory.sql",
          code: error.code
        }, { status: 503 });
      }
      return NextResponse.json({ error: "Error al obtener servicios" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Error in GET services:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// POST - Crear servicio
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const adminClient = createAdminClient();

    // Validaciones
    if (!body.name || !body.slug) {
      return NextResponse.json({ error: "Nombre y slug son requeridos" }, { status: 400 });
    }

    // Preparar datos
    const serviceData = {
      name: body.name,
      slug: body.slug,
      description: body.description || null,
      icon: body.icon || null,
      image_url: body.imageUrl || body.image_url || null,
      status: body.status || "active",
      has_online_purchase: body.hasOnlinePurchase ?? body.has_online_purchase ?? false,
      has_quote_request: body.hasQuoteRequest ?? body.has_quote_request ?? true,
      href: body.href || null,
      display_order: body.displayOrder ?? body.display_order ?? 0,
      metadata: body.metadata || {},
    };

    const { data, error } = await adminClient
      .from("catalog_services")
      .insert(serviceData)
      .select()
      .single();

    if (error) {
      console.error("Error creating service:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un servicio con ese slug" }, { status: 409 });
      }
      return NextResponse.json({ error: "Error al crear servicio" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Error in POST service:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
