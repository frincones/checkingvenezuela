/**
 * Tool: búsqueda de hoteles.
 * Usa tabla hotels si existe, sino catalog_services tipo 'hotel'.
 */

import { tool } from "ai";
import { z } from "zod";
import { admin } from "./_admin.js";

export const searchHotelsTool = tool({
  description:
    "Busca hoteles disponibles. Úsala cuando el usuario quiera reservar alojamiento, " +
    "consultar precios o ver opciones en una ciudad/destino.",
  inputSchema: z.object({
    location: z.string().optional().describe("Ciudad o destino"),
    maxPrice: z.number().positive().optional().describe("Precio máximo por noche en USD"),
    minRating: z.number().min(1).max(5).optional().describe("Rating mínimo (1-5)"),
    limit: z.number().int().min(1).max(10).optional().describe("Máximo resultados (default 5)"),
  }),
  execute: async ({ location, maxPrice, minRating, limit = 5 }) => {
    try {
      const sb = admin();

      let q = sb
        .from("hotels")
        .select("id, slug, name, location, description, price_per_night, rating, amenities, images")
        .limit(limit);
      if (location) q = q.ilike("location", `%${location}%`);
      if (maxPrice) q = q.lte("price_per_night", maxPrice);
      if (minRating) q = q.gte("rating", minRating);

      const { data, error } = await q;
      if (error && error.code !== "42P01" && error.code !== "PGRST205") {
        return { ok: false, error: error.message, results: [] };
      }

      if (data && data.length > 0) {
        return {
          ok: true,
          source: "hotels",
          count: data.length,
          results: data.map((h) => ({
            id: h.id,
            name: h.name,
            slug: h.slug,
            location: h.location,
            summary: h.description?.slice(0, 200) || "",
            pricePerNight: h.price_per_night,
            currency: "USD",
            rating: h.rating,
            amenities: Array.isArray(h.amenities) ? h.amenities.slice(0, 5) : [],
            url: h.slug ? `/hotels/${h.slug}` : null,
          })),
        };
      }

      // Fallback catalog_services
      let cq = sb
        .from("catalog_services")
        .select("id, slug, name, short_description, base_price, currency, metadata")
        .eq("type", "hotel")
        .limit(limit);
      if (location) cq = cq.ilike("name", `%${location}%`);
      if (maxPrice) cq = cq.lte("base_price", maxPrice);

      const { data: cs, error: cErr } = await cq;
      if (cErr) {
        if (cErr.code === "42P01" || cErr.code === "PGRST205") {
          return { ok: true, source: "none", count: 0, results: [] };
        }
        return { ok: false, error: cErr.message, results: [] };
      }

      return {
        ok: true,
        source: "catalog_services",
        count: cs.length,
        results: cs.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          summary: s.short_description,
          priceFrom: s.base_price,
          currency: s.currency || "USD",
        })),
      };
    } catch (err) {
      return { ok: false, error: err.message, results: [] };
    }
  },
});
