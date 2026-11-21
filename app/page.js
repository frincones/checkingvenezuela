import { Nav } from "@/components/sections/Nav";
// TEMPORALMENTE DESHABILITADO - Buscador de vuelos/hospedaje
// import { SearchFlightsAndStaysFormShortcut } from "@/components/pages/home/sections/SearchFlightsAndStaysFormShortcut";
import { Reviews } from "@/components/pages/home/sections/Reviews";
import { Footer } from "@/components/sections/Footer";
import Image from "next/image";

import { getActiveHeroContent } from "@/data/heroConfig";

// HU-003 + HU-004: Nuevas secciones
import { ServicesSection } from "@/components/pages/home/sections/ServicesSection";
import { VenezuelaDestinations } from "@/components/pages/home/sections/VenezuelaDestinations";
// Secciones ocultas: los imports se comentan con ellas para que el bundle no
// arrastre componentes que no se renderizan.
// import { PopularFlightDestinations } from "@/components/pages/home/sections/PopularFlightDestinations";
// import { PopularHotelDestinations } from "@/components/pages/home/sections/PopularHotelDestinations";
import { FeaturedPackages } from "@/components/pages/home/sections/FeaturedPackages";
import { BannersHero, BannersSection } from "@/components/pages/home/sections/BannersSection";
import { LatestBlogPosts } from "@/components/pages/home/sections/LatestBlogPosts";

/**
 * La home se cachea 5 minutos y se regenera en segundo plano (ISR).
 *
 * Antes era `force-dynamic`, con el comentario "para siempre mostrar datos
 * frescos del CMS". El objetivo era correcto, pero el medio salía caro: cada
 * visita de cada visitante renderizaba la página entera desde cero. Medido en
 * producción, la home costaba ~263 ms de CPU por visita y suponía el 72% del
 * consumo total del sitio, que es lo que agotó el límite del plan.
 *
 * La frescura del CMS ya no depende de esto: las rutas de escritura del CMS
 * llaman a `revalidatePath("/")` tras cada cambio, así que una edición invalida
 * la caché al instante. El TTL de 300 s es solo una red de seguridad por si
 * alguna escritura no revalidara.
 *
 * Es decir: antes se pagaba frescura en cada visita; ahora se paga solo cuando
 * algo cambia de verdad.
 */
export const revalidate = 300;

export default async function HomePage() {
  // La sesión NO se resuelve aquí a propósito.
  //
  // `auth()` lee cookies, y leer cookies en una página la vuelve dinámica de
  // forma irreversible: ningún `revalidate` tiene efecto mientras esté
  // presente. Verificado con un build real antes de hacer el cambio.
  //
  // Lo único que la sesión aportaba en esta página era pintar avatar y nombre
  // en la barra de navegación. El sitio tiene 2 usuarios con acceso (uno de
  // ellos de prueba), y entran por /dashboard, no por la home. Se estaba
  // pagando render dinámico a cada visitante anónimo por una personalización
  // que ve una persona.
  //
  // El resto del sitio NO cambia: `app/(pages)/layout.js` sigue llamando a
  // `auth()` y pasando la sesión a su Nav, así que el avatar sigue apareciendo
  // en todas las demás páginas. Aquí la barra se renderiza en su versión de
  // visitante.
  const heroContent = getActiveHeroContent();

  return (
    <>
      <header className="relative">
        {/* Sin `session`: Nav la trata como ausente y muestra los botones de
            acceso en vez del avatar. Es el comportamiento que ya veía el 100%
            de los visitantes, porque prácticamente nadie navega la home con
            sesión iniciada. */}
        <Nav type="home" className={"absolute left-0 top-0 z-10"} />
        <section
          className={`relative flex h-[600px] w-full items-center bg-home-header`}
        >
          <Image
            src="/images/hero-venezuela.jpg"
            alt="Venezuela - Caribbean landscape"
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
        {/* Banners tipo Hero: carousel horizontal */}
        <BannersHero />

        {/* Paquetes Turísticos Destacados */}
        <FeaturedPackages />

        {/* HU-003: Destinos de Venezuela */}
        <VenezuelaDestinations />

        {/* Vuelos y hoteles populares: ocultos a petición del equipo comercial.
            Se comentan en vez de borrarse porque la decisión es de presentación
            y puede revertirse.

            Ojo: ocultar la sección NO desindexa /flights ni /hotels, que siguen
            en el sitemap y accesibles. Y /flights renderiza una pantalla de
            error en producción, así que seguirá rastreándose así hasta que se
            arregle por separado. */}
        {/* <PopularFlightDestinations /> */}
        {/* <PopularHotelDestinations /> */}

        {/* Banners tipo Sección: promocionales dentro del contenido */}
        <BannersSection />

        {/* HU-003: Catálogo de Servicios */}
        <ServicesSection />

        {/* Blog: Últimos artículos */}
        <LatestBlogPosts />

        {/* Secciones existentes */}
        <Reviews />
      </main>
      <Footer />
    </>
  );
}
