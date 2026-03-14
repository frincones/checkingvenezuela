"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InventoryProductCard } from "./InventoryProductCard";

const PRODUCT_TYPES = [
  { value: "", label: "Todos" },
  { value: "package", label: "Paquetes" },
  { value: "hotel", label: "Hoteles" },
  { value: "flight", label: "Vuelos" },
  { value: "tour", label: "Tours" },
  { value: "transfer", label: "Traslados" },
  { value: "insurance", label: "Seguros" },
];

export function ProductSelectorModal({ open, onOpenChange, onAddItem }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const debounceRef = useRef(null);

  const fetchProducts = useCallback(async (search, type) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        enrich: "true",
        status: "available",
        published: "true",
        limit: "20",
      });
      if (search) params.set("search", search);
      if (type) params.set("type", type);

      const res = await fetch(`/api/inventory?${params.toString()}`);
      if (!res.ok) throw new Error("Error fetching inventory");
      const json = await res.json();
      setProducts(json.data || []);
    } catch (err) {
      console.error("Error fetching products:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on open
  useEffect(() => {
    if (open) {
      fetchProducts(searchTerm, typeFilter);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchProducts(searchTerm, typeFilter);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm, typeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(product) {
    const enrichedItem = {
      type: product.product_type,
      description: product.name,
      quantity: 1,
      unit_price: product.sale_price || product.cost_price || 0,
      total: product.sale_price || product.cost_price || 0,
      inventory_id: product.id,
      product_images: product.images || [],
      product_details: product.details || {},
      destination_data: product.destination
        ? {
            name: product.destination.name,
            description: product.destination.description,
            image_url: product.destination.image_url,
            highlights: product.destination.highlights,
            tags: product.destination.tags,
          }
        : null,
      provider_data: product.provider
        ? {
            name: product.provider.name,
            logo_url: product.provider.logo_url,
            rating: product.provider.rating,
          }
        : null,
    };
    onAddItem(enrichedItem);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[900px] overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-xl font-bold text-foreground">
            Seleccionar Producto del Inventario
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Busca y agrega productos del inventario a tu cotización
          </p>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/50 px-6 py-3">
          {/* Search */}
          <div className="relative flex-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre, destino, proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full rounded border border-border bg-white pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Type filters */}
          <div className="flex flex-wrap gap-1.5">
            {PRODUCT_TYPES.map((pt) => (
              <button
                key={pt.value}
                type="button"
                onClick={() => setTypeFilter(pt.value)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  typeFilter === pt.value
                    ? "bg-primary text-white"
                    : "border border-border bg-white text-muted-foreground hover:bg-muted"
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="overflow-y-auto px-6 py-4" style={{ maxHeight: "calc(90vh - 200px)" }}>
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-lg border border-border"
                >
                  <div className="aspect-[3/2] bg-muted" />
                  <div className="space-y-2 p-4">
                    <div className="h-3 w-16 rounded bg-muted" />
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                    <div className="flex justify-between pt-2">
                      <div className="h-5 w-20 rounded bg-muted" />
                      <div className="h-7 w-16 rounded bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="mb-4 text-muted-foreground/50"
              >
                <path d="m21 21-4.3-4.3" />
                <circle cx="11" cy="11" r="8" />
              </svg>
              <p className="text-sm font-medium text-muted-foreground">
                No se encontraron productos
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Intenta con otros términos de búsqueda o filtros
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <InventoryProductCard
                  key={product.id}
                  product={product}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
