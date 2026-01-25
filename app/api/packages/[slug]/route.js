import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase/server";

// GET - Obtener paquete por slug
export async function GET(request, { params }) {
  try {
    const adminClient = createAdminClient();
    const slug = params.slug;

    const { data, error } = await adminClient
      .from("service_inventory")
      .select(`
        *,
        provider:tourism_providers(id, name, slug, logo_url, contact_email, contact_phone),
        destination:destinations(id, name, slug, image_url, country, city)
      `)
      .eq("product_type", "package")
      .eq("is_published", true)
      .ilike("name", `%${slug.split('-').join(' ')}%`)
      .single();

    if (error) {
      console.error("Error fetching package:", error);
      return NextResponse.json(
        { error: "Paquete no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Error in GET /api/packages/[slug]:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
