-- =============================================
-- MIGRACIÓN: CMS, PROVEEDORES E INVENTARIO
-- Venezuela Voyages - Sistema de Gestión de Contenido
-- =============================================

-- =============================================
-- 1. CATÁLOGO DE SERVICIOS (Página Principal)
-- =============================================

DO $$ BEGIN
    CREATE TYPE service_status AS ENUM ('active', 'coming_soon', 'disabled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.catalog_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT,
    image_url TEXT,
    status service_status DEFAULT 'active',
    has_online_purchase BOOLEAN DEFAULT false,
    has_quote_request BOOLEAN DEFAULT true,
    href TEXT,
    display_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar servicios existentes (solo si la tabla está vacía)
INSERT INTO public.catalog_services (name, slug, description, icon, status, has_online_purchase, has_quote_request, href, display_order)
SELECT * FROM (VALUES
    ('Vuelos', 'flights', 'Encuentra los mejores vuelos nacionales e internacionales', 'Plane', 'active'::service_status, true, true, '/flights', 1),
    ('Hoteles', 'hotels', 'Reserva alojamiento en los mejores destinos', 'Building2', 'active'::service_status, true, true, '/hotels', 2),
    ('Paquetes', 'packages', 'Vuelo + hotel con los mejores precios combinados', 'Package', 'active'::service_status, false, true, NULL, 3),
    ('Tours y Actividades', 'tours', 'Experiencias únicas en cada destino', 'Compass', 'coming_soon'::service_status, false, true, NULL, 4),
    ('Traslados', 'transfers', 'Transporte seguro aeropuerto-hotel y más', 'Car', 'coming_soon'::service_status, false, true, NULL, 5),
    ('Seguro de Viaje', 'insurance', 'Viaja protegido con cobertura completa', 'Shield', 'coming_soon'::service_status, false, true, NULL, 6),
    ('Alquiler de Autos', 'car-rental', 'Libertad para explorar a tu ritmo', 'CarFront', 'coming_soon'::service_status, false, true, NULL, 7),
    ('Cruceros', 'cruises', 'Aventuras en altamar con todo incluido', 'Ship', 'coming_soon'::service_status, false, true, NULL, 8),
    ('Plan Corporativo', 'corporate', 'Soluciones de viaje para empresas', 'Briefcase', 'coming_soon'::service_status, false, true, NULL, 9),
    ('Todo Incluido', 'all-inclusive', 'Paquetes premium sin preocupaciones', 'Star', 'coming_soon'::service_status, false, true, NULL, 10)
) AS v(name, slug, description, icon, status, has_online_purchase, has_quote_request, href, display_order)
WHERE NOT EXISTS (SELECT 1 FROM public.catalog_services LIMIT 1);

-- =============================================
-- 2. CATEGORÍAS DE DESTINOS
-- =============================================

CREATE TABLE IF NOT EXISTS public.destination_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    subtitle TEXT,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar categorías existentes
INSERT INTO public.destination_categories (name, slug, subtitle, icon, display_order)
SELECT * FROM (VALUES
    ('Destinos de Playa', 'beach', 'Premium y Relax', 'Umbrella', 1),
    ('Aventura y Naturaleza Salvaje', 'adventure', 'Experiencias únicas', 'Mountain', 2),
    ('Cultura y Montaña', 'culture', 'Tradición y paisajes', 'Church', 3),
    ('Fenómenos Únicos', 'phenomena', 'Maravillas naturales', 'Zap', 4),
    ('Destinos Internacionales', 'international', 'Vuelos populares', 'Plane', 5),
    ('Hoteles Populares', 'popular-hotels', 'Mejores hospedajes', 'Building2', 6)
) AS v(name, slug, subtitle, icon, display_order)
WHERE NOT EXISTS (SELECT 1 FROM public.destination_categories LIMIT 1);

-- =============================================
-- 3. DESTINOS
-- =============================================

DO $$ BEGIN
    CREATE TYPE destination_type AS ENUM ('venezuela', 'flight', 'hotel');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.destinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES public.destination_categories(id) ON DELETE SET NULL,
    destination_type destination_type NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    short_description TEXT,
    country TEXT,
    city TEXT,
    airport_code TEXT,
    hotel_type TEXT,
    image_url TEXT,
    gallery JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    highlights JSONB DEFAULT '[]',
    coordinates JSONB,
    pricing JSONB,
    has_online_search BOOLEAN DEFAULT false,
    has_quote_request BOOLEAN DEFAULT true,
    search_href TEXT,
    display_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar destinos de Venezuela - Playas
INSERT INTO public.destinations (category_id, destination_type, name, slug, description, short_description, country, image_url, tags, highlights, has_quote_request, display_order)
SELECT
    c.id, 'venezuela'::destination_type, 'Archipiélago Los Roques', 'los-roques',
    'Es el destino de lujo por excelencia. Sus aguas cristalinas y arenas blancas son comparadas con las Maldivas. Es ideal para extranjeros que buscan exclusividad, buceo y kitesurf.',
    'Paraíso caribeño de aguas cristalinas',
    'Venezuela',
    '/images/destinations/los-roques.jpg',
    '["Lujo", "Buceo", "Kitesurf"]'::jsonb,
    '["Aguas cristalinas", "Arenas blancas", "Exclusividad"]'::jsonb,
    true, 1
FROM public.destination_categories c WHERE c.slug = 'beach'
AND NOT EXISTS (SELECT 1 FROM public.destinations WHERE slug = 'los-roques');

INSERT INTO public.destinations (category_id, destination_type, name, slug, description, short_description, country, image_url, tags, highlights, has_quote_request, display_order)
SELECT
    c.id, 'venezuela'::destination_type, 'Isla de Margarita', 'isla-margarita',
    'Perfecta por su infraestructura. Ofrece desde hoteles todo incluido y compras (puerto libre) hasta playas icónicas como Playa El Yaque (famosa mundialmente para windsurf) y Playa El Agua.',
    'Todo incluido y puerto libre',
    'Venezuela',
    '/images/destinations/margarita.jpg',
    '["Todo Incluido", "Compras", "Windsurf"]'::jsonb,
    '["Puerto libre", "Playa El Yaque", "Playa El Agua"]'::jsonb,
    true, 2
FROM public.destination_categories c WHERE c.slug = 'beach'
AND NOT EXISTS (SELECT 1 FROM public.destinations WHERE slug = 'isla-margarita');

INSERT INTO public.destinations (category_id, destination_type, name, slug, description, short_description, country, image_url, tags, highlights, has_quote_request, display_order)
SELECT
    c.id, 'venezuela'::destination_type, 'Parque Nacional Morrocoy', 'morrocoy',
    'Sus cayos (como Cayo Sombrero) ofrecen una experiencia de piscina natural en el mar que encanta a quienes buscan paisajes caribeños clásicos.',
    'Cayos y piscinas naturales',
    'Venezuela',
    '/images/destinations/morrocoy.jpg',
    '["Cayos", "Naturaleza", "Caribe"]'::jsonb,
    '["Cayo Sombrero", "Piscinas naturales", "Paisajes caribeños"]'::jsonb,
    true, 3
FROM public.destination_categories c WHERE c.slug = 'beach'
AND NOT EXISTS (SELECT 1 FROM public.destinations WHERE slug = 'morrocoy');

-- Insertar destinos de Venezuela - Aventura
INSERT INTO public.destinations (category_id, destination_type, name, slug, description, short_description, country, image_url, tags, highlights, has_quote_request, display_order)
SELECT
    c.id, 'venezuela'::destination_type, 'Parque Nacional Canaima', 'canaima',
    'Es la joya de la corona. Ningún extranjero quiere irse sin ver la caída de agua más alta del mundo (979 metros). Es un viaje de aventura que incluye navegación en curiara y pernocta en hamacas frente al salto.',
    'Salto Ángel - la caída más alta del mundo',
    'Venezuela',
    '/images/destinations/canaima.jpg',
    '["Salto Ángel", "Aventura", "UNESCO"]'::jsonb,
    '["Salto Ángel (979m)", "Navegación en curiara", "Pernocta en hamacas"]'::jsonb,
    true, 1
FROM public.destination_categories c WHERE c.slug = 'adventure'
AND NOT EXISTS (SELECT 1 FROM public.destinations WHERE slug = 'canaima');

INSERT INTO public.destinations (category_id, destination_type, name, slug, description, short_description, country, image_url, tags, highlights, has_quote_request, display_order)
SELECT
    c.id, 'venezuela'::destination_type, 'Monte Roraima', 'roraima',
    'Un destino de trekking de clase mundial. Los extranjeros amantes del senderismo buscan esta formación milenaria (tepuy) que inspiró historias como El Mundo Perdido.',
    'Trekking de clase mundial',
    'Venezuela',
    '/images/destinations/roraima.jpg',
    '["Trekking", "Tepuy", "Expedición"]'::jsonb,
    '["Trekking clase mundial", "Tepuy milenario", "El Mundo Perdido"]'::jsonb,
    true, 2
FROM public.destination_categories c WHERE c.slug = 'adventure'
AND NOT EXISTS (SELECT 1 FROM public.destinations WHERE slug = 'roraima');

INSERT INTO public.destinations (category_id, destination_type, name, slug, description, short_description, country, image_url, tags, highlights, has_quote_request, display_order)
SELECT
    c.id, 'venezuela'::destination_type, 'Los Llanos', 'los-llanos',
    'Ideal para el Safari Venezolano. Es el mejor lugar para el avistamiento de fauna (anacondas, caimanes, chigüires y cientos de aves).',
    'Safari venezolano',
    'Venezuela',
    '/images/destinations/llanos.jpg',
    '["Safari", "Fauna", "Naturaleza"]'::jsonb,
    '["Safari venezolano", "Anacondas", "Caimanes"]'::jsonb,
    true, 3
FROM public.destination_categories c WHERE c.slug = 'adventure'
AND NOT EXISTS (SELECT 1 FROM public.destinations WHERE slug = 'los-llanos');

-- Insertar destinos de Venezuela - Cultura
INSERT INTO public.destinations (category_id, destination_type, name, slug, description, short_description, country, image_url, tags, highlights, has_quote_request, display_order)
SELECT
    c.id, 'venezuela'::destination_type, 'Mérida y la Sierra Nevada', 'merida',
    'Ofrece el teleférico más alto y largo del mundo (Mukumbarí). Es el destino preferido para quienes buscan pueblos coloniales, clima frío y paisajes andinos.',
    'Teleférico más alto del mundo',
    'Venezuela',
    '/images/destinations/merida.jpg',
    '["Teleférico", "Andes", "Colonial"]'::jsonb,
    '["Mukumbarí", "Pueblos coloniales", "Paisajes andinos"]'::jsonb,
    true, 1
FROM public.destination_categories c WHERE c.slug = 'culture'
AND NOT EXISTS (SELECT 1 FROM public.destinations WHERE slug = 'merida');

INSERT INTO public.destinations (category_id, destination_type, name, slug, description, short_description, country, image_url, tags, highlights, has_quote_request, display_order)
SELECT
    c.id, 'venezuela'::destination_type, 'Colonia Tovar', 'colonia-tovar',
    'Un pedazo de Alemania en el trópico. Su arquitectura y gastronomía europea a solo una hora de Caracas siempre sorprende a los visitantes.',
    'Alemania en el trópico',
    'Venezuela',
    '/images/destinations/colonia-tovar.jpg',
    '["Alemán", "Gastronomía", "Arquitectura"]'::jsonb,
    '["Arquitectura alemana", "Gastronomía europea", "Cerca de Caracas"]'::jsonb,
    true, 2
FROM public.destination_categories c WHERE c.slug = 'culture'
AND NOT EXISTS (SELECT 1 FROM public.destinations WHERE slug = 'colonia-tovar');

-- Insertar destinos de Venezuela - Fenómenos
INSERT INTO public.destinations (category_id, destination_type, name, slug, description, short_description, country, image_url, tags, highlights, has_quote_request, display_order)
SELECT
    c.id, 'venezuela'::destination_type, 'Relámpago del Catatumbo', 'catatumbo',
    'El lugar con más relámpagos por kilómetro cuadrado al año en el mundo. Un espectáculo natural único para fotógrafos y científicos.',
    'Récord mundial de relámpagos',
    'Venezuela',
    '/images/destinations/catatumbo.jpg',
    '["Relámpagos", "Único", "Fotografía"]'::jsonb,
    '["Récord mundial de relámpagos", "Fenómeno único", "Fotografía"]'::jsonb,
    true, 1
FROM public.destination_categories c WHERE c.slug = 'phenomena'
AND NOT EXISTS (SELECT 1 FROM public.destinations WHERE slug = 'catatumbo');

-- Insertar destinos de vuelos internacionales
INSERT INTO public.destinations (category_id, destination_type, name, slug, short_description, country, city, airport_code, has_online_search, has_quote_request, search_href, display_order)
SELECT c.id, 'flight'::destination_type, v.name, v.slug, v.short_description, v.country, v.city, v.airport_code, true, true, v.search_href, v.display_order
FROM public.destination_categories c,
(VALUES
    ('Cancún', 'cancun-flight', 'Playas paradisíacas del Caribe mexicano', 'México', 'Cancún', 'CUN', '/flights?to=CUN', 1),
    ('Punta Cana', 'punta-cana-flight', 'Resort todo incluido en el Caribe', 'República Dominicana', 'Punta Cana', 'PUJ', '/flights?to=PUJ', 2),
    ('Miami', 'miami-flight', 'La puerta al sol de Florida', 'Estados Unidos', 'Miami', 'MIA', '/flights?to=MIA', 3),
    ('Madrid', 'madrid-flight', 'Capital cultural de España', 'España', 'Madrid', 'MAD', '/flights?to=MAD', 4),
    ('Ciudad de Panamá', 'panama-flight', 'Hub de las Américas y el famoso Canal', 'Panamá', 'Ciudad de Panamá', 'PTY', '/flights?to=PTY', 5),
    ('Bogotá', 'bogota-flight', 'Vibrante capital colombiana', 'Colombia', 'Bogotá', 'BOG', '/flights?to=BOG', 6),
    ('Buenos Aires', 'buenos-aires-flight', 'La París de Sudamérica', 'Argentina', 'Buenos Aires', 'EZE', '/flights?to=EZE', 7),
    ('Lima', 'lima-flight', 'Capital gastronómica de América', 'Perú', 'Lima', 'LIM', '/flights?to=LIM', 8),
    ('Nueva York', 'nueva-york-flight', 'La ciudad que nunca duerme', 'Estados Unidos', 'Nueva York', 'JFK', '/flights?to=JFK', 9),
    ('Cartagena', 'cartagena-flight', 'Ciudad amurallada del Caribe', 'Colombia', 'Cartagena', 'CTG', '/flights?to=CTG', 10)
) AS v(name, slug, short_description, country, city, airport_code, search_href, display_order)
WHERE c.slug = 'international'
AND NOT EXISTS (SELECT 1 FROM public.destinations WHERE slug = v.slug);

-- Insertar destinos de hoteles populares
INSERT INTO public.destinations (category_id, destination_type, name, slug, short_description, country, city, hotel_type, has_online_search, has_quote_request, search_href, display_order)
SELECT c.id, 'hotel'::destination_type, v.name, v.slug, v.short_description, v.country, v.city, v.hotel_type, true, true, v.search_href, v.display_order
FROM public.destination_categories c,
(VALUES
    ('Los Roques', 'los-roques-hotel', 'Posadas de lujo en el paraíso caribeño', 'Venezuela', 'Los Roques', 'Resort', '/hotels?location=Los Roques', 1),
    ('Isla de Margarita', 'margarita-hotel', 'Hoteles todo incluido frente al mar', 'Venezuela', 'Margarita', 'Todo Incluido', '/hotels?location=Margarita', 2),
    ('Canaima', 'canaima-hotel', 'Lodges de aventura junto al Salto Ángel', 'Venezuela', 'Canaima', 'Lodge', '/hotels?location=Canaima', 3),
    ('Mérida', 'merida-hotel', 'Hoteles con vistas a los Andes', 'Venezuela', 'Mérida', 'Boutique', '/hotels?location=Merida', 4),
    ('Cartagena', 'cartagena-hotel', 'Hoteles boutique en la ciudad amurallada', 'Colombia', 'Cartagena', 'Boutique', '/hotels?location=Cartagena', 5),
    ('Santa Marta', 'santa-marta-hotel', 'Resorts frente a playas del Caribe', 'Colombia', 'Santa Marta', 'Resort', '/hotels?location=Santa Marta', 6),
    ('Cancún', 'cancun-hotel', 'Resorts de lujo en la Riviera Maya', 'México', 'Cancún', 'Lujo', '/hotels?location=Cancun', 7),
    ('Punta Cana', 'punta-cana-hotel', 'Todo incluido con playas de ensueño', 'República Dominicana', 'Punta Cana', 'Todo Incluido', '/hotels?location=Punta Cana', 8),
    ('Miami Beach', 'miami-hotel', 'Hoteles icónicos en South Beach', 'Estados Unidos', 'Miami Beach', 'Urbano', '/hotels?location=Miami', 9),
    ('Ciudad de Panamá', 'panama-hotel', 'Hoteles modernos con vista al skyline', 'Panamá', 'Ciudad de Panamá', 'Business', '/hotels?location=Panama City', 10)
) AS v(name, slug, short_description, country, city, hotel_type, search_href, display_order)
WHERE c.slug = 'popular-hotels'
AND NOT EXISTS (SELECT 1 FROM public.destinations WHERE slug = v.slug);

-- =============================================
-- 4. PROVEEDORES DE TURISMO
-- =============================================

DO $$ BEGIN
    CREATE TYPE provider_type AS ENUM (
        'airline', 'hotel_chain', 'tour_operator',
        'transfer_company', 'insurance_provider',
        'car_rental', 'cruise_line', 'dmc', 'consolidator', 'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE provider_status AS ENUM ('active', 'inactive', 'pending_approval');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.tourism_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    type provider_type NOT NULL,
    logo_url TEXT,
    description TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    website TEXT,
    country TEXT,
    city TEXT,
    address TEXT,
    tax_id TEXT,
    commission_rate DECIMAL(5,2),
    payment_terms TEXT,
    currency TEXT DEFAULT 'USD',
    api_enabled BOOLEAN DEFAULT false,
    api_credentials JSONB,
    status provider_status DEFAULT 'pending_approval',
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.profiles(id),
    services_offered JSONB DEFAULT '[]',
    destinations_covered JSONB DEFAULT '[]',
    rating DECIMAL(3,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contratos con proveedores
CREATE TABLE IF NOT EXISTS public.provider_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES public.tourism_providers(id) ON DELETE CASCADE,
    contract_number TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    commission_rate DECIMAL(5,2),
    terms JSONB,
    document_url TEXT,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. INVENTARIO DE PRODUCTOS
-- =============================================

DO $$ BEGIN
    CREATE TYPE inventory_status AS ENUM ('available', 'limited', 'sold_out', 'discontinued');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE product_type AS ENUM ('flight', 'hotel', 'package', 'tour', 'transfer', 'insurance', 'car_rental', 'cruise', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.service_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES public.tourism_providers(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.catalog_services(id) ON DELETE SET NULL,
    destination_id UUID REFERENCES public.destinations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    description TEXT,
    product_type product_type NOT NULL,
    cost_price DECIMAL(10,2),
    sale_price DECIMAL(10,2),
    currency TEXT DEFAULT 'USD',
    pricing_details JSONB,
    status inventory_status DEFAULT 'available',
    quantity_available INTEGER,
    valid_from DATE,
    valid_until DATE,
    blackout_dates JSONB DEFAULT '[]',
    details JSONB DEFAULT '{}',
    images JSONB DEFAULT '[]',
    is_featured BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de precios
CREATE TABLE IF NOT EXISTS public.inventory_price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID NOT NULL REFERENCES public.service_inventory(id) ON DELETE CASCADE,
    cost_price DECIMAL(10,2),
    sale_price DECIMAL(10,2),
    changed_by UUID REFERENCES public.profiles(id),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para registrar cambios de precio
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.cost_price IS DISTINCT FROM NEW.cost_price OR OLD.sale_price IS DISTINCT FROM NEW.sale_price THEN
        INSERT INTO public.inventory_price_history (inventory_id, cost_price, sale_price, changed_by)
        VALUES (NEW.id, NEW.cost_price, NEW.sale_price, NEW.updated_by);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_price_change ON public.service_inventory;
CREATE TRIGGER trigger_log_price_change
    AFTER UPDATE ON public.service_inventory
    FOR EACH ROW EXECUTE FUNCTION log_price_change();

-- =============================================
-- 6. ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_catalog_services_status ON public.catalog_services(status);
CREATE INDEX IF NOT EXISTS idx_catalog_services_order ON public.catalog_services(display_order);

CREATE INDEX IF NOT EXISTS idx_destination_categories_active ON public.destination_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_destinations_category ON public.destinations(category_id);
CREATE INDEX IF NOT EXISTS idx_destinations_type ON public.destinations(destination_type);
CREATE INDEX IF NOT EXISTS idx_destinations_active ON public.destinations(is_active);
CREATE INDEX IF NOT EXISTS idx_destinations_featured ON public.destinations(is_featured);

CREATE INDEX IF NOT EXISTS idx_providers_type ON public.tourism_providers(type);
CREATE INDEX IF NOT EXISTS idx_providers_status ON public.tourism_providers(status);
CREATE INDEX IF NOT EXISTS idx_provider_contracts_provider ON public.provider_contracts(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_contracts_status ON public.provider_contracts(status);

CREATE INDEX IF NOT EXISTS idx_inventory_provider ON public.service_inventory(provider_id);
CREATE INDEX IF NOT EXISTS idx_inventory_service ON public.service_inventory(service_id);
CREATE INDEX IF NOT EXISTS idx_inventory_destination ON public.service_inventory(destination_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON public.service_inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON public.service_inventory(product_type);
CREATE INDEX IF NOT EXISTS idx_inventory_featured ON public.service_inventory(is_featured);

-- =============================================
-- 7. RLS POLICIES
-- =============================================

ALTER TABLE public.catalog_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_price_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read active services" ON public.catalog_services;
DROP POLICY IF EXISTS "Public read active categories" ON public.destination_categories;
DROP POLICY IF EXISTS "Public read active destinations" ON public.destinations;
DROP POLICY IF EXISTS "Public read active providers" ON public.tourism_providers;
DROP POLICY IF EXISTS "Public read available inventory" ON public.service_inventory;

-- Lectura pública para contenido activo
CREATE POLICY "Public read active services" ON public.catalog_services
    FOR SELECT USING (status != 'disabled');

CREATE POLICY "Public read active categories" ON public.destination_categories
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active destinations" ON public.destinations
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active providers" ON public.tourism_providers
    FOR SELECT USING (status = 'active');

CREATE POLICY "Public read available inventory" ON public.service_inventory
    FOR SELECT USING (is_published = true AND status != 'discontinued');

-- =============================================
-- 8. TRIGGERS DE UPDATED_AT
-- =============================================

DROP TRIGGER IF EXISTS update_catalog_services_updated_at ON public.catalog_services;
CREATE TRIGGER update_catalog_services_updated_at
    BEFORE UPDATE ON public.catalog_services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_destination_categories_updated_at ON public.destination_categories;
CREATE TRIGGER update_destination_categories_updated_at
    BEFORE UPDATE ON public.destination_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_destinations_updated_at ON public.destinations;
CREATE TRIGGER update_destinations_updated_at
    BEFORE UPDATE ON public.destinations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tourism_providers_updated_at ON public.tourism_providers;
CREATE TRIGGER update_tourism_providers_updated_at
    BEFORE UPDATE ON public.tourism_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_provider_contracts_updated_at ON public.provider_contracts;
CREATE TRIGGER update_provider_contracts_updated_at
    BEFORE UPDATE ON public.provider_contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_inventory_updated_at ON public.service_inventory;
CREATE TRIGGER update_service_inventory_updated_at
    BEFORE UPDATE ON public.service_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FIN DE LA MIGRACIÓN
-- =============================================
