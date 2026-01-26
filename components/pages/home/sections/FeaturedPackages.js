import { SectionTitle } from "@/components/SectionTitle";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createAdminClient } from "@/lib/db/supabase/server";
import { PackageCard } from "@/components/pages/packages/components/PackageCard";

/**
 * FeaturedPackages - Paquetes Turísticos Destacados
 *
 * Muestra los paquetes turísticos destacados (is_featured=true) en la página principal
 * Obtiene datos directamente desde la base de datos
 */
export async function FeaturedPackages() {
  let packages = [];

  try {
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("service_inventory")
      .select(`
        *,
        provider:tourism_providers(id, name, slug, logo_url),
        destination:destinations(id, name, slug, image_url, country)
      `)
      .eq("product_type", "package")
      .eq("is_published", true)
      .eq("is_featured", true)
      .order("display_order", { ascending: true })
      .limit(6);

    if (error) {
      console.error("Error fetching featured packages:", error);
    } else {
      packages = data || [];
    }
  } catch (error) {
    console.error("Error loading featured packages:", error);
  }

  // Si no hay paquetes, no mostrar la sección
  if (packages.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto mb-[80px]">
      <div className="mb-[20px] flex items-center justify-between max-md:flex-col max-md:gap-[16px] md:mb-[40px]">
        <SectionTitle
          title="Paquetes Turísticos Destacados"
          subTitle="Descubre nuestros paquetes más populares con todo incluido"
        />
        <Button asChild variant="outline">
          <Link href="/packages">
            Ver todos los paquetes
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {packages.map((pkg) => (
          <PackageCard key={pkg.id} packageData={pkg} />
        ))}
      </div>
    </section>
  );
}

export default FeaturedPackages;
