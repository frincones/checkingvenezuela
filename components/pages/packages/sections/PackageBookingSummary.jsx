import Image from "next/image";
import { formatCurrency } from "@/lib/utils";
import { MapPin, Clock, Package } from "lucide-react";

export function PackageBookingSummary({ packageData }) {
  const mainImage = packageData.images?.[0] || packageData.destination?.image_url || "/images/default-package.jpg";
  const displayPrice = packageData.sale_price || packageData.cost_price || 0;
  const pricingDetails = packageData.pricing_details || {};
  const details = packageData.details || {};

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-bold">Resumen del Paquete</h2>

      {/* Package Image */}
      <div className="relative mb-4 aspect-video overflow-hidden rounded-lg">
        <Image
          src={mainImage}
          alt={packageData.name}
          fill
          className="object-cover"
        />
      </div>

      {/* Package Title */}
      <h3 className="mb-4 text-lg font-bold text-gray-900">
        {packageData.name}
      </h3>

      {/* Package Details */}
      <div className="mb-6 space-y-3 border-b border-gray-200 pb-6">
        {packageData.destination && (
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">Destino</p>
              <p className="text-sm text-gray-600">
                {packageData.destination.name}, {packageData.destination.country}
              </p>
            </div>
          </div>
        )}

        {details.duration && (
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">Duración</p>
              <p className="text-sm text-gray-600">{details.duration}</p>
            </div>
          </div>
        )}

        {packageData.provider && (
          <div className="flex items-start gap-3">
            <Package className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">Proveedor</p>
              <p className="text-sm text-gray-600">{packageData.provider.name}</p>
            </div>
          </div>
        )}
      </div>

      {/* Price Summary */}
      <div className="mb-6 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-600">Precio base</span>
          <span className="text-lg font-bold text-gray-900">
            {formatCurrency(displayPrice)}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {pricingDetails.display_text || "Por persona"}
        </p>
      </div>

      {/* Highlights */}
      {details.includes && details.includes.length > 0 && (
        <div className="rounded-lg bg-green-50 p-4">
          <p className="mb-2 text-sm font-semibold text-green-900">
            Incluye:
          </p>
          <ul className="space-y-1">
            {details.includes.slice(0, 4).map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-xs text-green-800">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="line-clamp-2">{item}</span>
              </li>
            ))}
            {details.includes.length > 4 && (
              <li className="text-xs italic text-green-700">
                Y {details.includes.length - 4} más...
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Info Note */}
      <div className="mt-6 rounded-lg bg-blue-50 p-4">
        <p className="text-xs text-blue-900">
          💡 <strong>Nota:</strong> El precio final puede variar según el número de personas,
          fechas y disponibilidad. Recibirás una cotización personalizada.
        </p>
      </div>
    </div>
  );
}
