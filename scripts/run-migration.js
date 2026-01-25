/**
 * Script para ejecutar migración SQL en Supabase
 * Uso: node scripts/run-migration.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Iniciando migración CMS, Proveedores e Inventario...\n');

  try {
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '../supabase/migrations/003_cms_providers_inventory.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Dividir en statements individuales para ejecutar
    // Nota: Supabase no permite ejecutar SQL directamente via API REST
    // Necesitamos usar rpc o ejecutar statement por statement

    console.log('📋 Ejecutando migración via Supabase...');

    // Usamos la función rpc si está disponible, sino ejecutamos directamente
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });

    if (error) {
      // Si no existe la función exec_sql, intentamos otra forma
      console.log('⚠️ No se puede ejecutar SQL directamente via API.');
      console.log('');
      console.log('📝 Por favor, ejecuta la migración manualmente:');
      console.log('');
      console.log('1. Ve a: https://supabase.com/dashboard/project/stbbckupkuxasfthlsys/sql');
      console.log('2. Copia el contenido del archivo:');
      console.log('   supabase/migrations/003_cms_providers_inventory.sql');
      console.log('3. Pégalo en el SQL Editor y haz clic en "Run"');
      console.log('');

      // Intentamos crear las tablas una por una via API
      console.log('🔄 Intentando crear tablas básicas via API...');
      await createTablesViaAPI();
    } else {
      console.log('✅ Migración completada exitosamente');
    }

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

async function createTablesViaAPI() {
  // Verificar si las tablas existen intentando hacer un select
  const tables = [
    'catalog_services',
    'destination_categories',
    'destinations',
    'tourism_providers',
    'service_inventory'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error && error.code === 'PGRST205') {
      console.log(`❌ Tabla ${table} no existe`);
    } else if (error) {
      console.log(`⚠️ Error verificando ${table}: ${error.message}`);
    } else {
      console.log(`✅ Tabla ${table} existe`);
    }
  }

  console.log('');
  console.log('⚠️ Las tablas necesitan ser creadas manualmente en Supabase SQL Editor.');
  console.log('');
  console.log('📋 Copia y pega el SQL de:');
  console.log('   supabase/migrations/003_cms_providers_inventory.sql');
  console.log('');
  console.log('🔗 URL: https://supabase.com/dashboard/project/stbbckupkuxasfthlsys/sql');
}

runMigration();
