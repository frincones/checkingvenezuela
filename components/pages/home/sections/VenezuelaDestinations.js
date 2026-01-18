import { SectionTitle } from "@/components/SectionTitle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DualCTA } from "@/components/ui/DualCTA";
import { venezuelaDestinations } from "@/data/venezuelaDestinations";
import { getCategoriesWithDestinationsFromDB } from "@/lib/cms";
import { Umbrella, Mountain, Church, Zap, Compass } from "lucide-react";
import Image from "next/image";

// Mapa de iconos por categoría
const categoryIcons = {
  Umbrella,
  Mountain,
  Church,
  Zap,
  Compass,
};

/**
 * VenezuelaDestinations - Destinos de Venezuela
 *
 * HU-003: Muestra los destinos de Venezuela agrupados por categoría
 * con descripciones exactas del requerimiento
 *
 * Obtiene datos de la BD con fallback a datos estáticos
 */
export async function VenezuelaDestinations() {
  // Intentar obtener categorías con destinos de la BD, fallback a datos estáticos
  let categories = [];
  try {
    categories = await getCategoriesWithDestinationsFromDB();
    if (!categories || categories.length === 0) {
      categories = venezuelaDestinations.categories;
    }
  } catch (error) {
    console.error("Error loading destinations from DB, using fallback:", error);
    categories = venezuelaDestinations.categories;
  }

  return (
    <section className="mx-auto mb-[80px]">
      <div className="mb-[20px] md:mb-[40px]">
        <SectionTitle
          title="Descubre Venezuela"
          subTitle="El último gran secreto del Caribe te espera"
        />
      </div>

      {/* Categorías de destinos */}
      <div className="space-y-12">
        {categories.map((category) => {
          const IconComponent = categoryIcons[category.icon];

          return (
            <div key={category.id}>
              {/* Header de categoría */}
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {IconComponent && <IconComponent className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {category.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {category.subtitle}
                  </p>
                </div>
              </div>

              {/* Grid de destinos */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {category.destinations.map((destination) => (
                  <Card
                    key={destination.id}
                    className="group overflow-hidden transition-all hover:shadow-xl"
                  >
                    {/* Imagen */}
                    <div className="relative h-48 overflow-hidden">
                      <Image
                        src={destination.image}
                        alt={destination.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                      {/* Overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      {/* Nombre sobre la imagen */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h4 className="text-lg font-bold text-white">
                          {destination.name}
                        </h4>
                      </div>
                    </div>

                    <CardContent className="p-4">
                      {/* Tags */}
                      <div className="mb-3 flex flex-wrap gap-1">
                        {destination.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      {/* Descripción */}
                      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                        {destination.description}
                      </p>

                      {/* Highlights */}
                      <div className="mb-4 flex flex-wrap gap-2">
                        {destination.highlights.slice(0, 3).map((highlight) => (
                          <span
                            key={highlight}
                            className="inline-flex items-center text-xs text-primary"
                          >
                            <span className="mr-1">•</span>
                            {highlight}
                          </span>
                        ))}
                      </div>

                      {/* Dual CTA */}
                      <DualCTA
                        variant="card"
                        onlineEnabled={false}
                        onlineComingSoon={true}
                        quoteEnabled={true}
                        quoteMessage={`Hola, estoy interesado en viajar a ${destination.name}, Venezuela. ¿Podrían darme más información?`}
                        quoteLabel="Cotizar"
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default VenezuelaDestinations;
