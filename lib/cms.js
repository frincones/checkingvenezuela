import { createClient } from "@/lib/db/supabase/server";

/**
 * CMS Data Functions
 * Funciones para obtener datos del CMS desde la base de datos
 */

/**
 * Obtiene servicios activos desde la BD
 * Retorna formato compatible con servicesConfig
 */
export async function getServicesFromDB() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("catalog_services")
    .select("*")
    .in("status", ["active", "coming_soon"])
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error fetching services:", error);
    return [];
  }

  // Transformar a formato compatible con componentes existentes
  return data.map((service) => ({
    id: service.slug,
    name: service.name,
    description: service.description,
    icon: service.icon, // campo 'icon' en la BD
    enabled: true,
    hasOnlinePurchase: service.has_online_purchase,
    hasQuoteRequest: service.has_quote_request,
    href: service.href || "#",
    comingSoon: service.status === "coming_soon",
  }));
}

/**
 * Obtiene categorías de destinos con sus destinos activos
 * Retorna formato compatible con venezuelaDestinations
 */
export async function getCategoriesWithDestinationsFromDB() {
  const supabase = await createClient();

  // Obtener categorías activas
  const { data: categories, error: catError } = await supabase
    .from("destination_categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (catError) {
    console.error("Error fetching categories:", catError);
    return [];
  }

  // Obtener destinos activos
  const { data: destinations, error: destError } = await supabase
    .from("destinations")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (destError) {
    console.error("Error fetching destinations:", destError);
    return [];
  }

  // Agrupar destinos por categoría
  return categories.map((category) => ({
    id: category.slug,
    name: category.name,
    subtitle: category.subtitle || "",
    icon: category.icon || "Compass", // campo 'icon' en la BD
    destinations: destinations
      .filter((d) => d.category_id === category.id)
      .map((dest) => ({
        id: dest.slug,
        name: dest.name,
        shortName: dest.name, // usar name como shortName
        description: dest.description || "",
        image: dest.image_url || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop",
        tags: dest.tags || [],
        highlights: dest.highlights || [],
      })),
  }));
}

/**
 * Obtiene destinos destacados (is_featured = true)
 */
export async function getFeaturedDestinationsFromDB() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("destinations")
    .select(`
      *,
      category:destination_categories(name, slug)
    `)
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error fetching featured destinations:", error);
    return [];
  }

  return data.map((dest) => ({
    id: dest.slug,
    name: dest.name,
    shortName: dest.short_name || dest.name,
    description: dest.short_description || dest.description || "",
    image: dest.image_url || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop",
    country: dest.country,
    category: dest.category?.name || "General",
    tags: dest.tags || [],
    highlights: dest.highlights || [],
  }));
}

/**
 * Obtiene destinos por tipo (para secciones de vuelos/hoteles)
 */
export async function getDestinationsByTypeFromDB(type) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("destinations")
    .select(`
      *,
      category:destination_categories(name, slug)
    `)
    .eq("is_active", true)
    .eq("destination_type", type)
    .order("display_order", { ascending: true })
    .limit(6);

  if (error) {
    console.error(`Error fetching ${type} destinations:`, error);
    return [];
  }

  return data.map((dest) => ({
    id: dest.slug,
    name: dest.name,
    shortName: dest.short_name || dest.name,
    description: dest.short_description || dest.description || "",
    image: dest.image_url || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop",
    country: dest.country,
    tags: dest.tags || [],
  }));
}
