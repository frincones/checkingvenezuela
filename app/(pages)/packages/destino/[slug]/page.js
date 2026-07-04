import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { BreadcrumbUI } from "@/components/local-ui/breadcrumb";
import ShareButtons from "@/components/local-ui/ShareButtons";
import { Button } from "@/components/ui/button";
import { PackageCard } from "@/components/pages/packages/components/PackageCard";
import { createAdminClient } from "@/lib/db/supabase/server";
import { canonicalUrl } from "@/lib/utils/canonicalUrl";
import { MapPin, Package, ArrowLeft } from "lucide-react";

async function getDestinationBySlug(slug) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("destinations")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    console.error("Error fetching destination:", error);
    return null;
  }

  return data;
}

async function getPackagesByDestination(destinationId) {
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
    .eq("destination_id", destinationId)
    .neq("status", "discontinued")
    .order("is_featured", { ascending: false })
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching packages for destination:", error);
    return [];
  }

  return data || [];
}

export async function generateMetadata({ params }) {
  const destination = await getDestinationBySlug(params.slug);

  if (!destination) {
    return { title: "Destino no encontrado" };
  }

  return {
    title: `Paquetes en ${destination.name} | Venezuela Voyages`,
    description:
      destination.short_description ||
      `Descubre los mejores paquetes turísticos disponibles en ${destination.name}. Vuelo + hotel + actividades todo incluido.`,
    keywords: ["paquetes", destination.name, destination.country, "venezuela voyages", "todo incluido"].filter(Boolean),
    openGraph: {
      title: `Paquetes en ${destination.name} | Venezuela Voyages`,
      description: destination.short_description || `Paquetes turísticos en ${destination.name}`,
      images: destination.image_url ? [destination.image_url] : [],
      locale: "es_VE",
    },
  };
}

export default async function PackagesByDestinationPage({ params }) {
  const destination = await getDestinationBySlug(params.slug);

  if (!destination) {
    return notFound();
  }

  const packages = await getPackagesByDestination(destination.id);

  const heroImage =
    destination.image_url ||
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop";

  return (
    <>
      {/* Hero Header */}
      <header className="relative">
        <section className="relative flex h-[400px] items-end overflow-hidden bg-primary sm:h-[450px]">
          <Image
            src={heroImage}
            alt={destination.name}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

          <div className="relative z-10 w-full px-[5%] pb-10 text-white">
            <div className="mb-4 flex items-center gap-3">
              <Package className="h-8 w-8 sm:h-10 sm:w-10" />
              <span className="text-sm font-semibold uppercase tracking-wider">
                Paquetes Turísticos
              </span>
            </div>

            <h1 className="mb-3 text-3xl font-bold sm:text-4xl lg:text-5xl">
              Paquetes en {destination.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm sm:text-base">
              {destination.country && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {destination.name}, {destination.country}
                  </span>
                </div>
              )}
              <div className="rounded-full bg-white/20 px-4 py-1 backdrop-blur-sm">
                {packages.length}{" "}
                {packages.length === 1 ? "paquete disponible" : "paquetes disponibles"}
              </div>
            </div>
          </div>
        </section>
      </header>

      {/* Content */}
      <main className="mx-auto mb-10 w-[90%] md:mb-20">
        {/* Breadcrumb + Share + Back */}
        <div className="my-6 flex flex-wrap items-center justify-between gap-4">
          <BreadcrumbUI />
          <div className="flex flex-wrap items-center gap-3">
            <ShareButtons
              title={`Paquetes en ${destination.name}`}
              url={canonicalUrl(`/packages/destino/${destination.slug}`)}
            />
            <Button asChild variant="ghost" size="sm">
              <Link href="/packages" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Todos los paquetes
              </Link>
            </Button>
          </div>
        </div>

        {/* Destination description */}
        {destination.description && (
          <div className="mb-10 rounded-lg border border-gray-100 bg-gray-50/50 p-6">
            <p className="leading-relaxed text-gray-700">
              {destination.short_description || destination.description}
            </p>
          </div>
        )}

        {/* Packages Grid */}
        {packages.length > 0 ? (
          <section>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-secondary sm:text-3xl">
                Experiencias en {destination.name}
              </h2>
              <p className="mt-2 text-gray-600">
                Selecciona el paquete que mejor se adapte a tu aventura
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  packageData={pkg}
                  featured={pkg.is_featured}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="py-20 text-center">
            <div className="mx-auto max-w-md">
              <div className="mb-4 text-6xl">
                <Package className="mx-auto h-16 w-16 text-gray-300" />
              </div>
              <h3 className="mb-2 text-2xl font-bold text-gray-900">
                Próximamente
              </h3>
              <p className="mb-6 text-gray-600">
                Estamos preparando increíbles paquetes turísticos para{" "}
                {destination.name}. ¡Vuelve pronto!
              </p>
              <Button asChild>
                <Link href="/packages">Ver todos los paquetes</Link>
              </Button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
