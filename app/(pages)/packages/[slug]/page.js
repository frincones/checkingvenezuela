import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { BreadcrumbUI } from "@/components/local-ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PackageDetailsTab } from "@/components/pages/packages/sections/PackageDetailsTab";
import { PackageItinerary } from "@/components/pages/packages/sections/PackageItinerary";
import { PackageIncludes } from "@/components/pages/packages/sections/PackageIncludes";
import { PackageActions } from "@/components/pages/packages/components/PackageActions";
import { PackageBottomCTA } from "@/components/pages/packages/components/PackageBottomCTA";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/db/supabase/server";
import { createAdminClient } from "@/lib/db/supabase/server";
import { findPackageBySlug } from "@/lib/packages/slug";
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Package as PackageIcon,
  Star
} from "lucide-react";

export async function generateMetadata({ params }) {
  const pkg = await getPackageBySlug(params.slug);
  if (!pkg) return { title: "Package not found | Venezuela Voyages" };
  const price = pkg.sale_price ? `from $${pkg.sale_price}` : "";
  const destName = pkg.destination?.name || "";
  const fallbackDesc = price
    ? `${pkg.name} ${price}. ${pkg.description || `Travel package in ${destName}. Book with Venezuela Voyages.`}`
    : pkg.description || `Discover the ${pkg.name} package. Book with Venezuela Voyages.`;
  const title = pkg.meta_title || `${pkg.name} | Venezuela Voyages`;
  const description = (pkg.meta_description || fallbackDesc).slice(0, 160);
  const tags = pkg.details?.tags || pkg.destination?.tags || [];
  return {
    title,
    description,
    keywords: ["travel package", pkg.name, destName, "venezuela voyages", ...tags].filter(Boolean),
    openGraph: {
      title,
      description,
      images: pkg.images?.[0] ? [pkg.images[0]] : [],
      locale: "en_VE",
    },
  };
}

async function getPackageBySlug(slug) {
  return findPackageBySlug(slug, {
    select: `
      *,
      provider:tourism_providers(id, name, slug, logo_url),
      destination:destinations(id, name, slug, image_url, country)
    `,
  });
}

export default async function PackageDetailPage({ params }) {
  const packageData = await getPackageBySlug(params.slug);

  if (!packageData) {
    return notFound();
  }

  const details = packageData.details || {};
  const pricingDetails = packageData.pricing_details || {};

  const mainImage = packageData.images?.[0] || packageData.destination?.image_url || "/images/default-package.jpg";
  const displayPrice = packageData.sale_price || packageData.cost_price || 0;

  // WhatsApp configuration
  const phoneNumber = "584264034052";
  const whatsappMessage = encodeURIComponent(
    `Hi! I'm interested in the "${packageData.name}" package. I'd like more information and a quote. Price shown: ${formatCurrency(displayPrice)}`
  );
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${whatsappMessage}`;

  // Share URL
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareUrl = currentUrl || `https://venezuelavoyages.com/packages/${params.slug}`;

  return (
    <main className="mx-auto mb-[90px] mt-10 w-[90%]">
      <BreadcrumbUI />

      {/* Header Section */}
      <div className="my-[40px] flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-center">
        <div className="flex-1">
          <div className="mb-4 flex items-center gap-3">
            <PackageIcon className="h-6 w-6 text-primary" />
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              Travel Package
            </span>
          </div>

          <h1 className="mb-4 text-2xl font-bold text-secondary sm:text-3xl lg:text-4xl">
            {packageData.name}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
            {packageData.destination && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{packageData.destination.name}, {packageData.destination.country}</span>
              </div>
            )}

            {details.duration && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{details.duration}</span>
              </div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-auto">
          <div className="mb-4 text-right">
            <p className="text-sm font-medium text-gray-500">
              {pricingDetails.display_text || "Precio por persona"}
            </p>
            <p className="text-4xl font-bold text-primary">
              {formatCurrency(displayPrice)}
            </p>
            {pricingDetails.price_type === "per_person" && (
              <p className="text-sm text-gray-500">Por persona</p>
            )}
          </div>

          <PackageActions
            packageName={packageData.name}
            whatsappMessage={`Hi! I'm interested in the "${packageData.name}" package. I'd like more information and a quote. Price shown: ${formatCurrency(displayPrice)}`}
            shareUrl={shareUrl}
            displayPrice={displayPrice}
          />
        </div>
      </div>

      {/* Images Gallery */}
      <div className="relative mb-[40px] grid grid-cols-1 gap-2 overflow-hidden rounded-xl sm:grid-cols-4 sm:grid-rows-2 lg:h-[500px]">
        <div className="sm:col-span-2 sm:row-span-2">
          <Image
            src={mainImage}
            alt={packageData.name}
            width={1000}
            height={1000}
            className="h-full w-full rounded-lg object-cover"
          />
        </div>

        {packageData.images?.slice(1, 5).map((image, index) => (
          <div key={index} className="h-[200px] sm:h-auto">
            <Image
              src={image}
              alt={`${packageData.name} - Image ${index + 2}`}
              width={500}
              height={500}
              className="h-full w-full rounded-lg object-cover"
            />
          </div>
        ))}
      </div>

      <Separator className="my-[40px]" />

      {/* Package Description */}
      {packageData.description && (
        <>
          <div className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">Package description</h2>
            <p className="whitespace-pre-line text-gray-700 leading-relaxed">
              {packageData.description}
            </p>
          </div>
          <Separator className="my-[40px]" />
        </>
      )}

      {/* Itinerary */}
      {details.itinerary && (
        <>
          <PackageItinerary itinerary={details.itinerary} />
          <Separator className="my-[40px]" />
        </>
      )}

      {/* What's Included / Not Included */}
      <PackageIncludes
        includes={details.includes || []}
        notIncludes={details.not_includes || []}
      />

      <Separator className="my-[40px]" />

      {/* Additional Details */}
      {details.schedule && (
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-bold">Schedule</h2>
          <div className="rounded-lg bg-gray-50 p-6">
            {details.schedule.departure && (
              <div className="mb-3">
                <span className="font-semibold">Departure:</span> {details.schedule.departure}
              </div>
            )}
            {details.schedule.return && (
              <div>
                <span className="font-semibold">Return:</span> {details.schedule.return}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CTA Section */}
      <div className="mt-12 rounded-xl bg-primary/5 p-8 text-center">
        <h3 className="mb-4 text-2xl font-bold">Ready for your adventure?</h3>
        <p className="mb-6 text-gray-600">
          Book now and secure your place on this unique experience
        </p>
        <PackageBottomCTA packageName={packageData.name} displayPrice={displayPrice} />
      </div>
    </main>
  );
}
