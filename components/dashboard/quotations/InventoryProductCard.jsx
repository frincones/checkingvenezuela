"use client";

import Image from "next/image";

const TYPE_LABELS = {
  flight: "Vuelo",
  hotel: "Hotel",
  package: "Paquete",
  tour: "Tour",
  transfer: "Traslado",
  insurance: "Seguro",
  car_rental: "Auto",
  cruise: "Crucero",
  other: "Otro",
};

const TYPE_COLORS = {
  flight: "bg-blue-100 text-blue-700",
  hotel: "bg-purple-100 text-purple-700",
  package: "bg-primary/10 text-primary",
  tour: "bg-orange-100 text-orange-700",
  transfer: "bg-teal-100 text-teal-700",
  insurance: "bg-green-100 text-green-700",
  other: "bg-gray-100 text-gray-700",
};

const STATUS_COLORS = {
  available: "bg-green-100 text-green-700",
  limited: "bg-amber-100 text-amber-700",
};

export function InventoryProductCard({ product, onSelect }) {
  const mainImage =
    product.images?.[0] ||
    product.destination?.image_url ||
    null;

  const displayPrice = product.sale_price || product.cost_price || 0;
  const duration = product.details?.duration;
  const destinationName = product.destination?.name;
  const providerName = product.provider?.name;
  const typeLabel = TYPE_LABELS[product.product_type] || "Producto";
  const typeColor = TYPE_COLORS[product.product_type] || TYPE_COLORS.other;
  const statusColor = STATUS_COLORS[product.status] || "";

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-border bg-white transition-shadow hover:shadow-md">
      {/* Image */}
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-muted">
        {mainImage ? (
          <Image
            src={mainImage}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 350px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeColor}`}
          >
            {typeLabel}
          </span>
          {product.status && product.status !== "discontinued" && (
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusColor}`}
            >
              {product.status === "available" ? "Disponible" : product.status === "limited" ? "Limitado" : product.status}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-foreground">
          {product.name}
        </h3>

        {/* Meta */}
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {duration && <span>{duration}</span>}
          {destinationName && <span>{destinationName}</span>}
          {providerName && <span>{providerName}</span>}
        </div>

        {/* Price + Action */}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <span className="text-base font-bold text-secondary">
              ${displayPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
            {product.pricing_details?.price_type === "per_person" && (
              <span className="text-xs text-muted-foreground"> /persona</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onSelect(product)}
            className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
