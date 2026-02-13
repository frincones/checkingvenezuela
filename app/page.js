import { Nav } from "@/components/sections/Nav";
// TEMPORALMENTE DESHABILITADO - Buscador de vuelos/hospedaje
// import { SearchFlightsAndStaysFormShortcut } from "@/components/pages/home/sections/SearchFlightsAndStaysFormShortcut";
import { FindFlightAndHotelcards } from "@/components/pages/home/sections/FindFlightAndHotelCards";
import { Reviews } from "@/components/pages/home/sections/Reviews";
import { Footer } from "@/components/sections/Footer";
import Image from "next/image";

import { auth } from "@/lib/auth";
import { getActiveHeroContent } from "@/data/heroConfig";

// HU-003 + HU-004: Nuevas secciones
import { ServicesSection } from "@/components/pages/home/sections/ServicesSection";
import { VenezuelaDestinations } from "@/components/pages/home/sections/VenezuelaDestinations";
import { PopularFlightDestinations } from "@/components/pages/home/sections/PopularFlightDestinations";
import { PopularHotelDestinations } from "@/components/pages/home/sections/PopularHotelDestinations";
import { FeaturedPackages } from "@/components/pages/home/sections/FeaturedPackages";

export default async function HomePage() {
  const session = await auth();
  const heroContent = getActiveHeroContent();

  return (
    <>
      <header className="relative">
        <Nav
          type="home"
          className={"absolute left-0 top-0 z-10"}
          session={session}
        />
        <section
          className={`relative flex h-[600px] w-full items-center bg-home-header`}
        >
          <Image
            src="/images/hero-venezuela.jpg"
            alt="Venezuela - Paisaje caribeño"
            fill
            sizes="100vw"
            quality={90}
            className="-z-10 object-cover object-center"
            priority
          />
          <div className="w-full px-4 text-center text-white">
            {/* Headline principal - HU-002 */}
            <h1 className="mx-auto max-w-4xl font-tradegothic text-[1.75rem] font-bold leading-tight tracking-wide drop-shadow-lg sm:text-[2.25rem] md:text-[3rem] lg:text-[3.5rem] xl:text-[4rem]">
              {heroContent.headline}
            </h1>
            {/* Subtítulo - TBD en HU-003 */}
            {heroContent.subtitle && (
              <p className="mx-auto mt-4 max-w-2xl text-[1rem] font-medium drop-shadow-md lg:text-[1.25rem]">
                {heroContent.subtitle}
              </p>
            )}
            {/* CTA - TBD en HU-004 */}
            {heroContent.cta && (
              <div className="mt-8">
                {/* CTA button will be added here */}
              </div>
            )}
          </div>
        </section>
        {/* TEMPORALMENTE DESHABILITADO - Buscador de vuelos/hospedaje
        <SearchFlightsAndStaysFormShortcut
          className={
            "relative left-1/2 top-full w-[90%] -translate-x-1/2 -translate-y-[20%] lg:-translate-y-[25%] xl:-translate-y-[30%]"
          }
        />
        */}
      </header>

      <main className="mx-auto mb-10 w-[90%] space-y-10 pt-10 md:mb-20 md:space-y-20 md:pt-16">
        {/* Paquetes Turísticos Destacados */}
        <FeaturedPackages />

        {/* HU-003: Catálogo de Servicios */}
        <ServicesSection />

        {/* HU-003: Destinos de Venezuela */}
        <VenezuelaDestinations />

        {/* HU-004: Destinos Populares de Vuelos */}
        <PopularFlightDestinations />

        {/* HU-004: Destinos Populares de Hoteles */}
        <PopularHotelDestinations />

        {/* Secciones existentes */}
        <FindFlightAndHotelcards />
        <Reviews />
      </main>
      <Footer />
    </>
  );
}
