/**
 * Script para probar la subida de imágenes a Supabase Storage
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Cargar variables de entorno
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Faltan variables de entorno SUPABASE");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testStorage() {
  console.log("🔍 Verificando configuración de Storage...\n");

  // 1. Verificar que el bucket existe
  console.log("1️⃣ Verificando bucket 'cms-images'...");
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

  if (bucketsError) {
    console.error("❌ Error al listar buckets:", bucketsError.message);
    return;
  }

  const cmsBucket = buckets.find((b) => b.id === "cms-images");
  if (!cmsBucket) {
    console.log("❌ Bucket 'cms-images' NO existe. Creándolo...");

    const { error: createError } = await supabase.storage.createBucket("cms-images", {
      public: true,
      fileSizeLimit: 5242880,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"],
    });

    if (createError) {
      console.error("❌ Error al crear bucket:", createError.message);
      return;
    }
    console.log("✅ Bucket 'cms-images' creado exitosamente");
  } else {
    console.log("✅ Bucket 'cms-images' existe");
    console.log("   - Público:", cmsBucket.public);
    console.log("   - Límite:", (cmsBucket.file_size_limit / 1024 / 1024).toFixed(1), "MB");
    console.log("   - Tipos permitidos:", cmsBucket.allowed_mime_types?.join(", "));
  }

  // 2. Probar subida de imagen de prueba
  console.log("\n2️⃣ Probando subida de imagen...");

  // Crear una imagen de prueba simple (1x1 pixel PNG)
  const testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const testImageBuffer = Buffer.from(testImageBase64, "base64");

  const testFileName = `test/test-upload-${Date.now()}.png`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("cms-images")
    .upload(testFileName, testImageBuffer, {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("❌ Error al subir imagen:", uploadError.message);
    console.error("   Detalles:", JSON.stringify(uploadError, null, 2));

    // Verificar si es un problema de políticas
    if (uploadError.message.includes("policy") || uploadError.message.includes("permission")) {
      console.log("\n⚠️  PROBLEMA DETECTADO: Faltan políticas de Storage");
      console.log("   Ejecutando configuración de políticas...");
      await setupPolicies();
    }
    return;
  }

  console.log("✅ Imagen subida exitosamente");
  console.log("   - Path:", uploadData.path);

  // 3. Obtener URL pública
  const { data: urlData } = supabase.storage
    .from("cms-images")
    .getPublicUrl(uploadData.path);

  console.log("   - URL pública:", urlData.publicUrl);

  // 4. Limpiar - eliminar imagen de prueba
  console.log("\n3️⃣ Limpiando imagen de prueba...");
  const { error: deleteError } = await supabase.storage
    .from("cms-images")
    .remove([uploadData.path]);

  if (deleteError) {
    console.error("⚠️  No se pudo eliminar imagen de prueba:", deleteError.message);
  } else {
    console.log("✅ Imagen de prueba eliminada");
  }

  console.log("\n✅ ¡Todo funciona correctamente!");
  console.log("   El sistema de subida de imágenes está operativo.");
}

async function setupPolicies() {
  console.log("\n📝 Configurando políticas de Storage...");

  // Las políticas se configuran a través de SQL
  // Esto requiere ejecutar la migración 004_storage_setup.sql
  console.log("   Para configurar las políticas, ejecuta la migración:");
  console.log("   supabase/migrations/004_storage_setup.sql");
  console.log("\n   O configura manualmente en Supabase Dashboard:");
  console.log("   1. Ve a Storage > Policies");
  console.log("   2. Crea política SELECT para lectura pública");
  console.log("   3. Crea políticas INSERT/UPDATE/DELETE para usuarios autenticados");
}

// Ejecutar prueba
testStorage().catch(console.error);
