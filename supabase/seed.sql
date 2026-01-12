-- =============================================
-- CHECK-IN VENEZUELA - SEED DATA
-- Datos de prueba para desarrollo y testing
-- =============================================

-- =============================================
-- 1. DATOS DE AEROPUERTOS (Venezuela y principales destinos)
-- =============================================

INSERT INTO public.airports (id, iata_code, name, city, state, country, latitude, longitude, timezone, facilities, image) VALUES
-- Venezuela
('CCS', 'CCS', 'Aeropuerto Internacional Simón Bolívar', 'Maiquetía', 'La Guaira', 'Venezuela', 10.6012, -66.9913, 'America/Caracas', ARRAY['wifi', 'restaurant', 'atm', 'car_rental'], '/images/airports/ccs.jpg'),
('MAR', 'MAR', 'Aeropuerto Internacional La Chinita', 'Maracaibo', 'Zulia', 'Venezuela', 10.5582, -71.7279, 'America/Caracas', ARRAY['wifi', 'restaurant', 'atm'], '/images/airports/mar.jpg'),
('VLN', 'VLN', 'Aeropuerto Internacional Arturo Michelena', 'Valencia', 'Carabobo', 'Venezuela', 10.1497, -67.9284, 'America/Caracas', ARRAY['wifi', 'restaurant'], '/images/airports/vln.jpg'),
('BLA', 'BLA', 'Aeropuerto Internacional General José Antonio Anzoátegui', 'Barcelona', 'Anzoátegui', 'Venezuela', 10.1071, -64.6892, 'America/Caracas', ARRAY['wifi', 'restaurant'], '/images/airports/bla.jpg'),
('PMV', 'PMV', 'Aeropuerto Internacional del Caribe Santiago Mariño', 'Porlamar', 'Nueva Esparta', 'Venezuela', 10.9126, -63.9664, 'America/Caracas', ARRAY['wifi', 'restaurant', 'beach_shuttle'], '/images/airports/pmv.jpg'),

-- Caribe
('CUN', 'CUN', 'Aeropuerto Internacional de Cancún', 'Cancún', 'Quintana Roo', 'México', 21.0365, -86.8771, 'America/Cancun', ARRAY['wifi', 'restaurant', 'atm', 'car_rental', 'hotel_shuttle'], '/images/airports/cun.jpg'),
('SJU', 'SJU', 'Aeropuerto Internacional Luis Muñoz Marín', 'San Juan', 'Puerto Rico', 'Puerto Rico', 18.4394, -66.0018, 'America/Puerto_Rico', ARRAY['wifi', 'restaurant', 'atm', 'car_rental'], '/images/airports/sju.jpg'),
('PUJ', 'PUJ', 'Aeropuerto Internacional de Punta Cana', 'Punta Cana', 'La Altagracia', 'República Dominicana', 18.5674, -68.3634, 'America/Santo_Domingo', ARRAY['wifi', 'restaurant', 'atm', 'car_rental'], '/images/airports/puj.jpg'),
('AUA', 'AUA', 'Aeropuerto Internacional Reina Beatrix', 'Oranjestad', NULL, 'Aruba', 12.5014, -70.0152, 'America/Aruba', ARRAY['wifi', 'restaurant', 'atm', 'car_rental'], '/images/airports/aua.jpg'),
('CUR', 'CUR', 'Aeropuerto Internacional Hato', 'Willemstad', NULL, 'Curazao', 12.1889, -68.9598, 'America/Curacao', ARRAY['wifi', 'restaurant', 'atm', 'car_rental'], '/images/airports/cur.jpg'),

-- Sudamérica
('BOG', 'BOG', 'Aeropuerto Internacional El Dorado', 'Bogotá', 'Cundinamarca', 'Colombia', 4.7016, -74.1469, 'America/Bogota', ARRAY['wifi', 'restaurant', 'atm', 'car_rental', 'hotel_shuttle'], '/images/airports/bog.jpg'),
('MDE', 'MDE', 'Aeropuerto Internacional José María Córdova', 'Medellín', 'Antioquia', 'Colombia', 6.1645, -75.4231, 'America/Bogota', ARRAY['wifi', 'restaurant', 'atm', 'car_rental'], '/images/airports/mde.jpg'),
('PTY', 'PTY', 'Aeropuerto Internacional de Tocumen', 'Ciudad de Panamá', 'Panamá', 'Panamá', 9.0714, -79.3835, 'America/Panama', ARRAY['wifi', 'restaurant', 'atm', 'car_rental', 'hotel_shuttle'], '/images/airports/pty.jpg'),
('LIM', 'LIM', 'Aeropuerto Internacional Jorge Chávez', 'Lima', 'Lima', 'Perú', -12.0219, -77.1143, 'America/Lima', ARRAY['wifi', 'restaurant', 'atm', 'car_rental'], '/images/airports/lim.jpg'),
('GRU', 'GRU', 'Aeropuerto Internacional de São Paulo-Guarulhos', 'São Paulo', 'São Paulo', 'Brasil', -23.4356, -46.4731, 'America/Sao_Paulo', ARRAY['wifi', 'restaurant', 'atm', 'car_rental', 'hotel_shuttle'], '/images/airports/gru.jpg'),

-- USA
('MIA', 'MIA', 'Aeropuerto Internacional de Miami', 'Miami', 'Florida', 'Estados Unidos', 25.7959, -80.2870, 'America/New_York', ARRAY['wifi', 'restaurant', 'atm', 'car_rental', 'hotel_shuttle'], '/images/airports/mia.jpg'),
('FLL', 'FLL', 'Aeropuerto Internacional de Fort Lauderdale-Hollywood', 'Fort Lauderdale', 'Florida', 'Estados Unidos', 26.0726, -80.1527, 'America/New_York', ARRAY['wifi', 'restaurant', 'atm', 'car_rental'], '/images/airports/fll.jpg'),
('JFK', 'JFK', 'Aeropuerto Internacional John F. Kennedy', 'Nueva York', 'New York', 'Estados Unidos', 40.6413, -73.7781, 'America/New_York', ARRAY['wifi', 'restaurant', 'atm', 'car_rental', 'hotel_shuttle'], '/images/airports/jfk.jpg'),

-- Europa
('MAD', 'MAD', 'Aeropuerto Adolfo Suárez Madrid-Barajas', 'Madrid', 'Madrid', 'España', 40.4983, -3.5676, 'Europe/Madrid', ARRAY['wifi', 'restaurant', 'atm', 'car_rental', 'hotel_shuttle'], '/images/airports/mad.jpg')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 2. DATOS DE AEROLÍNEAS
-- =============================================

INSERT INTO public.airlines (id, iata_code, name, logo, contact_phone, contact_email, contact_website, airline_policy) VALUES
('LA', 'LA', 'LATAM Airlines', '/images/airlines/latam.png', '+56 2 2565 8200', 'contacto@latam.com', 'https://www.latam.com', '{"baggage": {"carry_on": {"weight_kg": 10, "dimensions": "55x35x25cm"}, "checked": {"weight_kg": 23, "fee_usd": 0}}, "cancellation": {"allowed": true, "fee_usd": 50, "deadline_hours": 24}}'),
('AV', 'AV', 'Avianca', '/images/airlines/avianca.png', '+57 1 401 3434', 'contacto@avianca.com', 'https://www.avianca.com', '{"baggage": {"carry_on": {"weight_kg": 10, "dimensions": "55x35x25cm"}, "checked": {"weight_kg": 23, "fee_usd": 0}}, "cancellation": {"allowed": true, "fee_usd": 75, "deadline_hours": 24}}'),
('CM', 'CM', 'Copa Airlines', '/images/airlines/copa.png', '+507 217 2672', 'contacto@copaair.com', 'https://www.copaair.com', '{"baggage": {"carry_on": {"weight_kg": 10, "dimensions": "55x35x25cm"}, "checked": {"weight_kg": 23, "fee_usd": 0}}, "cancellation": {"allowed": true, "fee_usd": 100, "deadline_hours": 24}}'),
('AA', 'AA', 'American Airlines', '/images/airlines/american.png', '+1 800 433 7300', 'customer@aa.com', 'https://www.aa.com', '{"baggage": {"carry_on": {"weight_kg": 10, "dimensions": "56x36x23cm"}, "checked": {"weight_kg": 23, "fee_usd": 35}}, "cancellation": {"allowed": true, "fee_usd": 200, "deadline_hours": 24}}'),
('IB', 'IB', 'Iberia', '/images/airlines/iberia.png', '+34 901 111 500', 'clientes@iberia.es', 'https://www.iberia.com', '{"baggage": {"carry_on": {"weight_kg": 10, "dimensions": "56x40x25cm"}, "checked": {"weight_kg": 23, "fee_usd": 0}}, "cancellation": {"allowed": true, "fee_usd": 75, "deadline_hours": 24}}'),
('V0', 'V0', 'Conviasa', '/images/airlines/conviasa.png', '+58 212 508 1111', 'atencion@conviasa.aero', 'https://www.conviasa.aero', '{"baggage": {"carry_on": {"weight_kg": 8, "dimensions": "55x35x25cm"}, "checked": {"weight_kg": 23, "fee_usd": 0}}, "cancellation": {"allowed": true, "fee_usd": 30, "deadline_hours": 48}}'),
('2K', '2K', 'Avior Airlines', '/images/airlines/avior.png', '+58 241 824 8464', 'info@aviorair.com', 'https://www.aviorair.com', '{"baggage": {"carry_on": {"weight_kg": 8, "dimensions": "55x35x25cm"}, "checked": {"weight_kg": 20, "fee_usd": 0}}, "cancellation": {"allowed": true, "fee_usd": 25, "deadline_hours": 48}}')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 3. DATOS DE HOTELES
-- =============================================

INSERT INTO public.hotels (id, slug, name, description, category, parking_included, address_street, address_city, address_state, address_postal_code, address_country, coordinates_lat, coordinates_lon, amenities, features, images, status, total_rooms, tags, policies) VALUES
-- Venezuela - Caracas
(uuid_generate_v4(), 'hotel-tamanaco-caracas', 'Hotel Tamanaco InterContinental', 'Hotel de lujo ubicado en Las Mercedes, Caracas. Ofrece vistas panorámicas de la ciudad y el Ávila, con instalaciones de primera clase.', '5 estrellas', true, 'Av. Principal de Las Mercedes', 'Caracas', 'Distrito Capital', '1060', 'Venezuela', 10.4806, -66.8541, ARRAY['wifi', 'pool', 'spa', 'gym', 'restaurant', 'bar', 'room_service', 'parking', 'business_center'], ARRAY['mountain_view', 'city_view', 'concierge', 'valet_parking'], ARRAY['/images/hotels/tamanaco-1.jpg', '/images/hotels/tamanaco-2.jpg'], 'Opened', 280, ARRAY['luxury', 'business', 'romantic'], '{"checkIn": "15:00", "checkOut": "12:00", "cancellation": {"free_until_hours": 48, "fee_percentage": 50}, "refund": {"allowed": true, "deadline_hours": 24}}'),

(uuid_generate_v4(), 'hotel-eurobuilding-caracas', 'Hotel Eurobuilding', 'Moderno hotel de negocios en Chuao, ideal para viajeros corporativos con excelentes instalaciones de conferencias.', '5 estrellas', true, 'Calle La Guairita, Chuao', 'Caracas', 'Distrito Capital', '1060', 'Venezuela', 10.4847, -66.8504, ARRAY['wifi', 'pool', 'gym', 'restaurant', 'bar', 'room_service', 'parking', 'business_center', 'conference_rooms'], ARRAY['city_view', 'concierge', 'airport_shuttle'], ARRAY['/images/hotels/eurobuilding-1.jpg', '/images/hotels/eurobuilding-2.jpg'], 'Opened', 400, ARRAY['business', 'luxury', 'conference'], '{"checkIn": "14:00", "checkOut": "12:00", "cancellation": {"free_until_hours": 24, "fee_percentage": 100}, "refund": {"allowed": true, "deadline_hours": 24}}'),

-- Venezuela - Margarita
(uuid_generate_v4(), 'hesperia-isla-margarita', 'Hesperia Isla Margarita', 'Resort todo incluido frente al mar en Playa El Agua, perfecto para vacaciones familiares y románticas.', '5 estrellas', true, 'Av. 31 de Julio, Playa El Agua', 'Porlamar', 'Nueva Esparta', '6301', 'Venezuela', 11.0847, -63.8847, ARRAY['wifi', 'pool', 'beach_access', 'spa', 'gym', 'restaurant', 'bar', 'kids_club', 'water_sports'], ARRAY['beachfront', 'all_inclusive', 'family_friendly'], ARRAY['/images/hotels/hesperia-margarita-1.jpg', '/images/hotels/hesperia-margarita-2.jpg'], 'Opened', 320, ARRAY['beach', 'resort', 'family', 'all_inclusive'], '{"checkIn": "16:00", "checkOut": "11:00", "cancellation": {"free_until_hours": 72, "fee_percentage": 50}, "refund": {"allowed": true, "deadline_hours": 48}}'),

-- México - Cancún
(uuid_generate_v4(), 'grand-oasis-cancun', 'Grand Oasis Cancún', 'Espectacular resort todo incluido en la zona hotelera de Cancún con acceso directo a la playa y múltiples restaurantes.', '5 estrellas', true, 'Blvd. Kukulcan Km 16.5, Zona Hotelera', 'Cancún', 'Quintana Roo', '77500', 'México', 21.0885, -86.7680, ARRAY['wifi', 'pool', 'beach_access', 'spa', 'gym', 'restaurant', 'bar', 'nightclub', 'water_sports', 'kids_club'], ARRAY['beachfront', 'all_inclusive', 'entertainment'], ARRAY['/images/hotels/grand-oasis-1.jpg', '/images/hotels/grand-oasis-2.jpg'], 'Opened', 1500, ARRAY['beach', 'resort', 'party', 'all_inclusive'], '{"checkIn": "15:00", "checkOut": "12:00", "cancellation": {"free_until_hours": 48, "fee_percentage": 50}, "refund": {"allowed": true, "deadline_hours": 24}}'),

(uuid_generate_v4(), 'secrets-the-vine-cancun', 'Secrets The Vine Cancún', 'Resort de lujo solo para adultos con servicio premium y spa de clase mundial.', '5 estrellas', true, 'Blvd. Kukulcan Km 14.5, Zona Hotelera', 'Cancún', 'Quintana Roo', '77500', 'México', 21.1024, -86.7630, ARRAY['wifi', 'pool', 'beach_access', 'spa', 'gym', 'restaurant', 'bar', 'room_service'], ARRAY['beachfront', 'adults_only', 'romantic', 'luxury'], ARRAY['/images/hotels/secrets-vine-1.jpg', '/images/hotels/secrets-vine-2.jpg'], 'Opened', 497, ARRAY['beach', 'adults_only', 'romantic', 'luxury', 'spa'], '{"checkIn": "15:00", "checkOut": "12:00", "cancellation": {"free_until_hours": 72, "fee_percentage": 100}, "refund": {"allowed": true, "deadline_hours": 48}}'),

-- República Dominicana - Punta Cana
(uuid_generate_v4(), 'barcelo-bavaro-palace', 'Barceló Bávaro Palace', 'Resort todo incluido de lujo en Bávaro con múltiples piscinas, restaurantes temáticos y acceso a playa privada.', '5 estrellas', true, 'Carretera Bávaro Km 1, Playa Bávaro', 'Punta Cana', 'La Altagracia', '23000', 'República Dominicana', 18.6850, -68.4150, ARRAY['wifi', 'pool', 'beach_access', 'spa', 'gym', 'restaurant', 'bar', 'casino', 'golf', 'kids_club', 'water_sports'], ARRAY['beachfront', 'all_inclusive', 'family_friendly', 'golf_course'], ARRAY['/images/hotels/barcelo-bavaro-1.jpg', '/images/hotels/barcelo-bavaro-2.jpg'], 'Opened', 1402, ARRAY['beach', 'resort', 'family', 'all_inclusive', 'golf'], '{"checkIn": "16:00", "checkOut": "12:00", "cancellation": {"free_until_hours": 72, "fee_percentage": 50}, "refund": {"allowed": true, "deadline_hours": 48}}'),

-- Aruba
(uuid_generate_v4(), 'riu-palace-aruba', 'Riu Palace Aruba', 'Lujoso resort todo incluido en Palm Beach con servicio excepcional y vistas al mar Caribe.', '5 estrellas', true, 'J.E. Irausquin Blvd 79, Palm Beach', 'Noord', NULL, NULL, 'Aruba', 12.5755, -70.0569, ARRAY['wifi', 'pool', 'beach_access', 'spa', 'gym', 'restaurant', 'bar', 'casino'], ARRAY['beachfront', 'all_inclusive', 'romantic'], ARRAY['/images/hotels/riu-aruba-1.jpg', '/images/hotels/riu-aruba-2.jpg'], 'Opened', 450, ARRAY['beach', 'resort', 'romantic', 'all_inclusive', 'casino'], '{"checkIn": "15:00", "checkOut": "12:00", "cancellation": {"free_until_hours": 48, "fee_percentage": 50}, "refund": {"allowed": true, "deadline_hours": 24}}'),

-- Colombia - Cartagena
(uuid_generate_v4(), 'hotel-charleston-santa-teresa', 'Hotel Charleston Santa Teresa', 'Boutique hotel de lujo en el centro histórico de Cartagena, en un convento restaurado del siglo XVII.', '5 estrellas', false, 'Plaza Santa Teresa, Centro Histórico', 'Cartagena', 'Bolívar', '130001', 'Colombia', 10.4234, -75.5507, ARRAY['wifi', 'pool', 'spa', 'gym', 'restaurant', 'bar', 'room_service'], ARRAY['historic_building', 'rooftop_pool', 'concierge'], ARRAY['/images/hotels/charleston-1.jpg', '/images/hotels/charleston-2.jpg'], 'Opened', 87, ARRAY['boutique', 'historic', 'luxury', 'romantic'], '{"checkIn": "15:00", "checkOut": "12:00", "cancellation": {"free_until_hours": 48, "fee_percentage": 100}, "refund": {"allowed": true, "deadline_hours": 24}}')
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- 4. HABITACIONES DE HOTELES
-- =============================================

-- Obtener IDs de hoteles y crear habitaciones
DO $$
DECLARE
    hotel_record RECORD;
BEGIN
    FOR hotel_record IN SELECT id, slug FROM public.hotels LOOP
        -- Habitación estándar
        INSERT INTO public.hotel_rooms (hotel_id, description, room_type, features, amenities, images, price_base, price_tax, price_currency, total_beds, bed_options, sleeps_count, max_adults, max_children, floor)
        VALUES (
            hotel_record.id,
            'Habitación estándar con todas las comodidades básicas para una estancia confortable.',
            'Standard',
            ARRAY['air_conditioning', 'tv', 'minibar', 'safe'],
            ARRAY['wifi', 'tv', 'minibar', 'safe', 'coffee_maker'],
            ARRAY['/images/rooms/standard-1.jpg'],
            89.00, 15.00, 'USD', 1, '1 King o 2 Twin', 2, 2, 1, 2
        );

        -- Habitación superior
        INSERT INTO public.hotel_rooms (hotel_id, description, room_type, features, amenities, images, price_base, price_tax, price_currency, total_beds, bed_options, sleeps_count, max_adults, max_children, floor)
        VALUES (
            hotel_record.id,
            'Habitación superior con vistas y amenidades mejoradas.',
            'Superior',
            ARRAY['air_conditioning', 'tv', 'minibar', 'safe', 'balcony'],
            ARRAY['wifi', 'tv', 'minibar', 'safe', 'coffee_maker', 'bathrobe'],
            ARRAY['/images/rooms/superior-1.jpg'],
            129.00, 20.00, 'USD', 1, '1 King', 2, 2, 1, 5
        );

        -- Suite
        INSERT INTO public.hotel_rooms (hotel_id, description, room_type, features, amenities, images, price_base, price_tax, price_currency, total_beds, bed_options, sleeps_count, max_adults, max_children, floor)
        VALUES (
            hotel_record.id,
            'Suite espaciosa con sala de estar separada y vistas panorámicas.',
            'Suite',
            ARRAY['air_conditioning', 'tv', 'minibar', 'safe', 'balcony', 'living_room', 'jacuzzi'],
            ARRAY['wifi', 'tv', 'minibar', 'safe', 'coffee_maker', 'bathrobe', 'slippers', 'premium_toiletries'],
            ARRAY['/images/rooms/suite-1.jpg'],
            249.00, 40.00, 'USD', 2, '1 King + Sofá cama', 4, 2, 2, 10
        );
    END LOOP;
END $$;

-- =============================================
-- 5. CÓDIGOS PROMOCIONALES
-- =============================================

INSERT INTO public.promo_codes (code, description, discount_type, value, currency, max_discount, applicable_to, is_active, valid_from, valid_until, usage_limit) VALUES
('BIENVENIDO10', 'Descuento de bienvenida del 10%', 'percentage', 10.00, 'USD', 50.00, 'both', true, NOW(), NOW() + INTERVAL '1 year', 1000),
('VERANO2024', 'Promoción de verano 15% de descuento', 'percentage', 15.00, 'USD', 100.00, 'both', true, NOW(), NOW() + INTERVAL '6 months', 500),
('VUELO50', 'Descuento fijo de $50 en vuelos', 'fixed', 50.00, 'USD', NULL, 'flight', true, NOW(), NOW() + INTERVAL '3 months', 200),
('HOTEL25', 'Descuento fijo de $25 en hoteles', 'fixed', 25.00, 'USD', NULL, 'hotel', true, NOW(), NOW() + INTERVAL '3 months', 200),
('VIP20', 'Descuento exclusivo VIP 20%', 'percentage', 20.00, 'USD', 200.00, 'both', true, NOW(), NOW() + INTERVAL '1 year', 100)
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- 6. CONFIGURACIÓN DEL SITIO
-- =============================================

INSERT INTO public.website_config (id, site_name, site_description, contact_email, contact_phone, social_links, features)
VALUES (
    'config',
    'Check-in Venezuela',
    'Tu agencia de viajes de confianza para explorar Venezuela y el mundo',
    'info@checkinvenezuela.com',
    '+58 424 603 4052',
    '{"facebook": "https://facebook.com/checkinvenezuela", "instagram": "https://instagram.com/checkinvenezuela", "twitter": "https://twitter.com/checkinvzla", "whatsapp": "584264034052"}',
    '{"flights": true, "hotels": true, "packages": false, "transfers": false, "insurance": false}'
)
ON CONFLICT (id) DO UPDATE SET
    site_name = EXCLUDED.site_name,
    site_description = EXCLUDED.site_description,
    contact_email = EXCLUDED.contact_email,
    contact_phone = EXCLUDED.contact_phone,
    social_links = EXCLUDED.social_links,
    features = EXCLUDED.features;

-- =============================================
-- 7. INICIALIZAR ANALYTICS
-- =============================================

INSERT INTO public.analytics (id, total_users_signed_up, total_accounts_deleted)
VALUES ('analytics', 0, 0)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 8. REVIEWS DE PRUEBA (Website)
-- =============================================

INSERT INTO public.website_reviews (id, rating, title, comment, is_approved, created_at) VALUES
(uuid_generate_v4(), 5, 'Excelente servicio', 'Reservé mis vacaciones a Cancún y todo fue perfecto. El equipo de Check-in Venezuela me ayudó en todo momento.', true, NOW() - INTERVAL '30 days'),
(uuid_generate_v4(), 5, 'Muy recomendado', 'Precios competitivos y atención personalizada. Volveré a reservar con ellos.', true, NOW() - INTERVAL '25 days'),
(uuid_generate_v4(), 4, 'Buena experiencia', 'El proceso de reserva fue sencillo. Solo mejoraría los tiempos de respuesta del WhatsApp.', true, NOW() - INTERVAL '20 days'),
(uuid_generate_v4(), 5, 'Los mejores precios', 'Comparé con otras agencias y Check-in Venezuela tenía los mejores precios para mi viaje a Margarita.', true, NOW() - INTERVAL '15 days'),
(uuid_generate_v4(), 5, 'Servicio de primera', 'El asesor fue muy amable y me ayudó a encontrar el hotel perfecto para mi luna de miel.', true, NOW() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

-- =============================================
-- FIN DEL SEED DATA
-- =============================================

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Seed data insertado correctamente';
    RAISE NOTICE 'Aeropuertos: %', (SELECT COUNT(*) FROM public.airports);
    RAISE NOTICE 'Aerolíneas: %', (SELECT COUNT(*) FROM public.airlines);
    RAISE NOTICE 'Hoteles: %', (SELECT COUNT(*) FROM public.hotels);
    RAISE NOTICE 'Habitaciones: %', (SELECT COUNT(*) FROM public.hotel_rooms);
    RAISE NOTICE 'Códigos promocionales: %', (SELECT COUNT(*) FROM public.promo_codes);
END $$;
