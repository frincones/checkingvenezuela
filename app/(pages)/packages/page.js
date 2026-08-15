import { PackagesList } from "@/components/pages/packages/sections/PackagesList";
import { PackagesHeader } from "@/components/pages/packages/sections/PackagesHeader";
import { FeaturedPackages } from "@/components/pages/packages/sections/FeaturedPackages";

export const metadata = {
  title: "Travel Packages | Venezuela Voyages",
  description: "Discover our all-inclusive travel packages. Flights + hotel + activities at the best prices. Destinations across Venezuela and the Caribbean.",
  keywords: ["travel packages", "all inclusive", "venezuela voyages", "venezuela travel", "flight and hotel", "caribbean holidays", "venezuela tourism"],
  openGraph: {
    title: "Travel Packages | Venezuela Voyages",
    description: "All-inclusive travel packages at the best prices. Flights + hotel + activities.",
    locale: "en_VE",
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
