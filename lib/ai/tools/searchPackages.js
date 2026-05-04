/**
 * Tool: búsqueda de paquetes/productos en service_inventory.
 * Es la tabla real de productos vendibles (con sale_price + sku + valid dates).
 */

import { tool } from "ai";
import { z } from "zod";
import { admin } from "./_admin.js";

export const searchPackagesTool = tool({
  description:
    "Busca paquetes turísticos y productos disponibles para venta. " +
    "Úsala cuando el usuario quiera ver opciones de viaje, cotizar un paquete, " +
    "o conocer qué incluye un producto específico. Devuelve precios cuando están publicados.",
  inputSchema: z
    .object({
      query: z.string().optional().describe("Palabra clave en nombre o descripción"),
      destination: z
        .string()
        .optional()
        .describe(
          "Nombre del destino (ej: 'margarita', 'roques', 'mérida'). Coincide parcial."
        ),
      productType: z
        .string()
        .optional()
        .describe("Tipo: 'package', 'tour', 'transfer', 'flight'. Omite si no estás seguro."),
      maxPrice: z.number().positive().optional().describe("Precio máximo USD"),
      limit: z.number().int().min(1).max(10).optional().describe("Máximo resultados (default 5)"),
    })
    .passthrough(),
  execute: async ({ query, destination, productType, maxPrice, limit = 5 }) => {
    try {
      const sb = admin();

      let q = sb
        .from("service_inventory")
        .select(
          `id, name, sku, description, product_type, sale_price, currency,
           valid_from, valid_until, is_featured, images,
           service:catalog_services(name, slug, href),
           destination:destinations(name, slug, city, country)`
        )
        .eq("status", "available")
        .eq("is_published", true)
        .order("is_featured", { ascending: false })
        .order("display_order", { ascending: true })
        .limit(limit);

      // Búsqueda por keyword en nombre/descripción O en el destino vinculado
      const searchTerms = [];
      if (query) searchTerms.push(query);
      if (destination) searchTerms.push(destination);
      if (searchTerms.length > 0) {
        const orParts = [];
        for (const term of searchTerms) {
          const pattern = `%${term}%`;
          orParts.push(`name.ilike.${pattern}`);
          orParts.push(`description.ilike.${pattern}`);
        }
        q = q.or(orParts.join(","));
      }

      if (productType) q = q.eq("product_type", productType);
      if (maxPrice) q = q.lte("sale_price", maxPrice);

      const { data, error } = await q;
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") {
          return { ok: true, source: "none", count: 0, results: [] };
        }
        return { ok: false, error: error.message, results: [] };
      }

      const results = (data || []).map((s) => ({
        id: s.id,
        name: s.name,
        sku: s.sku,
        category: s.service?.name || s.product_type,
        productType: s.product_type,
        destination: s.destination
          ? `${s.destination.name}${s.destination.city ? " (" + s.destination.city + ")" : ""}`
          : null,
        destinationSlug: s.destination?.slug,
        summary: s.description?.slice(0, 250) || "",
        price: s.sale_price,
        currency: s.currency || "USD",
        validUntil: s.valid_until,
        isFeatured: s.is_featured,
        firstImage: Array.isArray(s.images) && s.images.length > 0 ? s.images[0] : null,
        url:
          s.destination?.slug && (s.service?.slug || "").includes("package")
            ? `/packages/${s.destination.slug}`
            : s.service?.href || null,
      }));

      return {
        ok: true,
        source: "service_inventory",
        count: results.length,
        results,
      };
    } catch (err) {
      return { ok: false, error: err.message, results: [] };
    }
  },
});
