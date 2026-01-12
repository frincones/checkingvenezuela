/**
 * Script para crear usuarios de prueba en Supabase
 *
 * Ejecutar: node scripts/setup-test-users.js
 *
 * Requiere las variables de entorno:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: Variables de entorno no configuradas");
  console.error("   Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const testUsers = [
  {
    email: "test@checkinvenezuela.com",
    password: "Test123456!",
    firstName: "Usuario",
    lastName: "Prueba",
    isAdvisor: false,
  },
  {
    email: "asesor@checkinvenezuela.com",
    password: "Asesor123456!",
    firstName: "Carlos",
    lastName: "Asesor",
    isAdvisor: true,
  },
];

async function createTestUser(userData) {
  console.log(`\n📧 Procesando: ${userData.email}`);

  try {
    // Verificar si el usuario ya existe
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email === userData.email
    );

    let userId;

    if (existingUser) {
      console.log(`   ⚠️  Usuario ya existe con ID: ${existingUser.id}`);
      userId = existingUser.id;
    } else {
      // Crear usuario
      const { data: newUser, error: createError } =
        await supabase.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true,
          user_metadata: {
            first_name: userData.firstName,
            last_name: userData.lastName,
          },
        });

      if (createError) {
        console.error(`   ❌ Error creando usuario: ${createError.message}`);
        return null;
      }

      userId = newUser.user.id;
      console.log(`   ✅ Usuario creado con ID: ${userId}`);
    }

    // Verificar/crear perfil
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!existingProfile) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
        profile_image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.email}`,
        email_verified_at: new Date().toISOString(),
      });

      if (profileError) {
        console.error(`   ❌ Error creando perfil: ${profileError.message}`);
      } else {
        console.log(`   ✅ Perfil creado`);
      }
    } else {
      console.log(`   ⚠️  Perfil ya existe`);
    }

    // Si es asesor, crear registro de advisor
    if (userData.isAdvisor) {
      const { data: existingAdvisor } = await supabase
        .from("advisors")
        .select("id")
        .eq("profile_id", userId)
        .single();

      if (!existingAdvisor) {
        const { error: advisorError } = await supabase.from("advisors").insert({
          profile_id: userId,
          employee_code: "ADV001",
          department: "sales",
          whatsapp_number: "+584264034052",
          is_active: true,
          specializations: ["flights", "hotels", "packages"],
        });

        if (advisorError) {
          console.error(
            `   ❌ Error creando advisor: ${advisorError.message}`
          );
        } else {
          console.log(`   ✅ Registro de asesor creado`);
        }
      } else {
        console.log(`   ⚠️  Registro de asesor ya existe`);
      }
    }

    return userId;
  } catch (error) {
    console.error(`   ❌ Error inesperado: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log("=========================================");
  console.log("🚀 CHECK-IN VENEZUELA - Setup de usuarios");
  console.log("=========================================");
  console.log(`\nSupabase URL: ${supabaseUrl}`);

  for (const user of testUsers) {
    await createTestUser(user);
  }

  console.log("\n=========================================");
  console.log("📋 RESUMEN DE CREDENCIALES");
  console.log("=========================================");
  console.log("\n👤 Usuario de prueba:");
  console.log("   Email: test@checkinvenezuela.com");
  console.log("   Password: Test123456!");
  console.log("\n👔 Usuario asesor:");
  console.log("   Email: asesor@checkinvenezuela.com");
  console.log("   Password: Asesor123456!");
  console.log("\n=========================================");
  console.log("✅ Proceso completado");
  console.log("=========================================\n");
}

main().catch(console.error);
