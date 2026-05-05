/**
 * Tool: búsqueda directa sobre tabla destinations.
 * Útil cuando el usuario menciona un destino específico.
 */

import { tool } from "ai";
import { z } from "zod";
import { admin } from "./_admin.js";

export const searchDestinationsTool = tool({
  description:
    "Busca destinos turísticos en el catálogo de Venezuela Voyages. " +
    "Úsala cuando el usuario mencione un destino específico (Los Roques, Margarita, Canaima, Mérida, etc.) " +
    "o pregunte por destinos por país/categoría.",
  inputSchema: z
    .object({
      query: z
        .string()
        .min(1)
        .describe("Nombre del destino, ciudad, o palabra clave (ej: 'playa', 'aventura', 'caribe')"),
      country: z.string().optional().describe("Filtro por país"),
      limit: z.number().int().min(1).max(10).optional().describe("Máximo de resultados (default 5)"),
    })
    .passthrough(),
  execute: async ({ query, country, limit = 5 }) => {
    try {
      const sb = admin();
      let q = sb
        .from("destinations")
        .select(
          "id, name, slug, country, city, short_description, description, tags, highlights, gallery, pricing"
        )
        .limit(limit);

      // Búsqueda por nombre/ciudad/descripción usando ilike
      const pattern = `%${query}%`;
      q = q.or(
        `name.ilike.${pattern},city.ilike.${pattern},short_description.ilike.${pattern}`
      );

      if (country) q = q.ilike("country", `%${country}%`);

      const { data, error } = await q;
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") {
          return { ok: false, error: "Tabla destinations no existe", results: [] };
        }
        return { ok: false, error: error.message, results: [] };
      }

      // Dedupe por slug (a veces hay varias rows del mismo destino con
      // pequeñas variantes — el modelo lo escribiría 2 veces y confunde)
      const seen = new Set();
      const results = [];
      for (const d of data || []) {
        const key = (d.slug || d.name || "").toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        results.push({
          id: d.id,
          name: d.name,
          slug: d.slug,
          location: [d.city, d.country].filter(Boolean).join(", "),
          summary: d.short_description || (d.description ? d.description.slice(0, 200) : ""),
          highlights: Array.isArray(d.highlights) ? d.highlights.slice(0, 5) : [],
          tags: Array.isArray(d.tags) ? d.tags : [],
          // priceFrom DELIBERADAMENTE OMITIDO: destinations no tiene precios
          // reales. Si el modelo necesita precios debe llamar searchPackages.
          // (Antes mandábamos null aquí y el modelo escribía "$XXX")
          url: d.slug ? `/destinations/${d.slug}` : null,
        });
      }

      return { ok: true, count: results.length, results };
    } catch (err) {
      return { ok: false, error: err.message, results: [] };
    }
  },
});
