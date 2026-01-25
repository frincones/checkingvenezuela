const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = 'https://stbbckupkuxasfthlsys.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0YmJja3Vwa3V4YXNmdGhsc3lzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE4NjcyNCwiZXhwIjoyMDgzNzYyNzI0fQ.mCd-Go1STkz1BAUzACX0MhezJ2g3XU01veeNRbNJeg0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Función para generar slug (igual que en el frontend)
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar diacríticos (acentos)
    .replace(/\s+-\s+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/\/+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

async function checkPackages() {
  console.log('🔍 Verificando paquetes en la base de datos...\n');

  try {
    const { data: packages, error } = await supabase
      .from('service_inventory')
      .select(`
        id,
        name,
        sku,
        product_type,
        sale_price,
        is_published,
        destination:destinations(name, slug)
      `)
      .eq('product_type', 'package')
      .eq('is_published', true);

    if (error) {
      throw new Error(`Error fetching packages: ${error.message}`);
    }

    if (!packages || packages.length === 0) {
      console.log('❌ No se encontraron paquetes publicados en la base de datos');
      return;
    }

    console.log(`✅ Se encontraron ${packages.length} paquetes publicados:\n`);

    packages.forEach((pkg, index) => {
      const slug = generateSlug(pkg.name);
      console.log(`${index + 1}. ${pkg.name}`);
      console.log(`   SKU: ${pkg.sku}`);
      console.log(`   Destino: ${pkg.destination?.name || 'N/A'}`);
      console.log(`   Precio: $${pkg.sale_price} USD`);
      console.log(`   Slug generado: ${slug}`);
      console.log(`   URL: http://localhost:3001/packages/${slug}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkPackages();
