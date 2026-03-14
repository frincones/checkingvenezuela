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

export function QuotationItemCard({ item, index, onUpdate, onRemove, currency = "USD" }) {
  const isEnriched = !!item.inventory_id;

  if (isEnriched) {
    return (
      <EnrichedItemCard
        item={item}
        index={index}
        onUpdate={onUpdate}
        onRemove={onRemove}
        currency={currency}
      />
    );
  }

  return (
    <ManualItemRow
      item={item}
      index={index}
      onUpdate={onUpdate}
      onRemove={onRemove}
      currency={currency}
    />
  );
}

function EnrichedItemCard({ item, index, onUpdate, onRemove, currency }) {
  const mainImage =
    item.product_images?.[0] ||
    item.destination_data?.image_url ||
    null;

  const typeLabel = TYPE_LABELS[item.type] || "Producto";
  const destinationName = item.destination_data?.name;
  const providerName = item.provider_data?.name;
  const duration = item.product_details?.duration;
  const includesCount = item.product_details?.includes?.length || 0;
  const itineraryDays = item.product_details?.itinerary?.length || 0;

  const lineTotal = (item.quantity || 1) * (item.unit_price || 0);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="flex gap-0">
        {/* Thumbnail */}
        {mainImage && (
          <div className="relative hidden w-[160px] shrink-0 sm:block">
            <Image
              src={mainImage}
              alt={item.description}
              fill
              className="object-cover"
              sizes="160px"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {typeLabel}
                </span>
                {destinationName && (
                  <span className="inline-block rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-secondary">
                    {destinationName}
                  </span>
                )}
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                {item.description}
              </h4>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {duration && <span>{duration}</span>}
                {providerName && <span>{providerName}</span>}
                {item.provider_data?.rating && (
                  <span>★ {item.provider_data.rating}</span>
                )}
              </div>
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Quitar item"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          </div>

          {/* Includes summary */}
          {(includesCount > 0 || itineraryDays > 0) && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {itineraryDays > 0 && (
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  {itineraryDays} días
                </span>
              )}
              {includesCount > 0 && (
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
                  {includesCount} incluidos
                </span>
              )}
            </div>
          )}

          {/* Price inputs row */}
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Cant:</label>
              <input
                type="number"
                min="1"
                value={item.quantity || 1}
                onChange={(e) =>
                  onUpdate(index, "quantity", parseInt(e.target.value) || 1)
                }
                className="h-8 w-16 rounded border border-border px-2 text-center text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Precio:</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unit_price || 0}
                onChange={(e) =>
                  onUpdate(index, "unit_price", parseFloat(e.target.value) || 0)
                }
                className="h-8 w-28 rounded border border-border px-2 text-right text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="ml-auto text-right">
              <span className="text-xs text-muted-foreground">Total: </span>
              <span className="text-base font-bold text-secondary">
                ${lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualItemRow({ item, index, onUpdate, onRemove }) {
  const lineTotal = (item.quantity || 1) * (item.unit_price || 0);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border bg-white p-4">
      {/* Description */}
      <div className="flex-1">
        <label className="mb-1 block text-xs text-muted-foreground">
          Descripción
        </label>
        <input
          type="text"
          value={item.description || ""}
          onChange={(e) => onUpdate(index, "description", e.target.value)}
          placeholder="Ej: Traslado aeropuerto-hotel"
          className="h-9 w-full rounded border border-border px-3 text-sm outline-none focus:border-primary"
        />
      </div>

      {/* Quantity */}
      <div className="w-20">
        <label className="mb-1 block text-xs text-muted-foreground">
          Cant.
        </label>
        <input
          type="number"
          min="1"
          value={item.quantity || 1}
          onChange={(e) =>
            onUpdate(index, "quantity", parseInt(e.target.value) || 1)
          }
          className="h-9 w-full rounded border border-border px-2 text-center text-sm outline-none focus:border-primary"
        />
      </div>

      {/* Unit Price */}
      <div className="w-28">
        <label className="mb-1 block text-xs text-muted-foreground">
          Precio Unit.
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={item.unit_price || 0}
          onChange={(e) =>
            onUpdate(index, "unit_price", parseFloat(e.target.value) || 0)
          }
          className="h-9 w-full rounded border border-border px-2 text-right text-sm outline-none focus:border-primary"
        />
      </div>

      {/* Line total */}
      <div className="w-24 text-right">
        <label className="mb-1 block text-xs text-muted-foreground">
          Total
        </label>
        <span className="inline-block h-9 leading-9 text-sm font-semibold text-foreground">
          ${lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="mb-0.5 rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        title="Quitar item"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}
