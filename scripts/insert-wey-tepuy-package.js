const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = 'https://stbbckupkuxasfthlsys.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0YmJja3Vwa3V4YXNmdGhsc3lzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE4NjcyNCwiZXhwIjoyMDgzNzYyNzI0fQ.mCd-Go1STkz1BAUzACX0MhezJ2g3XU01veeNRbNJeg0';

// Crear cliente con permisos de admin
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function insertWeyTepuyPackage() {
  console.log('🚀 Iniciando inserción del paquete Wey Tepuy 4D/3N...\n');

  try {
    // 1. Verificar/Obtener Proveedor Wakutours (ya debe existir)
    console.log('📦 Verificando proveedor Wakutours...');
    const { data: provider, error: providerError } = await supabase
      .from('tourism_providers')
      .select('id, name')
      .eq('slug', 'wakutours')
      .single();

    if (providerError || !provider) {
      throw new Error('Proveedor Wakutours no encontrado. Ejecuta primero el script de El Botuto.');
    }

    console.log('✅ Proveedor Wakutours encontrado:', provider.id);

    // 2. Verificar/Crear Destino Canaima
    console.log('\n🔍 Verificando destino Canaima...');
    let destination = null;

    const { data: existingDest, error: destCheckError } = await supabase
      .from('destinations')
      .select('id, name, slug')
      .eq('slug', 'canaima')
      .single();

    if (existingDest) {
      destination = existingDest;
      console.log('✅ Destino Canaima ya existe:', destination.id);
    } else {
      // Crear destino Canaima
      console.log('📍 Creando destino Canaima...');
      const { data: newDest, error: createDestError } = await supabase
        .from('destinations')
        .insert({
          name: 'Canaima',
          slug: 'canaima',
          country: 'Venezuela',
          description: 'Parque Nacional Canaima, hogar del Salto Ángel, la cascada más alta del mundo. Un paraíso natural de tepuyes, lagunas y selva virgen en el estado Bolívar.',
          image_url: 'https://images.unsplash.com/photo-1589802829985-817e51171b92?q=80&w=2070&auto=format&fit=crop',
          is_featured: true,
          climate: 'Tropical húmedo',
          best_time_to_visit: 'Mayo a Noviembre (temporada de lluvias)'
        })
        .select()
        .single();

      if (createDestError) {
        throw new Error(`Error creando destino Canaima: ${createDestError.message}`);
      }

      destination = newDest;
      console.log('✅ Destino Canaima creado:', destination.id);
    }

    // 3. Obtener Servicio Packages
    console.log('\n🔍 Obteniendo servicio Packages...');
    const { data: service, error: serviceError } = await supabase
      .from('catalog_services')
      .select('id')
      .eq('slug', 'packages')
      .single();

    if (serviceError || !service) {
      throw new Error('Servicio Packages no encontrado.');
    }

    console.log('✅ Servicio Packages encontrado:', service.id);

    // 4. Insertar Paquete Wey Tepuy
    console.log('\n📦 Insertando paquete Wey Tepuy 4D/3N...');
    const packageData = {
      provider_id: provider.id,
      destination_id: destination.id,
      service_id: service.id,
      name: 'Wey Tepuy - Canaima y Salto Ángel 4D/3N',
      sku: 'PKG-CAN-WEYTEPUY-4D3N',
      description: 'Vive una aventura épica en el Parque Nacional Canaima con este paquete de 4 días y 3 noches. Explora el majestuoso Salto Ángel, la cascada más alta del mundo, navega por los ríos Carrao y Churún, camina por la sabana de Mayupa y descubre la belleza natural de los tepuyes. Incluye excursiones fluviales, caminatas, visita a comunidades indígenas y alojamiento tipo mochilero en campamento base.',
      product_type: 'package',
      cost_price: 870.00,
      sale_price: 957.00,
      currency: 'USD',
      pricing_details: {
        display_text: 'DESDE $957,00 POR PERSONA',
        price_type: 'per_person',
        base_price: 957.00,
        category: 'Básico (tipo mochilero)',
        notes: 'Precio por persona en habitaciones básicas compartidas. No incluye tasa aeroportuaria ni impuesto Inparques ($40 USD adultos extranjeros, $20 USD niños).'
      },
      status: 'available',
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      details: {
        duration: '4 días / 3 noches',
        destination: 'Parque Nacional Canaima - Salto Ángel',
        accommodation_type: 'Campamento básico + 1 noche en hamaca',
        category: 'Aventura y Naturaleza',
        difficulty: 'Moderada',
        schedule: {
          departure: '6:30 AM o 10:30 AM desde Aeropuerto de Maiquetía',
          return: '8:25 AM o 12:25 PM desde Canaima'
        },
        itinerary: [
          {
            day: 1,
            title: 'Llegada a Canaima y Primera Excursión',
            activities: [
              'Salida 6:30 AM o 10:30 AM desde Maiquetía (CCS)',
              'Vuelo a Canaima (CAJ)',
              'Recibimiento en aeropuerto de Canaima',
              'Traslado al campamento base',
              'Almuerzo',
              'Excursión a Salto El Sapo y Salto Hacha',
              'Paseo en curiara por la Laguna de Canaima',
              'Cena',
              'Pernocta en campamento'
            ],
            meals: ['Almuerzo', 'Cena'],
            accommodation: 'Campamento básico (habitaciones compartidas)'
          },
          {
            day: 2,
            title: 'Excursión Fluvial al Salto Ángel',
            activities: [
              'Desayuno en el campamento',
              'Inicio de excursión fluvial hacia el Salto Ángel',
              'Navegación de 4 horas por los ríos Carrao y Churún',
              'Caminata de 40 minutos por la Sabana de Mayupa',
              'Llegada a Isla Ratón',
              'Caminata hacia el Mirador de Laime',
              'Contemplación del Salto Ángel (cascada más alta del mundo)',
              'Baño en las pozas naturales al pie del Auyantepuy',
              'Almuerzo y cena tipo picnic',
              'Pernocta en hamacas en Isla Ratón (sujeto a condiciones climáticas)'
            ],
            meals: ['Desayuno', 'Almuerzo tipo picnic', 'Cena tipo picnic'],
            accommodation: 'Hamacas en Isla Ratón (o retorno al campamento según clima)'
          },
          {
            day: 3,
            title: 'Retorno y Día Libre',
            activities: [
              'Desayuno',
              'Retorno al campamento base de Canaima',
              'Navegación de regreso por los ríos',
              'Almuerzo en el campamento',
              'Tarde libre para actividades opcionales',
              'Visita a comunidad indígena Pemón',
              'Descanso y preparación de equipaje',
              'Cena',
              'Pernocta en campamento'
            ],
            meals: ['Desayuno', 'Almuerzo', 'Cena'],
            accommodation: 'Campamento básico'
          },
          {
            day: 4,
            title: 'Último Día y Retorno',
            activities: [
              'Desayuno en el campamento',
              'Tiempo libre para últimas fotos',
              'Check-out y traslado al aeropuerto de Canaima',
              'Embarque en vuelo 8:25 AM o 12:25 PM',
              'Vuelo de retorno a Maiquetía (CCS)',
              'Fin del tour'
            ],
            meals: ['Desayuno'],
            accommodation: 'N/A'
          }
        ],
        includes: [
          '✈️ Boleto aéreo ida y vuelta CCS/CAJ/CCS',
          '🚐 Recibimiento en aeropuerto y todos los traslados',
          '🏕️ 2 noches en habitaciones básicas en campamento',
          '🛏️ 1 noche en hamaca en Isla Ratón (sujeto a clima)',
          '🍽️ Todas las comidas (almuerzo día 1 hasta desayuno día 4)',
          '☕ Bebidas básicas no alcohólicas durante todo el tour',
          '⛵ Excursión fluvial al Salto Ángel (2D/1N)',
          '💦 Excursión a Salto El Sapo y Salto Hacha',
          '🏞️ Paseo por Laguna de Canaima en curiara',
          '👨‍✈️ Guía especializado durante todo el recorrido',
          '🏘️ Visita a comunidad indígena Pemón',
          '📶 WiFi en áreas comunes (Starlink)'
        ],
        not_includes: [
          '💵 Tasa aeroportuaria',
          '🎫 Impuesto Inparques: $40 USD adultos extranjeros / $20 USD niños (se paga en efectivo)',
          '🎁 Souvenirs y gastos personales',
          '🍺 Bebidas alcohólicas',
          '💳 Propinas para guías (opcionales)',
          '🏪 Compras adicionales en comunidades indígenas'
        ],
        recommendations: [
          '💉 Vacuna de fiebre amarilla recomendada (aplicar 10 días antes del viaje)',
          '💵 Llevar dólares en efectivo para gastos adicionales',
          '🦟 Repelente de mosquitos de alta potencia',
          '☀️ Protector solar biodegradable',
          '👕 Ropa ligera, cómoda y de secado rápido',
          '🥾 Calzado cerrado para caminatas y sandalias acuáticas',
          '🎒 Mochila pequeña impermeable para excursiones',
          '📸 Cámara acuática o funda impermeable para dispositivos',
          '🔦 Linterna o lámpara frontal',
          '🧴 Artículos de higiene personal biodegradables',
          '💊 Medicamentos personales',
          '🆔 Documento de identidad vigente'
        ],
        important_notes: [
          'La excursión al Salto Ángel depende de las condiciones climáticas',
          'Durante temporada seca (diciembre-abril) el caudal puede ser menor',
          'Mejor época: mayo a noviembre (temporada de lluvias)',
          'Acceso a Canaima solo por vía aérea',
          'Señal telefónica limitada (solo Movilnet en algunas áreas)',
          'WiFi disponible vía Starlink en áreas comunes del campamento',
          'No hay animales feroces en la zona, pero abundan insectos',
          'Apto para familias, niños y tercera edad con condición física moderada',
          'Los horarios de vuelo pueden variar según aerolínea',
          'Financiamiento disponible: 40% de entrada',
          'Salidas regulares: jueves a domingo (4D/3N)',
          'Se recomienda llegar al aeropuerto 2 horas antes de la salida'
        ],
        highlights: [
          '🏔️ Salto Ángel - La cascada más alta del mundo (979 metros)',
          '⛵ Navegación por ríos Carrao y Churún',
          '🥾 Caminata por la Sabana de Mayupa',
          '💦 Baño en pozas naturales al pie del Auyantepuy',
          '🏞️ Tepuyes milenarios y paisajes únicos',
          '🌅 Atardeceres espectaculares en la Laguna de Canaima',
          '👥 Contacto con cultura indígena Pemón',
          '🏕️ Experiencia de camping en la selva'
        ]
      },
      images: [
        'https://images.unsplash.com/photo-1589802829985-817e51171b92?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511576661531-b34d7da5d0bb?q=80&w=2070&auto=format&fit=crop'
      ],
      is_featured: true,
      is_published: true,
      display_order: 2
    };

    const { data: packageResult, error: packageError } = await supabase
      .from('service_inventory')
      .upsert(packageData, {
        onConflict: 'sku'
      })
      .select()
      .single();

    if (packageError) {
      throw new Error(`Error insertando paquete: ${packageError.message}`);
    }

    console.log('✅ Paquete Wey Tepuy insertado:', packageResult.id);

    // 5. Verificar inserción
    console.log('\n📊 Verificando datos insertados...\n');

    const { data: verifyPackage } = await supabase
      .from('service_inventory')
      .select(`
        name,
        sku,
        product_type,
        status,
        sale_price,
        destination:destinations(name, slug)
      `)
      .eq('sku', 'PKG-CAN-WEYTEPUY-4D3N')
      .single();

    console.log('Paquete insertado:');
    console.log('  Nombre:', verifyPackage.name);
    console.log('  SKU:', verifyPackage.sku);
    console.log('  Destino:', verifyPackage.destination.name);
    console.log('  Precio:', `$${verifyPackage.sale_price} USD`);
    console.log('  Estado:', verifyPackage.status);

    console.log('\n✨ ¡Migración completada exitosamente!');
    console.log('\n🌐 Visita http://localhost:3001/packages para ver ambos paquetes');
    console.log('📍 URL directa: http://localhost:3001/packages/wey-tepuy-canaima-y-salto-angel-4d-3n');

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error.message);
    process.exit(1);
  }
}

// Ejecutar
insertWeyTepuyPackage();
