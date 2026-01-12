import { SectionTitle } from "@/components/SectionTitle";
import { Card, CardContent } from "@/components/ui/card";
import { DualCTA } from "@/components/ui/DualCTA";
import { flightDestinations } from "@/data/popularDestinations";
import { MapPin, Plane } from "lucide-react";
import Image from "next/image";

/**
 * PopularFlightDestinations - Destinos Populares de Vuelos
 *
 * HU-004: Muestra 10 destinos internacionales con dual CTA
 * Usa datos estáticos para MVP (no depende de BD)
 */
export function PopularFlightDestinations() {
  return (
    <section className="mx-auto mb-[80px]">
      <div className="mx-auto mb-[20px] flex items-center justify-between max-md:flex-col max-md:gap-[16px] md:mb-[40px]">
        <SectionTitle
          title="Destinos de Vuelos Populares"
          subTitle="Explora los destinos internacionales más buscados desde Venezuela"
          className="flex-[0_0_50%]"
        />
      </div>

      <div className="grid gap-[16px] sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {flightDestinations.map((destination) => (
          <Card
            key={destination.id}
            className="group overflow-hidden transition-all duration-300 hover:shadow-lg"
          >
            <CardContent className="p-0">
              {/* Imagen */}
              <div className="relative h-40 overflow-hidden">
                <Image
                  src={destination.image}
                  alt={destination.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                {/* Código IATA */}
                <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/50 px-2 py-1 text-xs font-bold text-white">
                  <Plane className="h-3 w-3" />
                  {destination.iataCode}
                </div>

                {/* Nombre y país */}
                <div className="absolute bottom-3 left-3 text-white">
                  <div className="mb-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="text-xs">{destination.country}</span>
                  </div>
                  <h3 className="text-lg font-bold">{destination.name}</h3>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-3">
                <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                  {destination.description}
                </p>

                {/* Dual CTA */}
                <DualCTA
                  variant="card"
                  onlineEnabled={true}
                  onlinePath="/flights"
                  onlineLabel="Buscar"
                  onlineComingSoon={false}
                  quoteEnabled={true}
                  quoteMessage={`Hola, estoy interesado en vuelos a ${destination.name}, ${destination.country}. ¿Podrían ayudarme con opciones?`}
                  quoteLabel="Cotizar"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default PopularFlightDestinations;
