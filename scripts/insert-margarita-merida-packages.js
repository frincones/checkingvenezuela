const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = 'https://stbbckupkuxasfthlsys.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0YmJja3Vwa3V4YXNmdGhsc3lzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE4NjcyNCwiZXhwIjoyMDgzNzYyNzI0fQ.mCd-Go1STkz1BAUzACX0MhezJ2g3XU01veeNRbNJeg0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function insertMargaritaMeridaPackages() {
  console.log('🚀 Iniciando inserción de paquetes Margarita y Mérida...\n');

  try {
    // 1. Verificar/Obtener Proveedores
    console.log('📦 Verificando proveedores...');

    // Wakutours (ya debe existir)
    const { data: wakutours, error: wakutoursError } = await supabase
      .from('tourism_providers')
      .select('id, name')
      .eq('slug', 'wakutours')
      .single();

    if (wakutoursError || !wakutours) {
      throw new Error('Proveedor Wakutours no encontrado.');
    }
    console.log('✅ Wakutours encontrado:', wakutours.id);

    // Hovertours (crear si no existe)
    let hovertours = null;
    const { data: existingHovertours } = await supabase
      .from('tourism_providers')
      .select('id, name')
      .eq('slug', 'hovertours')
      .single();

    if (existingHovertours) {
      hovertours = existingHovertours;
      console.log('✅ Hovertours ya existe:', hovertours.id);
    } else {
      console.log('📍 Creando proveedor Hovertours...');
      const { data: newProvider, error: providerError } = await supabase
        .from('tourism_providers')
        .insert({
          name: 'Hovertours',
          slug: 'hovertours',
          type: 'tour_operator',
          logo_url: 'https://hovertours.com.ve/wp-content/uploads/2023/01/cropped-Logo-Hovertours-Blanco.png',
          description: 'Operador turístico especializado en paquetes todo incluido a Mérida y destinos de Venezuela. Experiencia en turismo de aventura y naturaleza en los Andes venezolanos.',
          contact_email: 'info@hovertours.com.ve',
          contact_phone: '+58 412 4969257',
          website: 'https://hovertours.com.ve',
          country: 'Venezuela',
          status: 'active',
          services_offered: ['Paquetes turísticos', 'Tours guiados', 'Hospedaje', 'Transporte'],
          destinations_covered: ['Mérida', 'Catatumbo', 'Los Andes'],
          rating: 4.7,
          verified_at: new Date().toISOString()
        })
        .select()
        .single();

      if (providerError) {
        throw new Error(`Error creando Hovertours: ${providerError.message}`);
      }

      hovertours = newProvider;
      console.log('✅ Hovertours creado:', hovertours.id);
    }

    // 2. Verificar/Crear Destinos
    console.log('\n🔍 Verificando destinos...');

    // Isla Margarita
    let margarita = null;
    const { data: existingMargarita } = await supabase
      .from('destinations')
      .select('id, name, slug')
      .eq('slug', 'isla-margarita')
      .single();

    if (existingMargarita) {
      margarita = existingMargarita;
      console.log('✅ Isla Margarita ya existe:', margarita.id);
    } else {
      console.log('📍 Creando destino Isla Margarita...');
      const { data: newDest, error: destError } = await supabase
        .from('destinations')
        .insert({
          name: 'Isla Margarita',
          slug: 'isla-margarita',
          country: 'Venezuela',
          description: 'La Perla del Caribe venezolano. Isla paradisíaca con playas de ensueño, centros comerciales libres de impuestos, deportes acuáticos y vida nocturna vibrante.',
          image_url: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?q=80&w=2070&auto=format&fit=crop',
          is_featured: true,
          climate: 'Tropical seco',
          best_time_to_visit: 'Todo el año (mejor época: diciembre a mayo)'
        })
        .select()
        .single();

      if (destError) {
        throw new Error(`Error creando Isla Margarita: ${destError.message}`);
      }

      margarita = newDest;
      console.log('✅ Isla Margarita creada:', margarita.id);
    }

    // Mérida
    let merida = null;
    const { data: existingMerida } = await supabase
      .from('destinations')
      .select('id, name, slug')
      .eq('slug', 'merida')
      .single();

    if (existingMerida) {
      merida = existingMerida;
      console.log('✅ Mérida ya existe:', merida.id);
    } else {
      console.log('📍 Creando destino Mérida...');
      const { data: newDest, error: destError } = await supabase
        .from('destinations')
        .insert({
          name: 'Mérida',
          slug: 'merida',
          country: 'Venezuela',
          description: 'La Ciudad de los Caballeros. Paraíso andino con el teleférico más alto y largo del mundo, frailejones, pueblos pintorescos y gastronomía tradicional de páramo.',
          image_url: 'https://images.unsplash.com/photo-1464207687429-7505649dae38?q=80&w=2073&auto=format&fit=crop',
          is_featured: true,
          climate: 'Clima de montaña frío',
          best_time_to_visit: 'Todo el año (mejor época: octubre a mayo - época seca)'
        })
        .select()
        .single();

      if (destError) {
        throw new Error(`Error creando Mérida: ${destError.message}`);
      }

      merida = newDest;
      console.log('✅ Mérida creada:', merida.id);
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

    // 4. Insertar Paquete Margarita - Sun Sol Unik
    console.log('\n📦 Insertando paquete Sun Sol Unik - Isla Margarita 3D/2N...');
    const margaritaPackage = {
      provider_id: wakutours.id,
      destination_id: margarita.id,
      service_id: service.id,
      name: 'Sun Sol Unik - Isla Margarita VIP 3D/2N',
      sku: 'PKG-MAR-UNIK-3D2N',
      description: 'Disfruta de una experiencia VIP en la Perla del Caribe. Paquete todo incluido con vuelos, hospedaje de lujo, acceso ilimitado a club de playa, todas las comidas, bebidas alcohólicas premium y actividades recreativas. Incluye acceso a Gold\'s Gym y spa de hotel con piscina y jacuzzi en terraza.',
      product_type: 'package',
      cost_price: 425.00,
      sale_price: 470.00,
      currency: 'USD',
      pricing_details: {
        display_text: 'DESDE $470,00 POR PERSONA',
        price_type: 'per_person',
        base_price: 470.00,
        category: 'VIP - Todo Incluido',
        notes: 'Precio por persona en habitación doble. No incluye traslados aeropuerto-hotel ni tasas aeroportuarias.'
      },
      status: 'available',
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      details: {
        duration: '3 días / 2 noches',
        destination: 'Isla de Margarita - Perla del Caribe',
        accommodation_type: 'Hotel VIP con todas las comodidades',
        category: 'Playa y Relax',
        difficulty: 'Fácil',
        schedule: {
          departure: '9:00 AM desde Caracas o Valencia (sujeto a disponibilidad)',
          return: '6:00 PM desde Margarita (sujeto a disponibilidad)',
          checkin: 'Después de las 3:00 PM',
          checkout: 'Antes de las 12:00 PM'
        },
        itinerary: [
          {
            day: 1,
            title: 'Llegada a Isla Margarita',
            activities: [
              'Vuelo desde Caracas o Valencia a Margarita',
              'Traslado al hotel (no incluido, coordinación previa)',
              'Check-in en hotel VIP después de las 3:00 PM',
              'Bienvenida y orientación del hotel',
              'Tarde libre para disfrutar de las instalaciones del hotel',
              'Acceso a piscina y jacuzzi en terraza',
              'Cena tipo buffet en el hotel',
              'Noche libre para explorar la zona o descansar'
            ],
            meals: ['Cena'],
            accommodation: 'Hotel VIP con todas las amenidades'
          },
          {
            day: 2,
            title: 'Día de Playa VIP - SUN SOL PASS',
            activities: [
              'Desayuno buffet en el hotel',
              'Traslado a Ecoland Beach Club (10:00 AM - 4:15 PM)',
              'Acceso completo con SUN SOL PASS',
              'Disfrute de todas las instalaciones de playa',
              'Almuerzo tipo buffet gourmet',
              'Bebidas alcohólicas nacionales ilimitadas (ron, cerveza, vino)',
              'Bebidas no alcohólicas ilimitadas (jugos, refrescos, agua)',
              'Snacks durante todo el día',
              'Actividades recreativas: kayak, paddle board, voleibol de playa',
              'Música en vivo y animación',
              'Zona de sombrillas y camastros VIP',
              'Retorno al hotel en la tarde',
              'Acceso opcional a Gold\'s Gym Margarita',
              'Cena en el hotel',
              'Noche libre'
            ],
            meals: ['Desayuno buffet', 'Almuerzo buffet en club de playa', 'Snacks ilimitados', 'Cena'],
            accommodation: 'Hotel VIP'
          },
          {
            day: 3,
            title: 'Último Día y Retorno',
            activities: [
              'Desayuno buffet en el hotel',
              'Check-out antes de las 12:00 PM',
              'Tiempo libre en el hotel hasta el vuelo',
              'Última sesión de piscina y jacuzzi',
              'Traslado al aeropuerto (no incluido)',
              'Vuelo de retorno a Caracas o Valencia',
              'Fin del tour'
            ],
            meals: ['Desayuno buffet'],
            accommodation: 'N/A'
          }
        ],
        includes: [
          '✈️ Boleto aéreo ida y vuelta desde Caracas o Valencia',
          '🏨 2 noches en hotel VIP categoría premium',
          '🍽️ Todas las comidas: desayuno, almuerzo, cena y snacks',
          '🍹 Bebidas alcohólicas nacionales ilimitadas (categoría Deluxe)',
          '🥤 Bebidas no alcohólicas ilimitadas',
          '🏖️ Acceso SUN SOL PASS a Ecoland Beach Club (10:00 AM - 4:15 PM)',
          '🎾 Actividades recreativas en club de playa',
          '💪 Acceso a Gold\'s Gym Margarita',
          '🏊 Acceso a piscina y jacuzzi en terraza del hotel',
          '📶 WiFi en instalaciones del hotel',
          '👨‍✈️ Asesoramiento personalizado durante todo el tour'
        ],
        not_includes: [
          '🚐 Traslados aeropuerto-hotel-aeropuerto',
          '💵 Tasas aeroportuarias',
          '🎁 Souvenirs y gastos personales',
          '💳 Propinas (opcionales)',
          '🎢 Excursiones adicionales no mencionadas',
          '🏪 Compras en centros comerciales',
          '🎭 Actividades nocturnas fuera del hotel',
          '🚗 Alquiler de vehículos'
        ],
        recommendations: [
          '☀️ Llevar protector solar de alta protección',
          '👙 Traje de baño y ropa de playa',
          '👟 Calzado cómodo y sandalias',
          '🕶️ Gafas de sol y sombrero',
          '📸 Cámara para capturar momentos únicos',
          '💵 Efectivo para gastos no incluidos',
          '🆔 Documento de identidad vigente',
          '💳 Tarjetas de crédito para compras en zona libre de impuestos',
          '🧴 Artículos de higiene personal',
          '👕 Ropa ligera y fresca (clima tropical)'
        ],
        important_notes: [
          'Los horarios de vuelo están sujetos a disponibilidad y cambios de aerolínea',
          'Check-in: después de las 3:00 PM / Check-out: antes de las 12:00 PM',
          'Bebidas alcohólicas solo para mayores de 18 años',
          'Se recomienda agregar días adicionales para excursiones a otras playas',
          'Margarita cuenta con zona franca (compras libre de impuestos)',
          'Actividades acuáticas sujetas a condiciones climáticas',
          'Reserva con anticipación para fechas de temporada alta (vacaciones y feriados)',
          'Consultar sobre descuentos para grupos y familias'
        ],
        highlights: [
          '🏖️ Club de playa VIP con bebidas ilimitadas',
          '🍹 Todo incluido: comidas, bebidas y actividades',
          '✈️ Vuelos incluidos desde Caracas/Valencia',
          '🏊 Piscina y jacuzzi en terraza',
          '💪 Acceso a gimnasio premium',
          '🎾 Actividades recreativas variadas',
          '🌅 Atardeceres caribeños inolvidables',
          '🛍️ Cerca de zonas comerciales duty-free'
        ]
      },
      images: [
        'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1559827260-dc66d52bef19?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop'
      ],
      is_featured: true,
      is_published: true,
      display_order: 3
    };

    const { data: margaritaResult, error: margaritaError } = await supabase
      .from('service_inventory')
      .upsert(margaritaPackage, { onConflict: 'sku' })
      .select()
      .single();

    if (margaritaError) {
      throw new Error(`Error insertando paquete Margarita: ${margaritaError.message}`);
    }

    console.log('✅ Paquete Margarita insertado:', margaritaResult.id);

    // 5. Insertar Paquete Mérida - Todo Incluido
    console.log('\n📦 Insertando paquete Mérida Tradicional - Todo Incluido 3D/2N...');
    const meridaPackage = {
      provider_id: hovertours.id,
      destination_id: merida.id,
      service_id: service.id,
      name: 'Mérida Tradicional - Todo Incluido 3D/2N',
      sku: 'PKG-MER-TRADICIONAL-3D2N',
      description: 'Descubre la magia de los Andes venezolanos en este paquete todo incluido. Recorre el páramo merideño con sus paisajes únicos, sube al teleférico más alto y largo del mundo, conoce pueblos pintorescos con arquitectura colonial, disfruta de la gastronomía tradicional andina y vive una experiencia cultural inolvidable en la Ciudad de los Caballeros.',
      product_type: 'package',
      cost_price: 400.00,
      sale_price: 450.00,
      currency: 'USD',
      pricing_details: {
        display_text: 'DESDE $450,00 POR PERSONA',
        price_type: 'per_person',
        base_price: 450.00,
        category: 'Todo Incluido - Cultural y Naturaleza',
        notes: 'Precio por persona en habitación doble en posadas del páramo. Incluye vuelo directo, todas las comidas y excursiones.'
      },
      status: 'available',
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      details: {
        duration: '3 días / 2 noches',
        destination: 'Mérida - Los Andes Venezolanos',
        accommodation_type: 'Posadas tradicionales del páramo',
        category: 'Cultura, Naturaleza y Aventura',
        difficulty: 'Moderada',
        schedule: {
          departure: 'Vuelo directo desde Caracas o Margarita (horario por confirmar)',
          return: 'Regreso en vuelo directo (horario por confirmar)'
        },
        itinerary: [
          {
            day: 1,
            title: 'Llegada a Mérida - Bienvenida Andina',
            activities: [
              'Vuelo directo desde Caracas o Isla Margarita',
              'Llegada al Aeropuerto Alberto Carnevalli de Mérida',
              'Recibimiento por guías locales',
              'Traslado a posada tradicional del páramo',
              'Check-in y acomodación',
              'Almuerzo con recetas tradicionales andinas (arepas de trigo, pisca andina)',
              'Tour de orientación por Mérida ciudad',
              'Visita al centro histórico y Plaza Bolívar',
              'Recorrido por calles coloniales',
              'Visita a heladerías artesanales (famosas por sus sabores únicos)',
              'Cena con gastronomía del páramo',
              'Noche libre para descansar o paseo nocturno'
            ],
            meals: ['Almuerzo andino', 'Cena tradicional'],
            accommodation: 'Posada del páramo'
          },
          {
            day: 2,
            title: 'Teleférico y Páramo - Experiencia de Altura',
            activities: [
              'Desayuno tradicional andino (arepas, queso ahumado, café de altura)',
              'Traslado a estación del Teleférico de Mérida',
              'Ascenso en el teleférico más alto y largo del mundo',
              'Paradas en estaciones intermedias (La Montaña, La Aguada)',
              'Llegada a Pico Espejo (4,765 msnm) - vistas panorámicas impresionantes',
              'Tiempo para fotografías de los picos andinos',
              'Observación de frailejones (planta emblemática del páramo)',
              'Almuerzo tipo picnic o en restaurante de estación',
              'Descenso y visita a pueblos del páramo',
              'Recorrido por Mucuchíes y Los Nevados',
              'Visita a capilla de piedra',
              'Compra de artesanías locales (ruanas, tejidos, dulces de leche)',
              'Cena en posada con platos típicos',
              'Fogata nocturna (opcional, según clima)'
            ],
            meals: ['Desayuno andino', 'Almuerzo en el páramo', 'Cena tradicional'],
            accommodation: 'Posada del páramo'
          },
          {
            day: 3,
            title: 'Miradores y Retorno - Despedida del Páramo',
            activities: [
              'Desayuno final en la posada',
              'Tour por miradores panorámicos de Mérida',
              'Visita al Mirador de Las Heroínas',
              'Parada en La Venezuela de Antier (museo viviente)',
              'Recorrido por pueblos con guías locales',
              'Conoce sobre cultivos de papa, fresa y trucha',
              'Almuerzo de despedida con especialidades andinas',
              'Tiempo libre para últimas compras',
              'Traslado al aeropuerto',
              'Vuelo de retorno a Caracas o Margarita',
              'Fin del tour'
            ],
            meals: ['Desayuno', 'Almuerzo de despedida'],
            accommodation: 'N/A'
          }
        ],
        includes: [
          '✈️ Vuelo directo ida y vuelta desde Caracas o Margarita',
          '🏠 2 noches en posadas tradicionales del páramo',
          '🍽️ Todas las comidas: desayunos, almuerzos y cenas con recetas andinas',
          '🚡 Tour completo del Teleférico de Mérida (el más largo y alto del mundo)',
          '🏔️ Tour guiado por el páramo con guías locales expertos',
          '👨‍🏫 Visitas a pueblos tradicionales: Mucuchíes, Los Nevados',
          '🌄 Recorridos por miradores panorámicos',
          '🏛️ Tour por centro histórico de Mérida',
          '🚐 Todos los traslados terrestres durante el tour',
          '👥 Guías locales especializados en español',
          '🎒 Seguro de viaje básico'
        ],
        not_includes: [
          '🎁 Souvenirs y artesanías',
          '💵 Gastos personales',
          '💳 Propinas para guías y personal de servicio',
          '🍺 Bebidas alcohólicas no especificadas',
          '📸 Fotografías profesionales',
          '🎢 Actividades opcionales no mencionadas',
          '🚑 Seguro médico internacional',
          '🏨 Noches adicionales de hospedaje'
        ],
        recommendations: [
          '🧥 Ropa abrigada (chaqueta, suéter, pantalones largos)',
          '🧤 Guantes, gorro y bufanda para el teleférico',
          '👟 Calzado cerrado y cómodo para caminatas',
          '☀️ Protector solar de alta protección (el sol es fuerte en altura)',
          '😷 Protector labial (los labios se resecan con el clima seco)',
          '💊 Medicamentos personales y para el soroche (mal de altura)',
          '📸 Cámara con batería extra (el frío descarga las baterías rápido)',
          '💧 Botella de agua reutilizable',
          '🎒 Mochila pequeña para excursiones',
          '💵 Efectivo para compras en pueblos (muchos no aceptan tarjetas)',
          '🆔 Documento de identidad vigente'
        ],
        important_notes: [
          'El teleférico puede cerrar por mantenimiento o condiciones climáticas adversas',
          'El clima en Mérida es frío (8°C - 24°C), llevar ropa abrigada',
          'Algunas personas pueden experimentar soroche (mal de altura) en Pico Espejo',
          'Se recomienda aclimatación gradual para personas sensibles a la altura',
          'Consultar disponibilidad con anticipación, especialmente en temporada alta',
          'Los vuelos están sujetos a condiciones climáticas',
          'Horarios pueden variar según disponibilidad de servicios',
          'Ideal para familias, parejas y grupos de amigos',
          'No recomendado para personas con problemas cardíacos sin consulta médica previa'
        ],
        highlights: [
          '🚡 Teleférico más alto y largo del mundo (Pico Espejo 4,765 msnm)',
          '🏔️ Frailejones y paisajes únicos del páramo',
          '🏘️ Pueblos pintorescos con arquitectura colonial',
          '🍲 Gastronomía andina auténtica',
          '🌄 Miradores con vistas panorámicas espectaculares',
          '👥 Guías locales con conocimiento profundo de la región',
          '🎨 Artesanías tradicionales (ruanas, tejidos)',
          '🧀 Productos locales: queso ahumado, dulce de leche'
        ]
      },
      images: [
        'https://images.unsplash.com/photo-1464207687429-7505649dae38?q=80&w=2073&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1519904981063-b0cf448d479e?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2070&auto=format&fit=crop'
      ],
      is_featured: true,
      is_published: true,
      display_order: 4
    };

    const { data: meridaResult, error: meridaError } = await supabase
      .from('service_inventory')
      .upsert(meridaPackage, { onConflict: 'sku' })
      .select()
      .single();

    if (meridaError) {
      throw new Error(`Error insertando paquete Mérida: ${meridaError.message}`);
    }

    console.log('✅ Paquete Mérida insertado:', meridaResult.id);

    // 6. Verificar inserción
    console.log('\n📊 Verificando datos insertados...\n');

    const { data: allPackages } = await supabase
      .from('service_inventory')
      .select(`
        name,
        sku,
        product_type,
        status,
        sale_price,
        destination:destinations(name, slug)
      `)
      .eq('product_type', 'package')
      .eq('is_published', true)
      .order('display_order', { ascending: true });

    console.log(`Total de paquetes publicados: ${allPackages?.length || 0}\n`);

    allPackages?.forEach((pkg, index) => {
      console.log(`${index + 1}. ${pkg.name}`);
      console.log(`   SKU: ${pkg.sku}`);
      console.log(`   Destino: ${pkg.destination?.name || 'N/A'}`);
      console.log(`   Precio: $${pkg.sale_price} USD`);
      console.log('');
    });

    console.log('✨ ¡Migración completada exitosamente!');
    console.log('\n🌐 Accede a los paquetes en: http://localhost:3002/packages\n');

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error.message);
    process.exit(1);
  }
}

// Ejecutar
insertMargaritaMeridaPackages();
