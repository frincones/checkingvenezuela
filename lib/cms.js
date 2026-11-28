import { createClient } from "@/lib/db/supabase/server";
import { isPgFallbackEnabled } from "@/lib/db/pg/client";
import { createPgShimClient } from "@/lib/db/pg/restShim";

/**
 * CMS Data Functions
 * Funciones para obtener datos del CMS desde la base de datos
 */

/**
 * Cliente de SOLO LECTURA para el contenido publico del CMS.
 *
 * POR QUE EXISTE
 * ==============
 * Supabase restringio el proyecto por egress el 2026-11-27 y devuelve HTTP 402
 * en todos sus servicios HTTP, PostgREST incluido. `createClient()` habla por
 * PostgREST, de modo que las cuatro funciones de este fichero fallaban y la
 * home caia a su contenido estatico de respaldo: 4 destinos genericos, sin
 * enlaces, en lugar de los 19 reales. La base SI acepta conexiones por el
 * pooler, que es lo que usa el adaptador.
 *
 * POR QUE AQUI Y NO EN createClient()
 * ===================================
 * `createClient()` lo usan 72 ficheros y 64 de ellos llaman a `.auth`, que el
 * adaptador no implementa: cambiarlo de forma global romperia el inicio de
 * sesion y la puerta de contingencia. Este fichero, en cambio, solo hace
 * lecturas `.from()` de contenido publico —sin `.auth`, `.storage` ni `.rpc`—,
 * asi que el adaptador lo cubre por completo.
 *
 * EFECTO SECUNDARIO DESEADO
 * =========================
 * `createClient()` llama a `cookies()`, lo que fuerza render dinamico y deja la
 * home sin cachear (`no-store`). Sin esa llamada, la home puede aprovechar su
 * `revalidate = 300`, lo que reduce el egress: la causa del problema original.
 *
 * OJO: el adaptador se conecta como rol `postgres` y NO aplica RLS. Las
 * consultas de este fichero filtran en codigo lo mismo que las politicas
 * `Public read ...` garantizaban (ver el filtro de `status` en el conteo de
 * paquetes), de modo que el resultado es el mismo que veia un visitante anonimo.
 * Cualquier consulta nueva que se añada aqui debe mantener ese filtrado.
 *
 * Se retira solo: al quitar PG_FALLBACK_ENABLED vuelve a `createClient()`.
 * Ver REVERTIR.md.
 */
async function createCmsReadClient() {
  if (isPgFallbackEnabled()) {
    return createPgShimClient();
  }
  return createClient();
}

/**
 * Obtiene servicios activos desde la BD
 * Retorna formato compatible con servicesConfig
 */
export async function getServicesFromDB() {
  const supabase = await createCmsReadClient();

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
  const supabase = await createCmsReadClient();

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

  // Obtener conteo de paquetes publicados por destino
  //
  // El filtro de `status` no es decorativo: la politica RLS
  // `Public read available inventory` exigia `is_published = true AND status <>
  // 'discontinued'`, y el adaptador Postgres no aplica RLS. Sin esta linea, un
  // paquete descontinuado al que se olvidase quitar `is_published` se contaria
  // y el boton "View packages (N)" llevaria a una lista mas corta que N.
  // Hoy no hay ninguno en ese estado; el filtro evita que aparezca manana.
  const destinationIds = destinations.map((d) => d.id);
  let packageCounts = {};
  if (destinationIds.length > 0) {
    const { data: countData, error: countError } = await supabase
      .from("service_inventory")
      .select("destination_id")
      .eq("product_type", "package")
      .eq("is_published", true)
      .neq("status", "discontinued")
      .in("destination_id", destinationIds);

    if (!countError && countData) {
      packageCounts = countData.reduce((acc, item) => {
        acc[item.destination_id] = (acc[item.destination_id] || 0) + 1;
        return acc;
      }, {});
    }
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
        dbId: dest.id,
        slug: dest.slug,
        name: dest.name,
        shortName: dest.name, // usar name como shortName
        description: dest.description || "",
        image: dest.image_url || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop",
        tags: dest.tags || [],
        highlights: dest.highlights || [],
        packageCount: packageCounts[dest.id] || 0,
      })),
  }));
}

/**
 * Obtiene destinos destacados (is_featured = true)
 */
export async function getFeaturedDestinationsFromDB() {
  const supabase = await createCmsReadClient();

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
  const supabase = await createCmsReadClient();

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
