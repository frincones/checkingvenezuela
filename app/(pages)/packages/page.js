import { PackagesList } from "@/components/pages/packages/sections/PackagesList";
import { PackagesHeader } from "@/components/pages/packages/sections/PackagesHeader";
import { FeaturedPackages } from "@/components/pages/packages/sections/FeaturedPackages";

export const metadata = {
  title: "Paquetes Turísticos | Venezuela Voyages",
  description: "Descubre nuestros paquetes turísticos todo incluido. Vuelo + hotel + actividades con los mejores precios. Destinos en Venezuela y el Caribe.",
  keywords: ["paquetes turísticos", "todo incluido", "venezuela voyages", "viajes venezuela", "vuelo hotel", "vacaciones caribe", "turismo venezuela"],
  openGraph: {
    title: "Paquetes Turísticos | Venezuela Voyages",
    description: "Paquetes turísticos todo incluido con los mejores precios. Vuelo + hotel + actividades.",
    locale: "es_VE",
  },
};

export default async function PackagesPage() {
  return (
    <>
      <PackagesHeader />

      <main className="mx-auto mb-10 w-[90%] space-y-10 md:mb-20 md:space-y-20">
        <FeaturedPackages />
        <PackagesList />
      </main>
    </>
  );
}
