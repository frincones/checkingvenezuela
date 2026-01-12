/**
 * Script para verificar el funcionamiento de la aplicación
 *
 * Ejecutar: node scripts/verify-app.js
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyDatabase() {
  console.log("📊 Verificando base de datos...\n");

  const checks = [
    { table: "profiles", description: "Perfiles de usuario" },
    { table: "airports", description: "Aeropuertos" },
    { table: "airlines", description: "Aerolíneas" },
    { table: "hotels", description: "Hoteles" },
    { table: "hotel_rooms", description: "Habitaciones de hotel" },
    { table: "promo_codes", description: "Códigos promocionales" },
    { table: "website_config", description: "Configuración del sitio" },
    { table: "website_reviews", description: "Reseñas del sitio" },
  ];

  let allPassed = true;

  for (const check of checks) {
    const { count, error } = await supabase
      .from(check.table)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.log(`   ❌ ${check.description}: Error - ${error.message}`);
      allPassed = false;
    } else {
      const status = count > 0 ? "✅" : "⚠️";
      console.log(`   ${status} ${check.description}: ${count} registros`);
    }
  }

  return allPassed;
}

async function verifyAuth() {
  console.log("\n🔐 Verificando autenticación...\n");

  // Intentar login con usuario de prueba
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "test@checkinvenezuela.com",
    password: "Test123456!",
  });

  if (error) {
    console.log(`   ❌ Login fallido: ${error.message}`);
    return false;
  }

  console.log(`   ✅ Login exitoso para: ${data.user.email}`);
  console.log(`   ✅ User ID: ${data.user.id}`);

  // Verificar perfil
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileError) {
    console.log(`   ❌ Perfil no encontrado: ${profileError.message}`);
    return false;
  }

  console.log(
    `   ✅ Perfil encontrado: ${profile.first_name} ${profile.last_name}`
  );

  // Cerrar sesión
  await supabase.auth.signOut();
  console.log(`   ✅ Logout exitoso`);

  return true;
}

async function verifyHotelsWithRooms() {
  console.log("\n🏨 Verificando hoteles con habitaciones...\n");

  const { data, error } = await supabase
    .from("hotels")
    .select(
      `
      id,
      name,
      address_city,
      hotel_rooms(
        id,
        room_type,
        price_base
      )
    `
    )
    .limit(3);

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }

  for (const hotel of data) {
    console.log(`   🏨 ${hotel.name} (${hotel.address_city})`);
    for (const room of hotel.hotel_rooms) {
      console.log(`      └─ ${room.room_type}: $${room.price_base}/noche`);
    }
  }

  return true;
}

async function verifyAirports() {
  console.log("\n✈️ Verificando aeropuertos...\n");

  const { data, error } = await supabase
    .from("airports")
    .select("id, name, city, country")
    .limit(5);

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }

  for (const airport of data) {
    console.log(
      `   ✈️ [${airport.id}] ${airport.name} - ${airport.city}, ${airport.country}`
    );
  }

  return true;
}

async function main() {
  console.log("=========================================");
  console.log("🔍 CHECK-IN VENEZUELA - Verificación");
  console.log("=========================================");

  const results = {
    database: await verifyDatabase(),
    auth: await verifyAuth(),
    hotels: await verifyHotelsWithRooms(),
    airports: await verifyAirports(),
  };

  console.log("\n=========================================");
  console.log("📋 RESUMEN");
  console.log("=========================================\n");

  let allPassed = true;
  for (const [check, passed] of Object.entries(results)) {
    const status = passed ? "✅" : "❌";
    console.log(`   ${status} ${check}`);
    if (!passed) allPassed = false;
  }

  console.log("\n=========================================");
  if (allPassed) {
    console.log("✅ TODAS LAS VERIFICACIONES PASARON");
  } else {
    console.log("⚠️ ALGUNAS VERIFICACIONES FALLARON");
  }
  console.log("=========================================\n");

  console.log("📝 Credenciales de prueba:");
  console.log("   Email: test@checkinvenezuela.com");
  console.log("   Password: Test123456!");
  console.log("\n   Email: asesor@checkinvenezuela.com");
  console.log("   Password: Asesor123456!");
  console.log("\n");
}

main().catch(console.error);
