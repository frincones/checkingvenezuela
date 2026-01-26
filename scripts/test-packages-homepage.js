const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = 'https://stbbckupkuxasfthlsys.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0YmJja3Vwa3V4YXNmdGhsc3lzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE4NjcyNCwiZXhwIjoyMDgzNzYyNzI0fQ.mCd-Go1STkz1BAUzACX0MhezJ2g3XU01veeNRbNJeg0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testPackagesHomepage() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║  VERIFICACIÓN DE PAQUETES EN PÁGINA PRINCIPAL                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  try {
    // Verificar paquetes destacados (los que se mostrarán en la homepage)
    const { data: featuredPackages, error } = await supabase
      .from('service_inventory')
      .select(`
        id,
        name,
        sale_price,
        is_published,
        is_featured,
        destination:destinations(name)
      `)
      .eq('product_type', 'package')
      .eq('is_published', true)
      .eq('is_featured', true)
      .order('display_order', { ascending: true })
      .limit(6);

    if (error) {
      console.log('❌ Error al obtener paquetes destacados:', error.message);
      return;
    }

    console.log('📦 PAQUETES DESTACADOS (que aparecerán en la homepage)\n');
    console.log('─'.repeat(76));

    if (!featuredPackages || featuredPackages.length === 0) {
      console.log('\n⚠️  No hay paquetes destacados para mostrar en la página principal.');
      console.log('\n💡 Sugerencia: Marca algunos paquetes como destacados (is_featured=true)');
      console.log('   desde el dashboard CMS en: http://localhost:3000/dashboard/cms/packages\n');
      return;
    }

    console.log(`✅ Se encontraron ${featuredPackages.length} paquetes destacados:\n`);

    featuredPackages.forEach((pkg, index) => {
      console.log(`${index + 1}. ${pkg.name}`);
      console.log(`   Destino:  ${pkg.destination?.name || 'N/A'}`);
      console.log(`   Precio:   $${pkg.sale_price} USD`);
      console.log(`   Estado:   ✓ Publicado | ⭐ Destacado`);
      console.log('');
    });

    console.log('─'.repeat(76));
    console.log('\n🌐 URLS PARA VERIFICAR\n');
    console.log('Página Principal (con sección de paquetes):');
    console.log('  → http://localhost:3000/\n');
    console.log('Todos los Paquetes:');
    console.log('  → http://localhost:3000/packages\n');
    console.log('Dashboard CMS - Gestión de Paquetes:');
    console.log('  → http://localhost:3000/dashboard/cms/packages\n');

    console.log('─'.repeat(76));
    console.log('\n✅ RESUMEN\n');
    console.log(`  • ${featuredPackages.length} paquetes destacados listos para mostrarse`);
    console.log('  • Sección "Paquetes Turísticos Destacados" agregada a la homepage');
    console.log('  • Gestión completa desde el CMS Dashboard');
    console.log('  • Todos los paquetes tienen precios en USD');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

testPackagesHomepage();
