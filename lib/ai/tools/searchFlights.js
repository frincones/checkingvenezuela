/**
 * Tool: búsqueda de vuelos en el catálogo de servicios.
 * Usa catalog_services tipo 'flight' o tabla flights si existe.
 */

import { tool } from "ai";
import { z } from "zod";
import { admin } from "./_admin.js";

export const searchFlightsTool = tool({
  description:
    "Busca vuelos disponibles. Úsala cuando el usuario quiera comprar un vuelo, " +
    "consultar precios o disponibilidad entre ciudades.",
  inputSchema: z.object({
    origin: z.string().optional().describe("Ciudad o aeropuerto de origen"),
    destination: z.string().optional().describe("Ciudad o aeropuerto de destino"),
    maxPrice: z.number().positive().optional().describe("Precio máximo USD"),
    limit: z.number().int().min(1).max(10).optional().describe("Máximo resultados (default 5)"),
  }),
  execute: async ({ origin, destination, maxPrice, limit = 5 }) => {
    try {
      const sb = admin();

      // Intentar tabla flights primero
      let q = sb
        .from("flights")
        .select("id, flight_number, airline, departure_city, arrival_city, departure_date, price, available_seats")
        .limit(limit);
      if (origin) q = q.ilike("departure_city", `%${origin}%`);
      if (destination) q = q.ilike("arrival_city", `%${destination}%`);
      if (maxPrice) q = q.lte("price", maxPrice);
      q = q.gt("available_seats", 0).order("departure_date", { ascending: true });

      const { data, error } = await q;
      if (error && error.code !== "42P01" && error.code !== "PGRST205") {
        return { ok: false, error: error.message, results: [] };
      }

      if (data && data.length > 0) {
        return {
          ok: true,
          source: "flights",
          count: data.length,
          results: data.map((f) => ({
            id: f.id,
            flightNumber: f.flight_number,
            airline: f.airline,
            from: f.departure_city,
            to: f.arrival_city,
            date: f.departure_date,
            price: f.price,
            currency: "USD",
            availableSeats: f.available_seats,
          })),
        };
      }

      // Fallback a catalog_services
      let cq = sb
        .from("catalog_services")
        .select("id, slug, name, short_description, base_price, currency, metadata")
        .eq("type", "flight")
        .limit(limit);
      if (origin || destination) {
        const term = `%${destination || origin}%`;
        cq = cq.or(`name.ilike.${term},short_description.ilike.${term}`);
      }
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
