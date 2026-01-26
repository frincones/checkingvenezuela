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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+-\s+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/\/+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

async function verifyNewPackages() {
  console.log('\n🔍 Verificando los 2 paquetes nuevos solicitados...\n');
  console.log('='.repeat(80));

  try {
    // Buscar los paquetes específicos que se pidieron
    const { data: packages, error } = await supabase
      .from('service_inventory')
      .select(`
        id,
        name,
        sku,
        sale_price,
        is_published,
        created_at,
        destination:destinations(name, slug),
        provider:tourism_providers(name)
      `)
      .eq('product_type', 'package')
      .or('sku.eq.PKG-MAR-UNIK-3D2N,sku.eq.PKG-MER-TRADICIONAL-3D2N');

    if (error) {
      throw new Error(`Error fetching packages: ${error.message}`);
    }

    if (!packages || packages.length === 0) {
      console.log('\n❌ ERROR: No se encontraron los paquetes nuevos en la base de datos\n');
      return;
    }

    console.log(`\n✅ Se encontraron ${packages.length} paquetes nuevos:\n`);

    packages.forEach((pkg, index) => {
      const slug = generateSlug(pkg.name);
      const estado = pkg.is_published ? '✓ Publicado' : '✗ No publicado';

      console.log(`\n${index + 1}. ${pkg.name}`);
      console.log('   ' + '-'.repeat(60));
      console.log(`   SKU:         ${pkg.sku}`);
      console.log(`   Proveedor:   ${pkg.provider?.name || 'N/A'}`);
      console.log(`   Destino:     ${pkg.destination?.name || 'N/A'}`);
      console.log(`   Precio:      $${pkg.sale_price} USD`);
      console.log(`   Estado:      ${estado}`);
      console.log(`   Slug:        ${slug}`);
      console.log(`   URL:         http://localhost:3002/packages/${slug}`);
      console.log(`   Creado:      ${new Date(pkg.created_at).toLocaleString('es-ES')}`);
    });

    console.log('\n' + '='.repeat(80));

    // Verificación específica de los requisitos
    const margarita = packages.find(p => p.sku === 'PKG-MAR-UNIK-3D2N');
    const merida = packages.find(p => p.sku === 'PKG-MER-TRADICIONAL-3D2N');

    console.log('\n📋 Verificación de requisitos:\n');

    if (margarita) {
      console.log('✅ Paquete Margarita encontrado');
      console.log(`   - Precio: $${margarita.sale_price} USD ${margarita.sale_price === 470 ? '✓' : '✗ (debería ser $470)'}`);
      console.log(`   - Publicado: ${margarita.is_published ? '✓' : '✗'}`);
    } else {
      console.log('❌ Paquete Margarita NO encontrado');
    }

    if (merida) {
      console.log('✅ Paquete Mérida encontrado');
      console.log(`   - Precio: $${merida.sale_price} USD ${merida.sale_price === 450 ? '✓' : '✗ (debería ser $450)'}`);
      console.log(`   - Publicado: ${merida.is_published ? '✓' : '✗'}`);
    } else {
      console.log('❌ Paquete Mérida NO encontrado');
    }

    if (margarita && merida) {
      console.log('\n🎉 ÉXITO: Ambos paquetes están correctamente insertados en la base de datos\n');
    } else {
      console.log('\n⚠️  ADVERTENCIA: Falta al menos uno de los paquetes solicitados\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

verifyNewPackages();
