import { NextResponse } from "next/server";
import { findPackageBySlug } from "@/lib/packages/slug";

// GET - Obtener paquete por slug
export async function GET(request, { params }) {
  try {
    const { slug } = await params;

    const data = await findPackageBySlug(slug, {
      select: `
        *,
        provider:tourism_providers(id, name, slug, logo_url, contact_email, contact_phone),
        destination:destinations(id, name, slug, image_url, country, city)
      `,
    });

    if (!data) {
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
