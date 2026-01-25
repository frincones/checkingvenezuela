import { PackageCard } from "../components/PackageCard";
import { createAdminClient } from "@/lib/db/supabase/server";

async function getAllPackages() {
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
      .eq("status", "available")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      console.error("Error fetching packages:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error in getAllPackages:", err);
    return [];
  }
}

export async function PackagesList() {
  const packages = await getAllPackages();

  if (packages.length === 0) {
    return (
      <section className="py-20 text-center">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-6xl">📦</div>
          <h3 className="mb-2 text-2xl font-bold text-gray-900">
            Próximamente
          </h3>
          <p className="text-gray-600">
            Estamos preparando increíbles paquetes turísticos para ti.
            ¡Vuelve pronto!
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-secondary">
          Todos los Paquetes
        </h2>
        <p className="mt-2 text-gray-600">
          Explora todas nuestras opciones de viaje
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <PackageCard key={pkg.id} packageData={pkg} />
        ))}
      </div>
    </section>
  );
}
