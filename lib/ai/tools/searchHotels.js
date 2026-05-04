/**
 * Tool: búsqueda de hoteles del catálogo `hotels`.
 * Schema real: address_city / address_country / amenities / category / status.
 * Los precios viven en service_inventory (no en hotels), por eso esta tool
 * devuelve metadata + apunta al asesor para precios actualizados.
 */

import { tool } from "ai";
import { z } from "zod";
import { admin } from "./_admin.js";

export const searchHotelsTool = tool({
  description:
    "Busca hoteles del catálogo de Venezuela Voyages. " +
    "Úsala cuando el usuario quiera reservar alojamiento o ver opciones en una ciudad/destino. " +
    "Los precios exactos los confirmará el asesor humano.",
  inputSchema: z
    .object({
      location: z.string().optional().describe("Ciudad o destino (ej: 'Caracas', 'Margarita')"),
      category: z.string().optional().describe("Categoría: 'lujo', 'boutique', 'familiar', etc."),
      limit: z.number().int().min(1).max(10).optional().describe("Máximo resultados (default 5)"),
    })
    .passthrough(),
  execute: async ({ location, category, limit = 5 }) => {
    try {
      const sb = admin();

      let q = sb
        .from("hotels")
        .select(
          "id, slug, name, description, category, address_city, address_state, address_country, amenities, features, tags, total_rooms"
        )
        .eq("is_deleted", false)
        .limit(limit);
      if (location) {
        const pattern = `%${location}%`;
        q = q.or(
          `address_city.ilike.${pattern},address_state.ilike.${pattern},address_country.ilike.${pattern}`
        );
      }
      if (category) q = q.ilike("category", `%${category}%`);

      const { data, error } = await q;
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") {
          return { ok: true, source: "none", count: 0, results: [] };
        }
        return { ok: false, error: error.message, results: [] };
      }

      return {
        ok: true,
        source: "hotels",
        count: data.length,
        results: (data || []).map((h) => ({
          id: h.id,
          name: h.name,
          slug: h.slug,
          location: [h.address_city, h.address_state, h.address_country]
            .filter(Boolean)
            .join(", "),
          category: h.category,
          summary: h.description?.slice(0, 250) || "",
          amenities: Array.isArray(h.amenities) ? h.amenities.slice(0, 6) : [],
          totalRooms: h.total_rooms,
          url: h.slug ? `/hotels/${h.slug}` : null,
          priceNote: "Consulta precios actualizados con un asesor",
        })),
      };
    } catch (err) {
      return { ok: false, error: err.message, results: [] };
    }
  },
});
