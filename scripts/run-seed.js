/**
 * Script para ejecutar el seed de datos en Supabase
 *
 * Ejecutar: node scripts/run-seed.js
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: Variables de entorno no configuradas");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkTables() {
  console.log("📊 Verificando tablas existentes...\n");

  const tables = [
    "profiles",
    "airports",
    "airlines",
    "hotels",
    "hotel_rooms",
    "promo_codes",
    "website_config",
    "analytics",
    "website_reviews",
  ];

  const results = {};

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      results[table] = `❌ Error: ${error.message}`;
    } else {
      results[table] = `✅ ${count || 0} registros`;
    }
  }

  console.log("Estado de tablas:");
  console.log("─".repeat(40));
  for (const [table, status] of Object.entries(results)) {
    console.log(`  ${table.padEnd(20)} ${status}`);
  }
  console.log("");

  return results;
}

async function seedAirports() {
  console.log("✈️  Insertando aeropuertos...");

  const airports = [
    {
      id: "CCS",
      iata_code: "CCS",
      name: "Aeropuerto Internacional Simón Bolívar",
      city: "Maiquetía",
      state: "La Guaira",
      country: "Venezuela",
      latitude: 10.6012,
      longitude: -66.9913,
      timezone: "America/Caracas",
      facilities: ["wifi", "restaurant", "atm", "car_rental"],
    },
    {
      id: "MAR",
      iata_code: "MAR",
      name: "Aeropuerto Internacional La Chinita",
      city: "Maracaibo",
      state: "Zulia",
      country: "Venezuela",
      latitude: 10.5582,
      longitude: -71.7279,
      timezone: "America/Caracas",
      facilities: ["wifi", "restaurant", "atm"],
    },
    {
      id: "PMV",
      iata_code: "PMV",
      name: "Aeropuerto Internacional del Caribe",
      city: "Porlamar",
      state: "Nueva Esparta",
      country: "Venezuela",
      latitude: 10.9126,
      longitude: -63.9664,
      timezone: "America/Caracas",
      facilities: ["wifi", "restaurant"],
    },
    {
      id: "CUN",
      iata_code: "CUN",
      name: "Aeropuerto Internacional de Cancún",
      city: "Cancún",
      state: "Quintana Roo",
      country: "México",
      latitude: 21.0365,
      longitude: -86.8771,
      timezone: "America/Cancun",
      facilities: ["wifi", "restaurant", "atm", "car_rental", "hotel_shuttle"],
    },
    {
      id: "PUJ",
      iata_code: "PUJ",
      name: "Aeropuerto Internacional de Punta Cana",
      city: "Punta Cana",
      state: "La Altagracia",
      country: "República Dominicana",
      latitude: 18.5674,
      longitude: -68.3634,
      timezone: "America/Santo_Domingo",
      facilities: ["wifi", "restaurant", "atm", "car_rental"],
    },
    {
      id: "MIA",
      iata_code: "MIA",
      name: "Aeropuerto Internacional de Miami",
      city: "Miami",
      state: "Florida",
      country: "Estados Unidos",
      latitude: 25.7959,
      longitude: -80.287,
      timezone: "America/New_York",
      facilities: ["wifi", "restaurant", "atm", "car_rental", "hotel_shuttle"],
    },
    {
      id: "BOG",
      iata_code: "BOG",
      name: "Aeropuerto Internacional El Dorado",
      city: "Bogotá",
      state: "Cundinamarca",
      country: "Colombia",
      latitude: 4.7016,
      longitude: -74.1469,
      timezone: "America/Bogota",
      facilities: ["wifi", "restaurant", "atm", "car_rental"],
    },
    {
      id: "PTY",
      iata_code: "PTY",
      name: "Aeropuerto Internacional de Tocumen",
      city: "Ciudad de Panamá",
      state: "Panamá",
      country: "Panamá",
      latitude: 9.0714,
      longitude: -79.3835,
      timezone: "America/Panama",
      facilities: ["wifi", "restaurant", "atm", "car_rental"],
    },
  ];

  const { error } = await supabase.from("airports").upsert(airports, {
    onConflict: "id",
  });

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
  } else {
    console.log(`   ✅ ${airports.length} aeropuertos insertados`);
  }
}

async function seedAirlines() {
  console.log("🛫 Insertando aerolíneas...");

  const airlines = [
    {
      id: "LA",
      iata_code: "LA",
      name: "LATAM Airlines",
      logo: "/images/airlines/latam.png",
      contact_phone: "+56 2 2565 8200",
      contact_email: "contacto@latam.com",
      contact_website: "https://www.latam.com",
      airline_policy: {
        baggage: {
          carry_on: { weight_kg: 10, dimensions: "55x35x25cm" },
          checked: { weight_kg: 23, fee_usd: 0 },
        },
        cancellation: { allowed: true, fee_usd: 50, deadline_hours: 24 },
      },
    },
    {
      id: "AV",
      iata_code: "AV",
      name: "Avianca",
      logo: "/images/airlines/avianca.png",
      contact_phone: "+57 1 401 3434",
      contact_email: "contacto@avianca.com",
      contact_website: "https://www.avianca.com",
      airline_policy: {
        baggage: {
          carry_on: { weight_kg: 10, dimensions: "55x35x25cm" },
          checked: { weight_kg: 23, fee_usd: 0 },
        },
        cancellation: { allowed: true, fee_usd: 75, deadline_hours: 24 },
      },
    },
    {
      id: "CM",
      iata_code: "CM",
      name: "Copa Airlines",
      logo: "/images/airlines/copa.png",
      contact_phone: "+507 217 2672",
      contact_email: "contacto@copaair.com",
      contact_website: "https://www.copaair.com",
      airline_policy: {
        baggage: {
          carry_on: { weight_kg: 10, dimensions: "55x35x25cm" },
          checked: { weight_kg: 23, fee_usd: 0 },
        },
        cancellation: { allowed: true, fee_usd: 100, deadline_hours: 24 },
      },
    },
    {
      id: "V0",
      iata_code: "V0",
      name: "Conviasa",
      logo: "/images/airlines/conviasa.png",
      contact_phone: "+58 212 508 1111",
      contact_email: "atencion@conviasa.aero",
      contact_website: "https://www.conviasa.aero",
      airline_policy: {
        baggage: {
          carry_on: { weight_kg: 8, dimensions: "55x35x25cm" },
          checked: { weight_kg: 23, fee_usd: 0 },
        },
        cancellation: { allowed: true, fee_usd: 30, deadline_hours: 48 },
      },
    },
  ];

  const { error } = await supabase.from("airlines").upsert(airlines, {
    onConflict: "id",
  });

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
  } else {
    console.log(`   ✅ ${airlines.length} aerolíneas insertadas`);
  }
}

async function seedHotels() {
  console.log("🏨 Insertando hoteles...");

  const hotels = [
    {
      slug: "hotel-tamanaco-caracas",
      name: "Hotel Tamanaco InterContinental",
      description:
        "Hotel de lujo ubicado en Las Mercedes, Caracas. Ofrece vistas panorámicas de la ciudad y el Ávila.",
      category: "5 estrellas",
      parking_included: true,
      address_street: "Av. Principal de Las Mercedes",
      address_city: "Caracas",
      address_state: "Distrito Capital",
      address_country: "Venezuela",
      coordinates_lat: 10.4806,
      coordinates_lon: -66.8541,
      amenities: [
        "wifi",
        "pool",
        "spa",
        "gym",
        "restaurant",
        "bar",
        "room_service",
      ],
      features: ["mountain_view", "city_view", "concierge"],
      images: ["/images/hotels/tamanaco-1.jpg"],
      status: "Opened",
      total_rooms: 280,
      tags: ["luxury", "business", "romantic"],
      policies: {
        checkIn: "15:00",
        checkOut: "12:00",
        cancellation: { free_until_hours: 48, fee_percentage: 50 },
        refund: { allowed: true, deadline_hours: 24 },
      },
    },
    {
      slug: "hesperia-isla-margarita",
      name: "Hesperia Isla Margarita",
      description:
        "Resort todo incluido frente al mar en Playa El Agua, perfecto para vacaciones.",
      category: "5 estrellas",
      parking_included: true,
      address_street: "Av. 31 de Julio, Playa El Agua",
      address_city: "Porlamar",
      address_state: "Nueva Esparta",
      address_country: "Venezuela",
      coordinates_lat: 11.0847,
      coordinates_lon: -63.8847,
      amenities: [
        "wifi",
        "pool",
        "beach_access",
        "spa",
        "gym",
        "restaurant",
        "bar",
      ],
      features: ["beachfront", "all_inclusive", "family_friendly"],
      images: ["/images/hotels/hesperia-margarita-1.jpg"],
      status: "Opened",
      total_rooms: 320,
      tags: ["beach", "resort", "family", "all_inclusive"],
      policies: {
        checkIn: "16:00",
        checkOut: "11:00",
        cancellation: { free_until_hours: 72, fee_percentage: 50 },
        refund: { allowed: true, deadline_hours: 48 },
      },
    },
    {
      slug: "grand-oasis-cancun",
      name: "Grand Oasis Cancún",
      description:
        "Espectacular resort todo incluido en la zona hotelera de Cancún.",
      category: "5 estrellas",
      parking_included: true,
      address_street: "Blvd. Kukulcan Km 16.5, Zona Hotelera",
      address_city: "Cancún",
      address_state: "Quintana Roo",
      address_country: "México",
      coordinates_lat: 21.0885,
      coordinates_lon: -86.768,
      amenities: [
        "wifi",
        "pool",
        "beach_access",
        "spa",
        "gym",
        "restaurant",
        "bar",
        "nightclub",
      ],
      features: ["beachfront", "all_inclusive", "entertainment"],
      images: ["/images/hotels/grand-oasis-1.jpg"],
      status: "Opened",
      total_rooms: 1500,
      tags: ["beach", "resort", "party", "all_inclusive"],
      policies: {
        checkIn: "15:00",
        checkOut: "12:00",
        cancellation: { free_until_hours: 48, fee_percentage: 50 },
        refund: { allowed: true, deadline_hours: 24 },
      },
    },
    {
      slug: "barcelo-bavaro-palace",
      name: "Barceló Bávaro Palace",
      description:
        "Resort todo incluido de lujo en Bávaro con acceso a playa privada.",
      category: "5 estrellas",
      parking_included: true,
      address_street: "Carretera Bávaro Km 1, Playa Bávaro",
      address_city: "Punta Cana",
      address_state: "La Altagracia",
      address_country: "República Dominicana",
      coordinates_lat: 18.685,
      coordinates_lon: -68.415,
      amenities: [
        "wifi",
        "pool",
        "beach_access",
        "spa",
        "gym",
        "restaurant",
        "bar",
        "casino",
        "golf",
      ],
      features: ["beachfront", "all_inclusive", "golf_course"],
      images: ["/images/hotels/barcelo-bavaro-1.jpg"],
      status: "Opened",
      total_rooms: 1402,
      tags: ["beach", "resort", "family", "all_inclusive", "golf"],
      policies: {
        checkIn: "16:00",
        checkOut: "12:00",
        cancellation: { free_until_hours: 72, fee_percentage: 50 },
        refund: { allowed: true, deadline_hours: 48 },
      },
    },
  ];

  const { data, error } = await supabase
    .from("hotels")
    .upsert(hotels, { onConflict: "slug" })
    .select("id, slug");

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return [];
  } else {
    console.log(`   ✅ ${hotels.length} hoteles insertados`);
    return data || [];
  }
}

async function seedHotelRooms(hotels) {
  if (hotels.length === 0) {
    console.log("🛏️  No hay hoteles para agregar habitaciones");
    return;
  }

  console.log("🛏️  Insertando habitaciones...");

  const rooms = [];

  for (const hotel of hotels) {
    rooms.push(
      {
        hotel_id: hotel.id,
        description: "Habitación estándar con todas las comodidades básicas.",
        room_type: "Standard",
        features: ["air_conditioning", "tv", "minibar", "safe"],
        amenities: ["wifi", "tv", "minibar", "safe", "coffee_maker"],
        images: ["/images/rooms/standard-1.jpg"],
        price_base: 89.0,
        price_tax: 15.0,
        price_currency: "USD",
        total_beds: 1,
        bed_options: "1 King o 2 Twin",
        sleeps_count: 2,
        max_adults: 2,
        max_children: 1,
      },
      {
        hotel_id: hotel.id,
        description: "Habitación superior con vistas y amenidades mejoradas.",
        room_type: "Superior",
        features: ["air_conditioning", "tv", "minibar", "safe", "balcony"],
        amenities: ["wifi", "tv", "minibar", "safe", "coffee_maker", "bathrobe"],
        images: ["/images/rooms/superior-1.jpg"],
        price_base: 129.0,
        price_tax: 20.0,
        price_currency: "USD",
        total_beds: 1,
        bed_options: "1 King",
        sleeps_count: 2,
        max_adults: 2,
        max_children: 1,
      },
      {
        hotel_id: hotel.id,
        description: "Suite espaciosa con sala de estar y vistas panorámicas.",
        room_type: "Suite",
        features: [
          "air_conditioning",
          "tv",
          "minibar",
          "safe",
          "balcony",
          "living_room",
        ],
        amenities: [
          "wifi",
          "tv",
          "minibar",
          "safe",
          "coffee_maker",
          "bathrobe",
          "slippers",
        ],
        images: ["/images/rooms/suite-1.jpg"],
        price_base: 249.0,
        price_tax: 40.0,
        price_currency: "USD",
        total_beds: 2,
        bed_options: "1 King + Sofá cama",
        sleeps_count: 4,
        max_adults: 2,
        max_children: 2,
      }
    );
  }

  const { error } = await supabase.from("hotel_rooms").insert(rooms);

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
  } else {
    console.log(`   ✅ ${rooms.length} habitaciones insertadas`);
  }
}

async function seedPromoCodes() {
  console.log("🎟️  Insertando códigos promocionales...");

  const promoCodes = [
    {
      code: "BIENVENIDO10",
      description: "Descuento de bienvenida del 10%",
      discount_type: "percentage",
      value: 10.0,
      currency: "USD",
      max_discount: 50.0,
      applicable_to: "both",
      is_active: true,
      valid_from: new Date().toISOString(),
      valid_until: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      ).toISOString(),
      usage_limit: 1000,
    },
    {
      code: "VERANO2024",
      description: "Promoción de verano 15% de descuento",
      discount_type: "percentage",
      value: 15.0,
      currency: "USD",
      max_discount: 100.0,
      applicable_to: "both",
      is_active: true,
      valid_from: new Date().toISOString(),
      valid_until: new Date(
        Date.now() + 180 * 24 * 60 * 60 * 1000
      ).toISOString(),
      usage_limit: 500,
    },
  ];

  const { error } = await supabase.from("promo_codes").upsert(promoCodes, {
    onConflict: "code",
  });

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
  } else {
    console.log(`   ✅ ${promoCodes.length} códigos insertados`);
  }
}

async function seedWebsiteConfig() {
  console.log("⚙️  Configurando sitio web...");

  const config = {
    id: "config",
    site_name: "Check-in Venezuela",
    site_description:
      "Tu agencia de viajes de confianza para explorar Venezuela y el mundo",
    contact_email: "info@checkinvenezuela.com",
    contact_phone: "+58 424 603 4052",
    social_links: {
      facebook: "https://facebook.com/checkinvenezuela",
      instagram: "https://instagram.com/checkinvenezuela",
      whatsapp: "584264034052",
    },
    features: {
      flights: true,
      hotels: true,
      packages: false,
      transfers: false,
    },
  };

  const { error } = await supabase
    .from("website_config")
    .upsert(config, { onConflict: "id" });

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
  } else {
    console.log(`   ✅ Configuración actualizada`);
  }
}

async function seedReviews() {
  console.log("⭐ Insertando reseñas...");

  const reviews = [
    {
      rating: 5,
      title: "Excelente servicio",
      comment:
        "Reservé mis vacaciones a Cancún y todo fue perfecto. El equipo me ayudó en todo momento.",
      is_approved: true,
    },
    {
      rating: 5,
      title: "Muy recomendado",
      comment: "Precios competitivos y atención personalizada.",
      is_approved: true,
    },
    {
      rating: 4,
      title: "Buena experiencia",
      comment: "El proceso de reserva fue sencillo y rápido.",
      is_approved: true,
    },
  ];

  const { error } = await supabase.from("website_reviews").insert(reviews);

  if (error && !error.message.includes("duplicate")) {
    console.log(`   ❌ Error: ${error.message}`);
  } else {
    console.log(`   ✅ ${reviews.length} reseñas insertadas`);
  }
}

async function main() {
  console.log("=========================================");
  console.log("🌱 CHECK-IN VENEZUELA - Seed de datos");
  console.log("=========================================\n");

  // Verificar estado inicial
  await checkTables();

  // Ejecutar seed
  await seedAirports();
  await seedAirlines();
  const hotels = await seedHotels();
  await seedHotelRooms(hotels);
  await seedPromoCodes();
  await seedWebsiteConfig();
  await seedReviews();

  console.log("");

  // Verificar estado final
  await checkTables();

  console.log("=========================================");
  console.log("✅ Seed completado");
  console.log("=========================================\n");
}

main().catch(console.error);
