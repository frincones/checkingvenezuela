const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuración de Supabase
const supabaseUrl = 'https://stbbckupkuxasfthlsys.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0YmJja3Vwa3V4YXNmdGhsc3lzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE4NjcyNCwiZXhwIjoyMDgzNzYyNzI0fQ.mCd-Go1STkz1BAUzACX0MhezJ2g3XU01veeNRbNJeg0';

// Crear cliente con permisos de admin
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function insertWakutoursPackage() {
  console.log('🚀 Iniciando inserción de proveedor Wakutours y paquete El Botuto...\n');

  try {
    // 1. Insertar Proveedor Wakutours
    console.log('📦 Insertando proveedor Wakutours...');
    const { data: provider, error: providerError } = await supabase
      .from('tourism_providers')
      .upsert({
        name: 'Wakutours',
        slug: 'wakutours',
        type: 'tour_operator',
        logo_url: 'https://wakutours.com/logo.png',
        description: 'Operador turístico especializado en experiencias únicas en Venezuela. Expertos en Los Roques y destinos caribeños.',
        contact_email: 'info@wakutours.com',
        contact_phone: '+58 212 1234567',
        website: 'https://wakutours.com',
        country: 'Venezuela',
        status: 'active',
        services_offered: ['Paquetes turísticos', 'Tours', 'Hospedaje', 'Excursiones'],
        destinations_covered: ['Los Roques', 'Margarita', 'Morrocoy'],
        rating: 4.8,
        verified_at: new Date().toISOString()
      }, {
        onConflict: 'slug'
      })
      .select()
      .single();

    if (providerError) {
      throw new Error(`Error insertando proveedor: ${providerError.message}`);
    }

    console.log('✅ Proveedor Wakutours insertado:', provider.id);

    // 2. Obtener IDs necesarios
    console.log('\n🔍 Obteniendo destino Los Roques...');
    const { data: destination, error: destError } = await supabase
      .from('destinations')
      .select('id')
      .eq('slug', 'los-roques')
      .single();

    if (destError || !destination) {
      throw new Error('Destino Los Roques no encontrado. Ejecuta primero la migración 003_cms_providers_inventory.sql');
    }

    console.log('✅ Destino Los Roques encontrado:', destination.id);

    console.log('🔍 Obteniendo servicio Packages...');
    const { data: service, error: serviceError } = await supabase
      .from('catalog_services')
      .select('id')
      .eq('slug', 'packages')
      .single();

    if (serviceError || !service) {
      throw new Error('Servicio Packages no encontrado. Ejecuta primero la migración 003_cms_providers_inventory.sql');
    }

    console.log('✅ Servicio Packages encontrado:', service.id);

    // 3. Insertar Paquete
    console.log('\n📦 Insertando paquete El Botuto...');
    const packageData = {
      provider_id: provider.id,
      destination_id: destination.id,
      service_id: service.id,
      name: 'Posada El Botuto - Los Roques 2D/1N',
      sku: 'PKG-LR-BOTUTO-2D1N',
      description: 'Experimenta el paraíso caribeño en Los Roques con nuestro paquete completo de 2 días y 1 noche. Incluye vuelos, hospedaje en posada con aire acondicionado, excursiones a cayos paradisíacos, comidas y todas las comodidades para una experiencia inolvidable.',
      product_type: 'package',
      cost_price: 575.00,
      sale_price: 633.00,
      currency: 'USD',
      pricing_details: {
        display_text: 'DESDE $633,00 POR PERSONA',
        price_type: 'per_person',
        base_price: 633.00,
        notes: 'Precio por persona en habitación doble/triple. No incluye tasas aeroportuarias ($31 USD) ni entrada al Parque Nacional.'
      },
      status: 'available',
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      details: {
        duration: '2 días / 1 noche',
        destination: 'Archipiélago Los Roques, Parque Nacional',
        accommodation_type: 'Posada con A/C y baño privado',
        schedule: {
          departure: '7:30 AM desde Aeropuerto de Maiquetía',
          return: '5:00 PM a Aeropuerto de Maiquetía'
        },
        itinerary: [
          {
            day: 1,
            title: 'Llegada a Los Roques y Primera Excursión',
            activities: [
              'Salida 7:30 AM desde Aeropuerto de Maiquetía (CCS)',
              'Vuelo a Gran Roque, isla principal del archipiélago',
              'Recepción y traslado a posada',
              'Check-in en habitación con aire acondicionado y baño privado',
              'Excursión a cayo cercano con almuerzo incluido',
              'Tiempo libre para snorkel, natación y actividades acuáticas',
              'Disfruta de las aguas cristalinas y arenas blancas',
              'Regreso a posada para cena'
            ],
            meals: ['Almuerzo en cayo', 'Cena en posada']
          },
          {
            day: 2,
            title: 'Exploración de Cayos y Regreso',
            activities: [
              'Desayuno en la posada',
              'Excursión a cayos Madrisky y/o Francisky',
              'Almuerzo servido en el cayo',
              'Tiempo libre en playas paradisíacas',
              'Snorkel en arrecifes de coral',
              'Fotografía de paisajes únicos',
              'Regreso a Aeropuerto de Gran Roque (LRV)',
              'Vuelo de retorno a Maiquetía (llegada 5:00 PM)'
            ],
            meals: ['Desayuno', 'Almuerzo en cayo']
          }
        ],
        includes: [
          '✈️ Boleto aéreo ida y vuelta CCS/LRV/CCS',
          '🚐 Recepción en aeropuerto y traslados',
          '🏠 1 noche de alojamiento con A/C y baño privado',
          '🍽️ 1 desayuno, 2 almuerzos en cayos, 1 cena',
          '⛵ Excursiones diarias a cayos cercanos (Madrisky y/o Francisky)',
          '🧊 Neveras con bebidas refrescantes durante excursiones',
          '🍴 Snacks durante los paseos',
          '🏖️ Sombrillas y sillas de playa',
          '👨‍✈️ Guía profesional antes, durante y después del tour'
        ],
        not_includes: [
          '💵 Tasas aeroportuarias ($31 USD)',
          '🎫 Entrada y salida al Parque Nacional Los Roques',
          '☕ Desayuno del primer día',
          '🍺 Bebidas alcohólicas',
          '🛏️ Recargo por habitación individual',
          '💳 Gastos personales',
          '🎁 Propinas (opcionales)',
          '📸 Fotografías profesionales (disponibles a solicitud)'
        ],
        recommendations: [
          'Llevar protector solar biodegradable',
          'Traer ropa ligera y traje de baño',
          'Cámara acuática para fotografías submarinas',
          'Documentos de identidad vigentes',
          'Efectivo para gastos no incluidos'
        ],
        important_notes: [
          'Los horarios de vuelo pueden variar según condiciones climáticas',
          'Se recomienda llegar al aeropuerto 1 hora antes de la salida',
          'Cupos sujetos a disponibilidad',
          'Precios pueden variar en temporada alta'
        ]
      },
      images: [
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1505142468610-359e7d316be0?q=80&w=2070&auto=format&fit=crop'
      ],
      is_featured: true,
      is_published: true,
      display_order: 1
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

    console.log('✅ Paquete El Botuto insertado:', packageResult.id);

    // 4. Verificar inserción
    console.log('\n📊 Verificando datos insertados...\n');

    const { data: verifyProvider } = await supabase
      .from('tourism_providers')
      .select('name, slug, type, status')
      .eq('slug', 'wakutours')
      .single();

    console.log('Proveedor:', verifyProvider);

    const { data: verifyPackage } = await supabase
      .from('service_inventory')
      .select('name, sku, product_type, status, sale_price')
      .eq('sku', 'PKG-LR-BOTUTO-2D1N')
      .single();

    console.log('Paquete:', verifyPackage);

    console.log('\n✨ ¡Migración completada exitosamente!');
    console.log('\n🌐 Visita http://localhost:3000/packages para ver el paquete');

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error.message);
    process.exit(1);
  }
}

// Ejecutar
insertWakutoursPackage();
