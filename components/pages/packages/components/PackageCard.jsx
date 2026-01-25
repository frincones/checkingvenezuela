import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { MapPin, Clock, Users, Star } from "lucide-react";

export function PackageCard({ packageData, featured = false }) {
  const mainImage = packageData.images?.[0] || packageData.destination?.image_url || "/images/default-package.jpg";
  const displayPrice = packageData.sale_price || packageData.cost_price || 0;
  const pricingDetails = packageData.pricing_details || {};
  const details = packageData.details || {};

  // Generar slug desde el nombre de forma más limpia
  const slug = packageData.name
    .toLowerCase()
    .replace(/\s+-\s+/g, '-')  // Reemplazar " - " con solo "-"
    .replace(/\s+/g, '-')       // Reemplazar espacios con guiones
    .replace(/\/+/g, '-')       // Reemplazar "/" con guiones
    .replace(/[^a-z0-9-]/g, '') // Eliminar caracteres especiales
    .replace(/-+/g, '-')        // Reemplazar múltiples guiones con uno solo
    .replace(/^-|-$/g, '');     // Eliminar guiones al inicio y final

  return (
    <article className={`group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-xl ${featured ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
      {/* Image */}
      <Link href={`/packages/${slug}`} className="relative block aspect-[4/3] overflow-hidden">
        <Image
          src={mainImage}
          alt={packageData.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-110"
        />

        {featured && (
          <div className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-yellow-500 px-3 py-1 text-sm font-semibold text-white shadow-lg">
            <Star className="h-4 w-4 fill-current" />
            <span>Destacado</span>
          </div>
        )}

        {packageData.status === "limited" && (
          <div className="absolute right-4 top-4 rounded-full bg-red-500 px-3 py-1 text-sm font-semibold text-white shadow-lg">
            Cupos Limitados
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-5">
        {/* Destination */}
        {packageData.destination && (
          <div className="mb-3 flex items-center gap-1 text-sm text-gray-600">
            <MapPin className="h-4 w-4" />
            <span className="truncate">{packageData.destination.name}</span>
          </div>
        )}

        {/* Title */}
        <Link href={`/packages/${slug}`}>
          <h3 className="mb-3 line-clamp-2 min-h-[3rem] text-lg font-bold text-gray-900 transition-colors group-hover:text-primary">
            {packageData.name}
          </h3>
        </Link>

        {/* Description */}
        {packageData.description && (
          <p className="mb-4 line-clamp-2 text-sm text-gray-600">
            {packageData.description}
          </p>
        )}

        {/* Details */}
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
          {details.duration && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{details.duration}</span>
            </div>
          )}

          {details.schedule?.departure && (
            <div className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs">Salida: {details.schedule.departure}</span>
            </div>
          )}
        </div>

        {/* Price & CTA */}
        <div className="flex items-end justify-between border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs text-gray-500">
              {pricingDetails.display_text || "Desde"}
            </p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(displayPrice)}
            </p>
            <p className="text-xs text-gray-500">por persona</p>
          </div>

          <Button asChild size="sm">
            <Link href={`/packages/${slug}`}>
              Ver Detalles
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
