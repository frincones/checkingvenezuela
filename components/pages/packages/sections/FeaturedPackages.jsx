import { PackageCard } from "../components/PackageCard";
import { createAdminClient } from "@/lib/db/supabase/server";

async function getFeaturedPackages() {
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
      .limit(3);

    if (error) {
      console.error("Error fetching featured packages:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error in getFeaturedPackages:", err);
    return [];
  }
}

export async function FeaturedPackages() {
  const packages = await getFeaturedPackages();

  if (packages.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-secondary">
          Paquetes Destacados
        </h2>
        <p className="mt-2 text-gray-600">
          Las mejores experiencias seleccionadas para ti
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <PackageCard key={pkg.id} packageData={pkg} featured />
        ))}
      </div>
    </section>
  );
}
