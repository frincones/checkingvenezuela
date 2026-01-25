-- =============================================
-- INSERTAR PROVEEDOR WAKUTOURS Y PAQUETE EL BOTUTO
-- Versión alternativa con subconsultas inline
-- =============================================

-- 1. Insertar Proveedor: Wakutours
INSERT INTO public.tourism_providers (
  name,
  slug,
  type,
  logo_url,
  description,
  contact_email,
  contact_phone,
  website,
  country,
  status,
  services_offered,
  destinations_covered,
  rating,
  verified_at
) VALUES (
  'Wakutours',
  'wakutours',
  'tour_operator',
  'https://wakutours.com/logo.png',
  'Operador turístico especializado en experiencias únicas en Venezuela. Expertos en Los Roques y destinos caribeños.',
  'info@wakutours.com',
  '+58 212 1234567',
  'https://wakutours.com',
  'Venezuela',
  'active',
  '["Paquetes turísticos", "Tours", "Hospedaje", "Excursiones"]',
  '["Los Roques", "Margarita", "Morrocoy"]',
  4.8,
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  website = EXCLUDED.website,
  status = EXCLUDED.status,
  updated_at = NOW();

-- 2. Insertar Paquete: Posada El Botuto - Los Roques 2D/1N
-- Primero, obtenemos los IDs necesarios
DO $$
DECLARE
  v_provider_id UUID;
  v_destination_id UUID;
  v_service_id UUID;
BEGIN
  -- Obtener IDs
  SELECT id INTO v_provider_id FROM public.tourism_providers WHERE slug = 'wakutours';
  SELECT id INTO v_destination_id FROM public.destinations WHERE slug = 'los-roques';
  SELECT id INTO v_service_id FROM public.catalog_services WHERE slug = 'packages';

  -- Verificar que existen los registros necesarios
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Proveedor Wakutours no encontrado';
  END IF;

  IF v_destination_id IS NULL THEN
    RAISE EXCEPTION 'Destino Los Roques no encontrado';
  END IF;

  IF v_service_id IS NULL THEN
    RAISE EXCEPTION 'Servicio Packages no encontrado';
  END IF;

  -- Insertar o actualizar el paquete
  INSERT INTO public.service_inventory (
    provider_id,
    destination_id,
    service_id,
    name,
    sku,
    description,
    product_type,
    cost_price,
    sale_price,
    currency,
    pricing_details,
    status,
    valid_from,
    valid_until,
    details,
    images,
    is_featured,
    is_published,
    display_order
  ) VALUES (
    v_provider_id,
    v_destination_id,
    v_service_id,
    'Posada El Botuto - Los Roques 2D/1N',
    'PKG-LR-BOTUTO-2D1N',
    'Experimenta el paraíso caribeño en Los Roques con nuestro paquete completo de 2 días y 1 noche. Incluye vuelos, hospedaje en posada con aire acondicionado, excursiones a cayos paradisíacos, comidas y todas las comodidades para una experiencia inolvidable.',
    'package',
    575.00,
    633.00,
    'USD',
    '{
      "display_text": "DESDE $633,00 POR PERSONA",
      "price_type": "per_person",
      "base_price": 633.00,
      "notes": "Precio por persona en habitación doble/triple. No incluye tasas aeroportuarias ($31 USD) ni entrada al Parque Nacional."
    }',
    'available',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 year',
    '{
      "duration": "2 días / 1 noche",
      "destination": "Archipiélago Los Roques, Parque Nacional",
      "accommodation_type": "Posada con A/C y baño privado",
      "schedule": {
        "departure": "7:30 AM desde Aeropuerto de Maiquetía",
        "return": "5:00 PM a Aeropuerto de Maiquetía"
      },
      "itinerary": [
        {
          "day": 1,
          "title": "Llegada a Los Roques y Primera Excursión",
          "activities": [
            "Salida 7:30 AM desde Aeropuerto de Maiquetía (CCS)",
            "Vuelo a Gran Roque, isla principal del archipiélago",
            "Recepción y traslado a posada",
            "Check-in en habitación con aire acondicionado y baño privado",
            "Excursión a cayo cercano con almuerzo incluido",
            "Tiempo libre para snorkel, natación y actividades acuáticas",
            "Disfruta de las aguas cristalinas y arenas blancas",
            "Regreso a posada para cena"
          ],
          "meals": ["Almuerzo en cayo", "Cena en posada"]
        },
        {
          "day": 2,
          "title": "Exploración de Cayos y Regreso",
          "activities": [
            "Desayuno en la posada",
            "Excursión a cayos Madrisky y/o Francisky",
            "Almuerzo servido en el cayo",
            "Tiempo libre en playas paradisíacas",
            "Snorkel en arrecifes de coral",
            "Fotografía de paisajes únicos",
            "Regreso a Aeropuerto de Gran Roque (LRV)",
            "Vuelo de retorno a Maiquetía (llegada 5:00 PM)"
          ],
          "meals": ["Desayuno", "Almuerzo en cayo"]
        }
      ],
      "includes": [
        "✈️ Boleto aéreo ida y vuelta CCS/LRV/CCS",
        "🚐 Recepción en aeropuerto y traslados",
        "🏠 1 noche de alojamiento con A/C y baño privado",
        "🍽️ 1 desayuno, 2 almuerzos en cayos, 1 cena",
        "⛵ Excursiones diarias a cayos cercanos (Madrisky y/o Francisky)",
        "🧊 Neveras con bebidas refrescantes durante excursiones",
        "🍴 Snacks durante los paseos",
        "🏖️ Sombrillas y sillas de playa",
        "👨‍✈️ Guía profesional antes, durante y después del tour"
      ],
      "not_includes": [
        "💵 Tasas aeroportuarias ($31 USD)",
        "🎫 Entrada y salida al Parque Nacional Los Roques",
        "☕ Desayuno del primer día",
        "🍺 Bebidas alcohólicas",
        "🛏️ Recargo por habitación individual",
        "💳 Gastos personales",
        "🎁 Propinas (opcionales)",
        "📸 Fotografías profesionales (disponibles a solicitud)"
      ],
      "recommendations": [
        "Llevar protector solar biodegradable",
        "Traer ropa ligera y traje de baño",
        "Cámara acuática para fotografías submarinas",
        "Documentos de identidad vigentes",
        "Efectivo para gastos no incluidos"
      ],
      "important_notes": [
        "Los horarios de vuelo pueden variar según condiciones climáticas",
        "Se recomienda llegar al aeropuerto 1 hora antes de la salida",
        "Cupos sujetos a disponibilidad",
        "Precios pueden variar en temporada alta"
      ]
    }',
    ARRAY[
      'https://images.unsplash.com/photo-1559827260-dc66d52bef19?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2070&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1505142468610-359e7d316be0?q=80&w=2070&auto=format&fit=crop'
    ],
    true,
    true,
    1
  )
  ON CONFLICT (sku) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    cost_price = EXCLUDED.cost_price,
    sale_price = EXCLUDED.sale_price,
    pricing_details = EXCLUDED.pricing_details,
    details = EXCLUDED.details,
    images = EXCLUDED.images,
    is_featured = EXCLUDED.is_featured,
    is_published = EXCLUDED.is_published,
    updated_at = NOW();

  RAISE NOTICE 'Paquete insertado/actualizado exitosamente';
END $$;

-- 3. Verificar inserción
SELECT
  'Proveedor insertado:' as tipo,
  name,
  slug,
  type::text,
  status::text,
  created_at
FROM public.tourism_providers
WHERE slug = 'wakutours'
UNION ALL
SELECT
  'Paquete insertado:' as tipo,
  name,
  sku as slug,
  product_type::text as type,
  status::text,
  created_at
FROM public.service_inventory
WHERE sku = 'PKG-LR-BOTUTO-2D1N';

-- =============================================
-- FIN DE LA MIGRACIÓN
-- =============================================
