/**
 * Tool: búsqueda de vuelos en service_inventory donde product_type='flight'.
 * En este proyecto los vuelos son productos del inventario (no tabla `flights` directa).
 */

import { tool } from "ai";
import { z } from "zod";
import { admin } from "./_admin.js";

export const searchFlightsTool = tool({
  description: [
    "Busca VUELOS SUELTOS publicados (product_type='flight' en inventario).",
    "USE WHEN: el cliente quiere comprar UN VUELO solamente, sin paquete. Ej:",
    "  'quiero un vuelo Caracas-Miami', 'cuánto cuesta un vuelo a Margarita'.",
    "DO NOT USE: si el cliente pide un paquete que incluye vuelo+hotel+tour → usa",
    "  searchPackages. Si pide info general de aerolíneas/aeropuertos → searchKb.",
    "EXAMPLE: 'tienen vuelos a Mérida bajo 200 USD?' → searchFlights({ destination:",
    "  'Mérida', maxPrice: 200 }).",
    "RETURNS: { ok, count, results: [{name, origin, destination, price, currency, url}] }.",
    "  Para fechas/disponibilidad exactas, el asesor confirma con el GDS — sugerir",
    "  talkToHuman si el cliente necesita reserva inmediata con fecha específica.",
  ].join("\n"),
  inputSchema: z
    .object({
      origin: z.string().optional().describe("Ciudad de origen"),
      destination: z.string().optional().describe("Ciudad o destino"),
      maxPrice: z.number().positive().optional().describe("Precio máximo USD"),
      limit: z.number().int().min(1).max(10).optional().describe("Máximo resultados (default 5)"),
    })
    .passthrough(),
  execute: async ({ origin, destination, maxPrice, limit = 5 }) => {
    try {
      const sb = admin();

      let q = sb
        .from("service_inventory")
        .select(
          `id, name, sku, description, sale_price, currency, valid_from, valid_until,
           service:catalog_services(name, slug),
           destination:destinations(name, slug, city, country)`
        )
        .eq("product_type", "flight")
        .eq("status", "available")
        .eq("is_published", true)
        .limit(limit);

      if (origin || destination) {
        const term = `%${destination || origin}%`;
        q = q.or(`name.ilike.${term},description.ilike.${term}`);
      }
      if (maxPrice) q = q.lte("sale_price", maxPrice);

      const { data, error } = await q;
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") {
          return { ok: true, source: "none", count: 0, results: [] };
        }
        return { ok: false, error: error.message, results: [] };
      }

      // Si no hay vuelos como productos, devolver mensaje útil
      if (!data || data.length === 0) {
        return {
          ok: true,
          source: "none",
          count: 0,
          results: [],
          note:
            "No hay vuelos publicados como producto en el catálogo. " +
            "Sugiere al usuario que un asesor le coticen vuelos personalizados.",
        };
      }

      return {
        ok: true,
        source: "service_inventory",
        count: data.length,
        results: data.map((f) => ({
          id: f.id,
          name: f.name,
          sku: f.sku,
          summary: f.description?.slice(0, 250) || "",
          price: f.sale_price,
          currency: f.currency || "USD",
          destination: f.destination
            ? `${f.destination.name}${f.destination.city ? " (" + f.destination.city + ")" : ""}`
            : null,
          validUntil: f.valid_until,
        })),
      };
    } catch (err) {
      return { ok: false, error: err.message, results: [] };
    }
  },
});
