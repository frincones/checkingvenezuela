/**
 * Tool: búsqueda de paquetes turísticos.
 * Usa la tabla `packages` o, si no existe, `catalog_services` filtrando por tipo='package'.
 */

import { tool } from "ai";
import { z } from "zod";
import { admin } from "./_admin.js";

export const searchPackagesTool = tool({
  description:
    "Busca paquetes turísticos disponibles. Úsala cuando el usuario quiera ver opciones de viaje, " +
    "cotizar un paquete, o conocer qué incluye un paquete específico.",
  inputSchema: z.object({
    query: z.string().optional().describe("Palabra clave o destino del paquete"),
    destination: z.string().optional().describe("Destino específico"),
    minDays: z.number().int().min(1).optional().describe("Duración mínima en días"),
    maxDays: z.number().int().max(60).optional().describe("Duración máxima en días"),
    maxPrice: z.number().positive().optional().describe("Precio máximo USD"),
    limit: z.number().int().min(1).max(10).optional().describe("Máximo resultados (default 5)"),
  }),
  execute: async ({ query, destination, minDays, maxDays, maxPrice, limit = 5 }) => {
    try {
      const sb = admin();

      // Intentar tabla `packages` primero
      let pkgs = await tryPackagesTable({ sb, query, destination, minDays, maxDays, maxPrice, limit });
      if (pkgs.attempted && pkgs.results.length > 0) return pkgs;

      // Fallback a catalog_services tipo 'package'
      let q = sb
        .from("catalog_services")
        .select(
          "id, slug, type, name, short_description, description, base_price, currency, duration_days, included, metadata"
        )
        .eq("type", "package")
        .limit(limit);
      if (query) q = q.ilike("name", `%${query}%`);
      if (maxPrice) q = q.lte("base_price", maxPrice);
      if (minDays) q = q.gte("duration_days", minDays);
      if (maxDays) q = q.lte("duration_days", maxDays);

      const { data, error } = await q;
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") {
          return { ok: false, error: "No hay tabla de paquetes disponible", results: [] };
        }
        return { ok: false, error: error.message, results: [] };
      }

      const results = (data || []).map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        summary: s.short_description || (s.description?.slice(0, 200) || ""),
        durationDays: s.duration_days,
        priceFrom: s.base_price,
        currency: s.currency || "USD",
        includes: Array.isArray(s.included) ? s.included.slice(0, 5) : [],
        url: s.slug ? `/packages/${s.slug}` : null,
      }));

      return { ok: true, count: results.length, source: "catalog_services", results };
    } catch (err) {
      return { ok: false, error: err.message, results: [] };
    }
  },
});

async function tryPackagesTable({ sb, query, destination, minDays, maxDays, maxPrice, limit }) {
  let q = sb
    .from("packages")
    .select("id, slug, name, summary, description, price, currency, duration, includes, destinations")
    .limit(limit);
  if (query) q = q.ilike("name", `%${query}%`);
  if (destination) {
    q = q.or(`name.ilike.%${destination}%,description.ilike.%${destination}%`);
  }
  if (maxPrice) q = q.lte("price", maxPrice);

  const { data, error } = await q;
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { ok: true, attempted: false, results: [] };
    }
    return { ok: false, attempted: true, error: error.message, results: [] };
  }

  const results = (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    summary: p.summary || (p.description?.slice(0, 200) || ""),
    duration: p.duration,
    priceFrom: p.price,
    currency: p.currency || "USD",
    includes: Array.isArray(p.includes) ? p.includes.slice(0, 5) : [],
    destinations: Array.isArray(p.destinations) ? p.destinations : [],
    url: p.slug ? `/packages/${p.slug}` : null,
  }));

  return { ok: true, attempted: true, count: results.length, source: "packages", results };
}
