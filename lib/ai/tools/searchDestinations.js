/**
 * Tool: búsqueda directa sobre tabla destinations.
 * Útil cuando el usuario menciona un destino específico.
 */

import { tool } from "ai";
import { z } from "zod";
import { admin } from "./_admin.js";

export const searchDestinationsTool = tool({
  description: [
    "Lista los destinos turísticos del catálogo de Venezuela Voyages (info, NO precios).",
    "USE WHEN: el cliente pregunta '¿qué destinos tienen?', '¿qué ofrecen?', 'qué",
    "  lugares puedo visitar', o pide info enciclopédica de un destino (atracciones,",
    "  highlights, descripción). También cuando NO hay intención clara de compra aún.",
    "DO NOT USE: cuando el cliente pide PRECIOS o COTIZAR — esa es searchPackages.",
    "  Esta tool NO devuelve precios y emitirlos sería invención.",
    "  Tampoco la uses para destinos fuera de Venezuela.",
    "EXAMPLE: 'qué destinos tienen?' → searchDestinations({}) (query opcional).",
    "  'cuéntame de Canaima' → searchDestinations({ query: 'Canaima' }).",
    "RETURNS: { ok, count, results: [{name, location, summary, highlights[], tags[], url}] }.",
    "  IMPORTANTE: results NO incluye 'price' ni 'priceFrom'. Si el cliente quiere",
    "  precio, llama searchPackages después de mostrar el destino.",
  ].join("\n"),
  inputSchema: z
    .object({
      query: z
        .string()
        .optional()
        .describe(
          "Nombre del destino, ciudad o palabra clave (ej: 'playa', 'aventura', 'caribe'). " +
            "OMITE este parámetro si el cliente pide ver TODOS los destinos disponibles " +
            "('qué destinos tienen', 'qué ofrecen', 'lista de lugares')."
        ),
      country: z.string().optional().describe("Filtro por país"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Máximo de resultados (default 5, hasta 20 si pidieron lista completa)"),
    })
    .passthrough(),
  execute: async ({ query, country, limit = 5 }) => {
    try {
      const sb = admin();
      // Términos vacíos / genéricos que el modelo a veces manda y NO se
      // deben tratar como filtro (matchearían 0 destinos). Cuando llegan,
      // listamos TODO el catálogo.
      const isCatalogQuery =
        !query ||
        !query.trim() ||
        /^(destino|destinos|todos|todo|lista|catalogo|cat[aá]logo|venezuela|all|everything)$/i.test(
          query.trim()
        );

      let q = sb
        .from("destinations")
        .select(
          "id, name, slug, country, city, short_description, description, tags, highlights, gallery, pricing"
        )
        .limit(isCatalogQuery ? Math.max(limit, 10) : limit);

      // Solo aplicamos el filtro ilike cuando hay un query real, no genérico.
      if (!isCatalogQuery) {
        const pattern = `%${query}%`;
        q = q.or(
          `name.ilike.${pattern},city.ilike.${pattern},short_description.ilike.${pattern}`
        );
      }

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
