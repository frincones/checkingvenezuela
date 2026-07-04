import { notFound } from "next/navigation";
import Image from "next/image";
import { BreadcrumbUI } from "@/components/local-ui/breadcrumb";
import ShareButtons from "@/components/local-ui/ShareButtons";
import { PackageCard } from "@/components/pages/packages/components/PackageCard";
import { DualCTA } from "@/components/ui/DualCTA";
import { createAdminClient } from "@/lib/db/supabase/server";
import { canonicalUrl } from "@/lib/utils/canonicalUrl";
import {
  MapPin, Compass, Utensils, Hotel, Sun, Banknote, Plane,
  Bus, Lightbulb, Quote, Package as PackageIcon, Map as MapIcon,
} from "lucide-react";

async function getDestination(slug) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("destinations")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  if (error) return null;
  return data;
}

async function getPackages(destinationId) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("service_inventory")
    .select(`*, provider:tourism_providers(id, name, slug, logo_url), destination:destinations(id, name, slug, image_url, country)`)
    .eq("product_type", "package")
    .eq("is_published", true)
    .eq("destination_id", destinationId)
    .neq("status", "discontinued")
    .order("is_featured", { ascending: false })
    .order("display_order", { ascending: true });
  return data || [];
}

export async function generateMetadata({ params }) {
  const dest = await getDestination(params.slug);
  if (!dest) return { title: "Destino no encontrado | Venezuela Voyages" };
  return {
    title: dest.meta_title || `${dest.name}, ${dest.country} | Venezuela Voyages`,
    description: dest.meta_description || dest.short_description || `Descubre ${dest.name}. Guía completa de viaje con Venezuela Voyages.`,
    openGraph: {
      title: `${dest.name} | Venezuela Voyages`,
      description: dest.short_description || `Guía de viaje a ${dest.name}`,
      images: dest.image_url ? [dest.image_url] : [],
      locale: "es_VE",
    },
  };
}

export default async function DestinationPage({ params }) {
  const dest = await getDestination(params.slug);
  if (!dest) return notFound();

  const packages = await getPackages(dest.id);
  const meta = dest.metadata || {};
  const coords = dest.coordinates;
  const gallery = dest.gallery || [];
  const culturalDesc = meta.cultural_description || dest.description;
  const places = meta.must_see_places || [];
  const experiences = meta.experiences || [];
  const practical = meta.practical_info || {};
  const testimonials = meta.testimonials || [];
  const hasPractical = practical.climate || practical.currency || practical.how_to_get_there || practical.local_transport || practical.useful_tips;

  const heroImage = dest.image_url || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop";

  return (
    <>
      {/* Hero */}
      <section className="relative flex h-[420px] items-end overflow-hidden sm:h-[480px]">
        <Image src={heroImage} alt={dest.name} fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="relative z-10 w-full px-[5%] pb-12 text-white">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium uppercase tracking-wider opacity-80">
            <MapPin className="h-4 w-4" />
            <span>{dest.country}</span>
          </div>
          <h1 className="text-4xl font-bold sm:text-5xl lg:text-6xl">{dest.name}</h1>
          {dest.short_description && (
            <p className="mt-3 max-w-2xl text-lg text-white/80">{dest.short_description}</p>
          )}
        </div>
      </section>

      <main className="mx-auto mb-10 w-[90%] max-w-6xl md:mb-20">
        {/* Breadcrumb + Share */}
        <div className="my-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BreadcrumbUI />
          <ShareButtons
            title={`${dest.name}, ${dest.country}`}
            url={canonicalUrl(`/destinos/${dest.slug}`)}
          />
        </div>

        {/* Descubre el destino */}
        {culturalDesc && (
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900 sm:text-3xl">
              Descubre {dest.name}
            </h2>
            <p className="whitespace-pre-line text-lg leading-relaxed text-gray-700">
              {culturalDesc}
            </p>
          </section>
        )}

        {/* Lugares Imprescindibles */}
        {places.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-6 text-2xl font-bold text-gray-900 sm:text-3xl">
              Lugares Imprescindibles
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {places.map((place, i) => (
                <div key={i} className="group overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-lg">
                  {place.image && (
                    <div className="relative h-48 overflow-hidden">
                      <Image src={place.image} alt={place.name || ""} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="mb-2 text-lg font-bold text-gray-900">{place.name}</h3>
                    <p className="text-sm leading-relaxed text-gray-600">{place.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Experiencias y Rutas */}
        {experiences.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-6 text-2xl font-bold text-gray-900 sm:text-3xl">
              Experiencias y Rutas
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {experiences.map((exp, i) => (
                <div key={i} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Compass className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{exp.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-600">{exp.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Información Práctica */}
        {hasPractical && (
          <section className="mb-12">
            <h2 className="mb-6 text-2xl font-bold text-gray-900 sm:text-3xl">
              Información Práctica
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {practical.climate && (
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-primary"><Sun className="h-5 w-5" /><h3 className="font-bold">Clima</h3></div>
                  <p className="text-sm text-gray-600">{practical.climate}</p>
                </div>
              )}
              {practical.currency && (
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-primary"><Banknote className="h-5 w-5" /><h3 className="font-bold">Moneda</h3></div>
                  <p className="text-sm text-gray-600">{practical.currency}</p>
                </div>
              )}
              {practical.how_to_get_there && (
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-primary"><Plane className="h-5 w-5" /><h3 className="font-bold">Cómo llegar</h3></div>
                  <p className="text-sm text-gray-600">{practical.how_to_get_there}</p>
                </div>
              )}
              {practical.local_transport && (
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-primary"><Bus className="h-5 w-5" /><h3 className="font-bold">Transporte Local</h3></div>
                  <p className="text-sm text-gray-600">{practical.local_transport}</p>
                </div>
              )}
              {practical.useful_tips && (
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:col-span-2">
                  <div className="mb-2 flex items-center gap-2 text-primary"><Lightbulb className="h-5 w-5" /><h3 className="font-bold">Consejos Útiles</h3></div>
                  <p className="text-sm text-gray-600">{practical.useful_tips}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Gastronomía y Alojamiento */}
        {(meta.gastronomy || meta.lodging) && (
          <section className="mb-12">
            <h2 className="mb-6 text-2xl font-bold text-gray-900 sm:text-3xl">
              Gastronomía y Alojamiento
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {meta.gastronomy && (
                <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-primary"><Utensils className="h-5 w-5" /><h3 className="text-lg font-bold">Gastronomía</h3></div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{meta.gastronomy}</p>
                </div>
              )}
              {meta.lodging && (
                <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-primary"><Hotel className="h-5 w-5" /><h3 className="text-lg font-bold">Alojamiento</h3></div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{meta.lodging}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Galería */}
        {gallery.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-6 text-2xl font-bold text-gray-900 sm:text-3xl">Galería</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.filter(Boolean).map((url, i) => (
                <div key={i} className="relative h-56 overflow-hidden rounded-xl">
                  <Image src={url} alt={`${dest.name} - ${i + 1}`} fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Mapa */}
        {coords?.lat && coords?.lng && (
          <section className="mb-12">
            <h2 className="mb-6 text-2xl font-bold text-gray-900 sm:text-3xl">
              <MapIcon className="mr-2 inline h-7 w-7" />
              Ubicación
            </h2>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <iframe
                src={`https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=12&output=embed`}
                width="100%"
                height="400"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Mapa de ${dest.name}`}
              />
            </div>
          </section>
        )}

        {/* Paquetes */}
        {packages.length > 0 && (
          <section className="mb-12">
            <div className="mb-6 flex items-center gap-3">
              <PackageIcon className="h-7 w-7 text-primary" />
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Paquetes en {dest.name}
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <PackageCard key={pkg.id} packageData={pkg} featured={pkg.is_featured} />
              ))}
            </div>
          </section>
        )}

        {/* Testimonios */}
        {testimonials.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-6 text-2xl font-bold text-gray-900 sm:text-3xl">
              Testimonios
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {testimonials.map((t, i) => (
                <div key={i} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                  <Quote className="mb-3 h-8 w-8 text-primary/30" />
                  <p className="mb-4 text-sm italic leading-relaxed text-gray-700">
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                      {(t.author || "A")[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{t.author}</p>
                      {t.role && <p className="text-xs text-gray-500">{t.role}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-8 text-center text-white sm:p-12">
          <h2 className="mb-3 text-2xl font-bold sm:text-3xl">
            ¿Listo para explorar {dest.name}?
          </h2>
          <p className="mb-6 text-white/80">
            Contáctanos y diseñamos tu viaje perfecto
          </p>
          <DualCTA
            variant="hero"
            onlineEnabled={false}
            quoteEnabled={true}
            quoteMessage={`Hola, estoy interesado en viajar a ${dest.name}, ${dest.country}. ¿Podrían darme más información?`}
            quoteLabel="Cotizar Ahora"
          />
        </section>
      </main>
    </>
  );
}
