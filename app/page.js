import { Nav } from "@/components/sections/Nav";
import { SearchFlightsAndStaysFormShortcut } from "@/components/pages/home/sections/SearchFlightsAndStaysFormShortcut";
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

export default async function HomePage() {
  const session = await auth();
  const heroContent = getActiveHeroContent();

  return (
    <>
      <header className="relative mb-20">
        <Nav
          type="home"
          className={"absolute left-0 top-0 z-10"}
          session={session}
        />
        <section
          className={`relative flex h-[600px] w-full items-center bg-home-header`}
        >
          <Image
            src={
              "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=70&amp;w=870&amp;auto=format&amp;fit=crop&amp;ixlib=rb-4.0.3&amp;ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            }
            alt="Venezuela landscape - Caribbean paradise"
            fill
            sizes="(max-width: 640px) 50vw, 90vw"
            className="-z-10 object-cover object-[center_40%]"
            loading={"eager"}
          />
          {/* Overlay para mejorar legibilidad del texto */}
          <div className="absolute inset-0 -z-[5] bg-gradient-to-b from-black/40 via-black/20 to-black/50" />
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
        <SearchFlightsAndStaysFormShortcut
          className={
            "relative left-1/2 top-full w-[90%] -translate-x-1/2 -translate-y-[20%] lg:-translate-y-[25%] xl:-translate-y-[30%]"
          }
        />
      </header>

      <main className="mx-auto mb-10 w-[90%] space-y-10 md:mb-20 md:space-y-20">
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
