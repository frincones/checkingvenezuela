"use client";

import { useState } from "react";
import Image from "next/image";
import { DynamicStringList } from "@/components/dashboard/shared/DynamicStringList";
import { ItineraryBuilder } from "@/components/dashboard/shared/ItineraryBuilder";
import { ImageUrlList } from "@/components/dashboard/shared/ImageUrlList";

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
  const hasEnrichedData = !!(
    item.product_details?.itinerary?.length ||
    item.product_details?.includes?.length ||
    item.product_details?.not_includes?.length ||
    item.product_details?.recommendations?.length ||
    item.product_images?.length > 0
  );
  const [expanded, setExpanded] = useState(hasEnrichedData);

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

  function updateDetails(field, value) {
    onUpdate(index, "product_details", {
      ...(item.product_details || {}),
      [field]: value,
    });
  }

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

            {/* Action buttons */}
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                title={expanded ? "Cerrar detalles" : "Editar detalles"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {expanded ? (
                    <path d="m18 15-6-6-6 6" />
                  ) : (
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  )}
                </svg>
              </button>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Quitar item"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Includes summary */}
          {(includesCount > 0 || itineraryDays > 0) && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {itineraryDays > 0 && (
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  {itineraryDays} dias
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

      {/* Expanded edit panel */}
      {expanded && (
        <div className="border-t border-border bg-gray-50/50 p-4 space-y-5">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Editar Detalles del Producto</h5>

          {/* Duration */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Duracion</label>
            <input
              type="text"
              value={item.product_details?.duration || ""}
              onChange={(e) => updateDetails("duration", e.target.value)}
              placeholder="Ej: 3 dias / 2 noches"
              className="h-9 w-full max-w-xs rounded-md border border-gray-300 px-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* Images */}
          <ImageUrlList
            images={item.product_images || []}
            onChange={(newImages) => onUpdate(index, "product_images", newImages)}
            label="Imagenes del Producto"
          />

          {/* Itinerary */}
          <ItineraryBuilder
            itinerary={item.product_details?.itinerary || []}
            onChange={(newItinerary) => updateDetails("itinerary", newItinerary)}
            label="Itinerario"
          />

          {/* Includes */}
          <DynamicStringList
            items={item.product_details?.includes || []}
            onChange={(newList) => updateDetails("includes", newList)}
            placeholder="Ej: Alojamiento en posada"
            label="Incluye"
          />

          {/* Not includes */}
          <DynamicStringList
            items={item.product_details?.not_includes || []}
            onChange={(newList) => updateDetails("not_includes", newList)}
            placeholder="Ej: Vuelos nacionales"
            label="No Incluye"
          />

          {/* Recommendations */}
          <DynamicStringList
            items={item.product_details?.recommendations || []}
            onChange={(newList) => updateDetails("recommendations", newList)}
            placeholder="Ej: Llevar protector solar"
            label="Recomendaciones"
          />
        </div>
      )}
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
          Descripcion
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
