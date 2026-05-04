/**
 * Parser que extrae documentos textuales desde tablas existentes
 * (destinations, catalog_services, service_inventory, hotels) para alimentar el RAG.
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
 */
export async function extractDestinations() {
  const sb = admin();
  const { data, error } = await sb
    .from("destinations")
    .select(
      "id, name, slug, description, short_description, country, city, tags, highlights, pricing"
    )
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
      parts.push(`Información de precios: ${JSON.stringify(d.pricing)}`);
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
 * Extrae el catálogo de tipos de servicio (Hoteles, Paquetes, Vuelos, etc.)
 * Es información estructural — describe QUÉ servicios ofrece la agencia.
 */
export async function extractCatalogServices() {
  const sb = admin();
  const { data, error } = await sb
    .from("catalog_services")
    .select(
      "id, slug, name, description, icon, status, has_online_purchase, has_quote_request, href"
    )
    .eq("status", "active")
    .order("display_order", { ascending: true });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }

  return (data || []).map((s) => {
    const parts = [];
    parts.push(`Categoría de servicio: ${s.name}`);
    if (s.description) parts.push(s.description);
    if (s.has_online_purchase) parts.push("Disponible para compra online directa.");
    if (s.has_quote_request) parts.push("Disponible vía solicitud de cotización con asesor.");
    if (s.href) parts.push(`Enlace en el sitio: ${s.href}`);
    return {
      title: `Servicio: ${s.name}`,
      content: parts.join("\n\n"),
      metadata: {
        service_id: s.id,
        slug: s.slug,
      },
    };
  });
}

/**
 * Extrae el inventario REAL de productos (paquetes, tours, etc.).
 * Esta es la tabla con precios y descripciones de productos vendibles.
 */
export async function extractServiceInventory() {
  const sb = admin();
  const { data, error } = await sb
    .from("service_inventory")
    .select(
      `id, name, sku, description, product_type, cost_price, sale_price, currency,
       pricing_details, quantity_available, valid_from, valid_until, details, is_featured,
       service:catalog_services(name, slug),
       destination:destinations(name, slug, city, country)`
    )
    .eq("status", "available")
    .eq("is_published", true)
    .limit(500);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }

  return (data || []).map((s) => {
    const parts = [];
    const category = s.service?.name || s.product_type || "Producto";
    parts.push(`${category}: ${s.name}`);
    if (s.sku) parts.push(`SKU: ${s.sku}`);
    if (s.destination) {
      parts.push(
        `Destino: ${s.destination.name}${s.destination.city ? " (" + s.destination.city + ")" : ""}`
      );
    }
    if (s.description) parts.push(s.description);
    if (s.sale_price != null) {
      parts.push(`Precio: ${s.sale_price} ${s.currency || "USD"}`);
    }
    if (s.valid_from || s.valid_until) {
      parts.push(
        `Disponible: ${s.valid_from || "?"} → ${s.valid_until || "sin fecha límite"}`
      );
    }
    if (s.pricing_details) {
      parts.push(`Detalles de precio: ${JSON.stringify(s.pricing_details).slice(0, 500)}`);
    }
    if (s.details) {
      const details = typeof s.details === "string" ? s.details : JSON.stringify(s.details);
      parts.push(`Detalles: ${details.slice(0, 1000)}`);
    }
    return {
      title: `${category}: ${s.name}`,
      content: parts.join("\n\n"),
      metadata: {
        inventory_id: s.id,
        sku: s.sku,
        product_type: s.product_type,
        sale_price: s.sale_price,
        currency: s.currency,
        service_slug: s.service?.slug,
        destination_slug: s.destination?.slug,
      },
    };
  });
}

/**
 * Mantiene compatibilidad con extractPackages — reusa service_inventory.
 */
export async function extractPackages() {
  return extractServiceInventory();
}

/**
 * Extrae hoteles del catálogo.
 */
export async function extractHotels() {
  const sb = admin();
  const { data, error } = await sb
    .from("hotels")
    .select(
      "id, slug, name, description, category, address_city, address_country, address_state, amenities, features, tags, total_rooms, status, is_deleted"
    )
    .eq("is_deleted", false)
    .limit(200);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }

  return (data || []).map((h) => {
    const parts = [];
    parts.push(`Hotel: ${h.name}`);
    const loc = [h.address_city, h.address_state, h.address_country].filter(Boolean).join(", ");
    if (loc) parts.push(`Ubicación: ${loc}`);
    if (h.category) parts.push(`Categoría: ${h.category}`);
    if (h.description) parts.push(h.description);
    if (Array.isArray(h.amenities) && h.amenities.length) {
      parts.push("Amenities: " + h.amenities.join(", "));
    }
    if (Array.isArray(h.features) && h.features.length) {
      parts.push("Características: " + h.features.join(", "));
    }
    if (Array.isArray(h.tags) && h.tags.length) {
      parts.push("Etiquetas: " + h.tags.join(", "));
    }
    if (h.total_rooms) parts.push(`Habitaciones totales: ${h.total_rooms}`);
    return {
      title: `Hotel: ${h.name}`,
      content: parts.join("\n\n"),
      metadata: {
        hotel_id: h.id,
        slug: h.slug,
        city: h.address_city,
        country: h.address_country,
      },
    };
  });
}
