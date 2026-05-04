/**
 * Parser que extrae documentos textuales desde tablas existentes
 * (destinations, catalog_services, packages) para alimentar el RAG.
 */

import { createClient } from "@supabase/supabase-js";

let _client = null;
function admin() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _client;
}

/**
 * Extrae destinos como documentos textuales para indexar.
 * Cada destino → 1 documento con título + descripción + highlights + tags.
 */
export async function extractDestinations() {
  const sb = admin();
  const { data, error } = await sb
    .from("destinations")
    .select("id, name, slug, description, short_description, country, city, tags, highlights, pricing")
    .limit(500);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }

  return (data || []).map((d) => {
    const parts = [];
    parts.push(`Destino: ${d.name}`);
    if (d.country || d.city) {
      parts.push(`Ubicación: ${[d.city, d.country].filter(Boolean).join(", ")}`);
    }
    if (d.short_description) parts.push(d.short_description);
    if (d.description) parts.push(d.description);
    if (Array.isArray(d.highlights) && d.highlights.length) {
      parts.push("Highlights:\n- " + d.highlights.join("\n- "));
    }
    if (Array.isArray(d.tags) && d.tags.length) {
      parts.push("Categorías: " + d.tags.join(", "));
    }
    if (d.pricing && typeof d.pricing === "object") {
      const pricing = JSON.stringify(d.pricing);
      parts.push(`Información de precios: ${pricing}`);
    }
    return {
      title: `Destino: ${d.name}`,
      content: parts.join("\n\n"),
      metadata: {
        destination_id: d.id,
        slug: d.slug,
        country: d.country,
        city: d.city,
      },
    };
  });
}

/**
 * Extrae catálogo de servicios (paquetes, tours, traslados, etc.)
 */
export async function extractCatalogServices() {
  const sb = admin();
  const { data, error } = await sb
    .from("catalog_services")
    .select("id, slug, type, name, description, short_description, base_price, currency, duration_days, included, excluded, metadata")
    .limit(500);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }

  return (data || []).map((s) => {
    const parts = [];
    parts.push(`Servicio: ${s.name} (${s.type})`);
    if (s.short_description) parts.push(s.short_description);
    if (s.description) parts.push(s.description);
    if (s.duration_days) parts.push(`Duración: ${s.duration_days} días`);
    if (s.base_price != null) {
      parts.push(`Precio base: ${s.base_price} ${s.currency || "USD"}`);
    }
    if (Array.isArray(s.included) && s.included.length) {
      parts.push("Incluye:\n- " + s.included.join("\n- "));
    }
    if (Array.isArray(s.excluded) && s.excluded.length) {
      parts.push("No incluye:\n- " + s.excluded.join("\n- "));
    }
    return {
      title: `${s.type}: ${s.name}`,
      content: parts.join("\n\n"),
      metadata: {
        service_id: s.id,
        slug: s.slug,
        type: s.type,
        base_price: s.base_price,
        currency: s.currency,
      },
    };
  });
}

/**
 * Extrae paquetes turísticos detallados (si la tabla existe).
 */
export async function extractPackages() {
  const sb = admin();
  const { data, error } = await sb
    .from("packages")
    .select("id, slug, name, description, summary, price, currency, duration, includes, itinerary, destinations, metadata")
    .limit(500);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    // Otros errores los logueamos pero seguimos
    console.warn("[extractPackages] error:", error.message);
    return [];
  }

  return (data || []).map((p) => {
    const parts = [];
    parts.push(`Paquete: ${p.name}`);
    if (p.summary) parts.push(p.summary);
    if (p.description) parts.push(p.description);
    if (p.duration) parts.push(`Duración: ${p.duration}`);
    if (p.price != null) parts.push(`Precio: ${p.price} ${p.currency || "USD"}`);
    if (Array.isArray(p.includes) && p.includes.length) {
      parts.push("Incluye:\n- " + p.includes.join("\n- "));
    }
    if (Array.isArray(p.destinations) && p.destinations.length) {
      parts.push(`Destinos: ${p.destinations.join(", ")}`);
    }
    if (p.itinerary) {
      parts.push(`Itinerario: ${typeof p.itinerary === "string" ? p.itinerary : JSON.stringify(p.itinerary)}`);
    }
    return {
      title: `Paquete: ${p.name}`,
      content: parts.join("\n\n"),
      metadata: {
        package_id: p.id,
        slug: p.slug,
        price: p.price,
        currency: p.currency,
      },
    };
  });
}
