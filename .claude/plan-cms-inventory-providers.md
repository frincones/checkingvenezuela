# Plan: Módulo CMS, Inventario y Proveedores de Turismo
## Integrado en el Dashboard CRM Existente

---

## Resumen Ejecutivo

Este plan detalla la implementación de nuevos módulos **dentro del dashboard CRM existente** (`/dashboard`) que permitirán al administrador gestionar de forma autónoma:

1. **CMS** - Contenido de la página principal (servicios, destinos, secciones)
2. **Proveedores** - Proveedores de turismo (aerolíneas, hoteles, operadores)
3. **Inventario** - Productos turísticos con precios y disponibilidad

**Principio clave**: Seguir exactamente los mismos patrones de UI, código y arquitectura del CRM actual.

---

## Análisis del Dashboard Actual

### Estructura Existente

```
/app/(pages)/dashboard/
├── layout.js           # Layout con Sidebar (w-64 fixed)
├── page.js             # Dashboard principal con estadísticas
├── leads/              # Módulo de leads
│   ├── page.js         # Lista de leads
│   ├── new/page.js     # Crear lead
│   └── [id]/page.js    # Detalle/editar lead
├── quotations/         # Módulo de cotizaciones
│   ├── page.js
│   ├── new/page.js
│   └── [id]/page.js
└── support/            # Módulo de soporte
    ├── page.js
    └── [id]/page.js
```

### Sidebar Actual (layout.js:5-42)

```javascript
const sidebarLinks = [
  { title: "Dashboard", href: "/dashboard", icon: ... },
  { title: "Leads", href: "/dashboard/leads", icon: ... },
  { title: "Cotizaciones", href: "/dashboard/quotations", icon: ... },
  { title: "Soporte", href: "/dashboard/support", icon: ... },
];
```

### Patrones de UI Identificados

| Elemento | Clase CSS |
|----------|-----------|
| Card/Box | `rounded-lg bg-white p-6 shadow-md` |
| Botón primario | `rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90` |
| Botón secundario | `rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50` |
| Input | `mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary` |
| Status badge | `rounded-full px-2 py-1 text-xs font-medium bg-{color}-100 text-{color}-800` |
| Tabla header | `bg-gray-50` |
| Tabla row hover | `hover:bg-gray-50` |

---

## Nueva Estructura del Dashboard

### Sidebar Ampliado (Propuesto)

```javascript
const sidebarLinks = [
  // --- SECCIÓN CRM (Existente) ---
  { title: "Dashboard", href: "/dashboard", icon: HomeIcon },
  { title: "Leads", href: "/dashboard/leads", icon: UsersIcon },
  { title: "Cotizaciones", href: "/dashboard/quotations", icon: FileTextIcon },
  { title: "Soporte", href: "/dashboard/support", icon: HeadphonesIcon },

  // --- SEPARADOR ---
  { type: "separator", title: "Gestión de Contenido" },

  // --- SECCIÓN CMS (Nueva) ---
  { title: "Servicios", href: "/dashboard/cms/services", icon: GridIcon },
  { title: "Destinos", href: "/dashboard/cms/destinations", icon: MapPinIcon },
  { title: "Categorías", href: "/dashboard/cms/categories", icon: TagIcon },

  // --- SEPARADOR ---
  { type: "separator", title: "Operaciones" },

  // --- SECCIÓN PROVEEDORES (Nueva) ---
  { title: "Proveedores", href: "/dashboard/providers", icon: BuildingIcon },

  // --- SECCIÓN INVENTARIO (Nueva) ---
  { title: "Inventario", href: "/dashboard/inventory", icon: PackageIcon },
];
```

### Estructura de Carpetas Completa

```
/app/(pages)/dashboard/
├── layout.js                    # Layout actualizado con nuevo sidebar
├── page.js                      # Dashboard con stats de todos los módulos
│
├── leads/                       # (Existente - sin cambios)
├── quotations/                  # (Existente - sin cambios)
├── support/                     # (Existente - sin cambios)
│
├── cms/                         # *** NUEVO - Gestión de Contenido ***
│   ├── services/
│   │   ├── page.js              # Lista de servicios
│   │   ├── new/page.js          # Crear servicio
│   │   └── [id]/page.js         # Editar servicio
│   │
│   ├── destinations/
│   │   ├── page.js              # Lista de destinos
│   │   ├── new/page.js          # Crear destino
│   │   └── [id]/page.js         # Editar destino
│   │
│   └── categories/
│       ├── page.js              # Lista de categorías
│       ├── new/page.js          # Crear categoría
│       └── [id]/page.js         # Editar categoría
│
├── providers/                   # *** NUEVO - Proveedores ***
│   ├── page.js                  # Lista de proveedores
│   ├── new/page.js              # Crear proveedor
│   └── [id]/
│       ├── page.js              # Detalle de proveedor
│       └── contracts/page.js    # Contratos del proveedor
│
└── inventory/                   # *** NUEVO - Inventario ***
    ├── page.js                  # Lista de productos
    ├── new/page.js              # Crear producto
    └── [id]/page.js             # Editar producto
```

---

## Rutas API (Siguiendo Patrón CRM)

```
/app/api/crm/                    # Existente
├── leads/
├── quotations/
├── support/
└── advisors/

/app/api/cms/                    # *** NUEVO ***
├── services/
│   ├── route.js                 # GET (listar), POST (crear)
│   ├── [id]/route.js            # GET, PATCH, DELETE
│   └── reorder/route.js         # POST (cambiar orden)
│
├── destinations/
│   ├── route.js                 # GET, POST
│   ├── [id]/route.js            # GET, PATCH, DELETE
│   └── bulk/route.js            # POST (importar múltiples)
│
└── categories/
    ├── route.js                 # GET, POST
    └── [id]/route.js            # GET, PATCH, DELETE

/app/api/providers/              # *** NUEVO ***
├── route.js                     # GET, POST
├── [id]/
│   ├── route.js                 # GET, PATCH, DELETE
│   ├── approve/route.js         # POST (aprobar proveedor)
│   └── contracts/route.js       # GET, POST contratos
└── export/route.js              # GET (exportar Excel)

/app/api/inventory/              # *** NUEVO ***
├── route.js                     # GET, POST
├── [id]/
│   ├── route.js                 # GET, PATCH, DELETE
│   └── price-history/route.js   # GET historial de precios
├── bulk-update/route.js         # POST (actualizar múltiples)
└── export/route.js              # GET (exportar Excel)
```

---

## Nuevas Tablas en Supabase

### Migración SQL: `supabase/migrations/003_cms_providers_inventory.sql`

```sql
-- =============================================
-- MIGRACIÓN: CMS, PROVEEDORES E INVENTARIO
-- =============================================

-- =============================================
-- 1. CATÁLOGO DE SERVICIOS (Página Principal)
-- =============================================

CREATE TYPE service_status AS ENUM ('active', 'coming_soon', 'disabled');

CREATE TABLE public.catalog_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT,                           -- Nombre del icono de Lucide (ej: "Plane", "Hotel")
    image_url TEXT,
    status service_status DEFAULT 'active',
    has_online_purchase BOOLEAN DEFAULT false,
    has_quote_request BOOLEAN DEFAULT true,
    href TEXT,                           -- Ruta interna si tiene compra online
    display_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar servicios existentes (migración de datos)
INSERT INTO public.catalog_services (name, slug, description, icon, status, has_online_purchase, has_quote_request, href, display_order) VALUES
('Vuelos', 'flights', 'Encuentra los mejores vuelos nacionales e internacionales', 'Plane', 'active', true, true, '/flights', 1),
('Hoteles', 'hotels', 'Reserva alojamiento en los mejores destinos', 'Building2', 'active', true, true, '/hotels', 2),
('Paquetes', 'packages', 'Vuelo + hotel con los mejores precios combinados', 'Package', 'active', false, true, NULL, 3),
('Tours y Actividades', 'tours', 'Experiencias únicas en cada destino', 'Compass', 'coming_soon', false, true, NULL, 4),
('Traslados', 'transfers', 'Transporte seguro aeropuerto-hotel y más', 'Car', 'coming_soon', false, true, NULL, 5),
('Seguro de Viaje', 'insurance', 'Viaja protegido con cobertura completa', 'Shield', 'coming_soon', false, true, NULL, 6),
('Alquiler de Autos', 'car-rental', 'Libertad para explorar a tu ritmo', 'CarFront', 'coming_soon', false, true, NULL, 7),
('Cruceros', 'cruises', 'Aventuras en altamar con todo incluido', 'Ship', 'coming_soon', false, true, NULL, 8),
('Plan Corporativo', 'corporate', 'Soluciones de viaje para empresas', 'Briefcase', 'coming_soon', false, true, NULL, 9),
('Todo Incluido', 'all-inclusive', 'Paquetes premium sin preocupaciones', 'Star', 'coming_soon', false, true, NULL, 10);

-- =============================================
-- 2. CATEGORÍAS DE DESTINOS
-- =============================================

CREATE TABLE public.destination_categories (
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
INSERT INTO public.destination_categories (name, slug, subtitle, display_order) VALUES
('Destinos de Playa', 'beach', 'Premium y Relax', 1),
('Aventura y Naturaleza Salvaje', 'adventure', 'Experiencias únicas', 2),
('Cultura y Montaña', 'culture', 'Tradición y paisajes', 3),
('Fenómenos Únicos', 'phenomena', 'Maravillas naturales', 4),
('Destinos Internacionales', 'international', 'Vuelos populares', 5),
('Hoteles Populares', 'hotels', 'Mejores hospedajes', 6);

-- =============================================
-- 3. DESTINOS
-- =============================================

CREATE TYPE destination_type AS ENUM ('venezuela', 'flight', 'hotel');

CREATE TABLE public.destinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES public.destination_categories(id) ON DELETE SET NULL,
    destination_type destination_type NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    short_description TEXT,
    country TEXT,
    city TEXT,
    airport_code TEXT,                   -- Para destinos de vuelos (CUN, MIA, etc.)
    hotel_type TEXT,                     -- Para destinos de hoteles (Resort, Boutique, etc.)
    image_url TEXT,
    gallery JSONB DEFAULT '[]',          -- Array de URLs de imágenes adicionales
    tags JSONB DEFAULT '[]',             -- ["Lujo", "Buceo", "Kitesurf"]
    highlights JSONB DEFAULT '[]',       -- ["Aguas cristalinas", "Arenas blancas"]
    coordinates JSONB,                   -- {"lat": 11.85, "lng": -66.75}
    pricing JSONB,                       -- {"from": 500, "currency": "USD"}
    has_online_search BOOLEAN DEFAULT false,
    has_quote_request BOOLEAN DEFAULT true,
    search_href TEXT,                    -- Ruta de búsqueda si tiene compra online
    display_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar destinos de Venezuela (ejemplo parcial)
-- Los Roques
INSERT INTO public.destinations (category_id, destination_type, name, slug, description, short_description, country, image_url, tags, highlights, has_quote_request, display_order)
SELECT
    id, 'venezuela', 'Archipiélago Los Roques', 'los-roques',
    'Es el destino de lujo por excelencia. Sus aguas cristalinas y arenas blancas son comparadas con las Maldivas. Es ideal para extranjeros que buscan exclusividad, buceo y kitesurf.',
    'Paraíso caribeño de aguas cristalinas',
    'Venezuela',
    '/images/destinations/los-roques.jpg',
    '["Lujo", "Buceo", "Kitesurf"]'::jsonb,
    '["Aguas cristalinas", "Arenas blancas", "Exclusividad"]'::jsonb,
    true, 1
FROM public.destination_categories WHERE slug = 'beach';

-- Isla de Margarita
INSERT INTO public.destinations (category_id, destination_type, name, slug, description, short_description, country, image_url, tags, highlights, has_quote_request, display_order)
SELECT
    id, 'venezuela', 'Isla de Margarita', 'isla-margarita',
    'Perfecta por su infraestructura. Ofrece desde hoteles todo incluido y compras (puerto libre) hasta playas icónicas como Playa El Yaque (famosa mundialmente para windsurf) y Playa El Agua.',
    'Todo incluido y puerto libre',
    'Venezuela',
    '/images/destinations/margarita.jpg',
    '["Todo Incluido", "Compras", "Windsurf"]'::jsonb,
    '["Puerto libre", "Playa El Yaque", "Playa El Agua"]'::jsonb,
    true, 2
FROM public.destination_categories WHERE slug = 'beach';

-- (Agregar resto de destinos de venezuelaDestinations.js)

-- Destinos de vuelos internacionales
INSERT INTO public.destinations (category_id, destination_type, name, slug, short_description, country, city, airport_code, has_online_search, has_quote_request, search_href, display_order)
SELECT
    id, 'flight', 'Cancún', 'cancun',
    'Playas paradisíacas del Caribe mexicano',
    'México', 'Cancún', 'CUN',
    true, true, '/flights?to=CUN', 1
FROM public.destination_categories WHERE slug = 'international';

-- (Agregar resto de destinos de popularDestinations.js)

-- =============================================
-- 4. PROVEEDORES DE TURISMO
-- =============================================

CREATE TYPE provider_type AS ENUM (
    'airline',           -- Aerolínea
    'hotel_chain',       -- Cadena hotelera
    'tour_operator',     -- Operador de tours
    'transfer_company',  -- Empresa de traslados
    'insurance_provider',-- Aseguradora
    'car_rental',        -- Alquiler de autos
    'cruise_line',       -- Línea de cruceros
    'dmc',               -- Destination Management Company
    'consolidator',      -- Consolidador de vuelos/hoteles
    'other'
);

CREATE TYPE provider_status AS ENUM ('active', 'inactive', 'pending_approval');

CREATE TABLE public.tourism_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    type provider_type NOT NULL,
    logo_url TEXT,
    description TEXT,

    -- Información de contacto
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    website TEXT,

    -- Ubicación
    country TEXT,
    city TEXT,
    address TEXT,

    -- Datos comerciales
    tax_id TEXT,                         -- RIF, NIT, etc.
    commission_rate DECIMAL(5,2),        -- Porcentaje de comisión (ej: 15.00)
    payment_terms TEXT,                  -- "Net 30", "Prepaid", etc.
    currency TEXT DEFAULT 'USD',

    -- Integración API (si aplica)
    api_enabled BOOLEAN DEFAULT false,
    api_credentials JSONB,               -- {api_key, endpoint, etc.}

    -- Estado
    status provider_status DEFAULT 'pending_approval',
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.profiles(id),

    -- Metadata
    services_offered JSONB DEFAULT '[]', -- ["flights", "hotels", "packages"]
    destinations_covered JSONB DEFAULT '[]', -- ["Venezuela", "Colombia"]
    rating DECIMAL(3,2),                 -- Rating interno (1-5)
    notes TEXT,                          -- Notas internas

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contratos con proveedores
CREATE TABLE public.provider_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES public.tourism_providers(id) ON DELETE CASCADE,
    contract_number TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    commission_rate DECIMAL(5,2),        -- Puede diferir del rate general
    terms JSONB,                         -- Términos específicos del contrato
    document_url TEXT,                   -- URL del PDF del contrato
    status TEXT DEFAULT 'active',        -- 'active', 'expired', 'terminated'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. INVENTARIO DE PRODUCTOS
-- =============================================

CREATE TYPE inventory_status AS ENUM ('available', 'limited', 'sold_out', 'discontinued');
CREATE TYPE product_type AS ENUM ('flight', 'hotel', 'package', 'tour', 'transfer', 'insurance', 'car_rental', 'cruise', 'other');

CREATE TABLE public.service_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES public.tourism_providers(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.catalog_services(id) ON DELETE SET NULL,
    destination_id UUID REFERENCES public.destinations(id) ON DELETE SET NULL,

    name TEXT NOT NULL,
    sku TEXT UNIQUE,                     -- Código interno del producto
    description TEXT,

    -- Tipo de producto
    product_type product_type NOT NULL,

    -- Precios
    cost_price DECIMAL(10,2),            -- Precio de costo (del proveedor)
    sale_price DECIMAL(10,2),            -- Precio de venta al público
    currency TEXT DEFAULT 'USD',
    pricing_details JSONB,               -- {base, taxes, fees, markup, etc.}

    -- Margen
    margin_amount DECIMAL(10,2) GENERATED ALWAYS AS (sale_price - cost_price) STORED,
    margin_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN cost_price > 0 THEN ((sale_price - cost_price) / cost_price * 100) ELSE 0 END
    ) STORED,

    -- Disponibilidad
    status inventory_status DEFAULT 'available',
    quantity_available INTEGER,          -- NULL = ilimitado
    valid_from DATE,
    valid_until DATE,
    blackout_dates JSONB DEFAULT '[]',   -- Fechas no disponibles

    -- Detalles específicos del producto
    details JSONB DEFAULT '{}',
    /*
    Para vuelos: {route: "CCS-MIA", airline: "AA", class: "economy", baggage: "23kg"}
    Para hoteles: {room_type: "Standard", nights: 3, meal_plan: "BB", stars: 4}
    Para tours: {duration: "3 days", includes: [...], excludes: [...], difficulty: "easy"}
    Para transfers: {vehicle_type: "SUV", passengers: 4, luggage: "2 large"}
    */

    -- Imágenes
    images JSONB DEFAULT '[]',

    -- Visibilidad
    is_featured BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,

    -- Auditoría
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de precios
CREATE TABLE public.inventory_price_history (
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

CREATE TRIGGER trigger_log_price_change
    AFTER UPDATE ON public.service_inventory
    FOR EACH ROW EXECUTE FUNCTION log_price_change();

-- =============================================
-- 6. ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX idx_catalog_services_status ON public.catalog_services(status);
CREATE INDEX idx_catalog_services_order ON public.catalog_services(display_order);

CREATE INDEX idx_destination_categories_active ON public.destination_categories(is_active);
CREATE INDEX idx_destinations_category ON public.destinations(category_id);
CREATE INDEX idx_destinations_type ON public.destinations(destination_type);
CREATE INDEX idx_destinations_active ON public.destinations(is_active);
CREATE INDEX idx_destinations_featured ON public.destinations(is_featured);

CREATE INDEX idx_providers_type ON public.tourism_providers(type);
CREATE INDEX idx_providers_status ON public.tourism_providers(status);
CREATE INDEX idx_provider_contracts_provider ON public.provider_contracts(provider_id);
CREATE INDEX idx_provider_contracts_status ON public.provider_contracts(status);

CREATE INDEX idx_inventory_provider ON public.service_inventory(provider_id);
CREATE INDEX idx_inventory_service ON public.service_inventory(service_id);
CREATE INDEX idx_inventory_destination ON public.service_inventory(destination_id);
CREATE INDEX idx_inventory_status ON public.service_inventory(status);
CREATE INDEX idx_inventory_type ON public.service_inventory(product_type);
CREATE INDEX idx_inventory_featured ON public.service_inventory(is_featured);

-- =============================================
-- 7. RLS POLICIES
-- =============================================

ALTER TABLE public.catalog_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tourism_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_inventory ENABLE ROW LEVEL SECURITY;

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

-- Escritura solo con service_role (backend admin)
-- Las operaciones de escritura usarán createAdminClient() que bypasea RLS

-- =============================================
-- 8. TRIGGERS DE UPDATED_AT
-- =============================================

CREATE TRIGGER update_catalog_services_updated_at
    BEFORE UPDATE ON public.catalog_services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_destination_categories_updated_at
    BEFORE UPDATE ON public.destination_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_destinations_updated_at
    BEFORE UPDATE ON public.destinations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tourism_providers_updated_at
    BEFORE UPDATE ON public.tourism_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_inventory_updated_at
    BEFORE UPDATE ON public.service_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Componentes de Página (Siguiendo Patrones Existentes)

### Ejemplo: Lista de Servicios (`/dashboard/cms/services/page.js`)

```javascript
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const STATUS_LABELS = {
  active: { label: "Activo", color: "bg-green-100 text-green-800" },
  coming_soon: { label: "Próximamente", color: "bg-yellow-100 text-yellow-800" },
  disabled: { label: "Desactivado", color: "bg-gray-100 text-gray-800" },
};

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");

  useEffect(() => {
    fetchServices();
  }, [selectedStatus]);

  async function fetchServices() {
    setLoading(true);
    try {
      const url = selectedStatus
        ? `/api/cms/services?status=${selectedStatus}`
        : "/api/cms/services";
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setServices(data.data || []);
      }
    } catch (err) {
      setError("Error al cargar servicios");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, newStatus) {
    try {
      const response = await fetch(`/api/cms/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        fetchServices();
      }
    } catch (err) {
      console.error("Error updating:", err);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los servicios de la página principal
          </p>
        </div>
        <Link
          href="/dashboard/cms/services/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          + Nuevo Servicio
        </Link>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setSelectedStatus("")}
          className={`rounded-full px-3 py-1 text-sm ${
            selectedStatus === "" ? "bg-primary text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          Todos
        </button>
        {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setSelectedStatus(key)}
            className={`rounded-full px-3 py-1 text-sm ${
              selectedStatus === key ? "bg-primary text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-md bg-yellow-50 p-4 text-yellow-700">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-lg bg-white shadow-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Orden
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Servicio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Compra Online
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            ) : services.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No hay servicios
                </td>
              </tr>
            ) : (
              services.map((service) => (
                <tr key={service.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {service.display_order}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">
                        {service.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={service.status}
                      onChange={(e) => updateStatus(service.id, e.target.value)}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        STATUS_LABELS[service.status]?.color || "bg-gray-100"
                      }`}
                    >
                      {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {service.has_online_purchase ? "Sí" : "No"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link
                      href={`/dashboard/cms/services/${service.id}`}
                      className="text-primary hover:text-primary/80"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## Actualización del Dashboard Principal

### Nuevas Estadísticas (`/dashboard/page.js`)

```javascript
// Agregar stats de los nuevos módulos
const stats = [
  // CRM existente
  { title: "Leads", value: leadsCount, href: "/dashboard/leads" },
  { title: "Cotizaciones", value: quotationsCount, href: "/dashboard/quotations" },
  { title: "Tickets Abiertos", value: ticketsCount, href: "/dashboard/support" },

  // CMS nuevo
  { title: "Servicios Activos", value: servicesCount, href: "/dashboard/cms/services" },
  { title: "Destinos", value: destinationsCount, href: "/dashboard/cms/destinations" },

  // Operaciones nuevo
  { title: "Proveedores", value: providersCount, href: "/dashboard/providers" },
  { title: "Productos en Inventario", value: inventoryCount, href: "/dashboard/inventory" },
];
```

---

## Integración con Página Principal

### Actualizar Componentes de Home

Los componentes de la página principal deben leer de la base de datos en lugar de archivos estáticos:

```javascript
// /components/pages/home/sections/ServicesSection.js
import { createClient } from "@/lib/db/supabase/server";

export async function ServicesSection() {
  const supabase = await createClient();

  // Obtener servicios activos ordenados
  const { data: services } = await supabase
    .from("catalog_services")
    .select("*")
    .neq("status", "disabled")
    .order("display_order", { ascending: true });

  // Fallback a datos estáticos si falla
  if (!services?.length) {
    const { getEnabledServices } = await import("@/data/servicesConfig");
    return <ServicesGrid services={getEnabledServices()} />;
  }

  return <ServicesGrid services={services} />;
}
```

Similar para `VenezuelaDestinations`, `PopularFlightDestinations`, `PopularHotelDestinations`.

---

## Fases de Implementación

### Fase 1: Base de Datos (2-3 días)
- [ ] Crear migración SQL `003_cms_providers_inventory.sql`
- [ ] Ejecutar migración en Supabase
- [ ] Migrar datos de archivos estáticos a tablas
- [ ] Verificar índices y RLS

### Fase 2: API Routes (2-3 días)
- [ ] `/api/cms/services/*`
- [ ] `/api/cms/destinations/*`
- [ ] `/api/cms/categories/*`
- [ ] `/api/providers/*`
- [ ] `/api/inventory/*`

### Fase 3: Dashboard UI - CMS (3-4 días)
- [ ] Actualizar `layout.js` con nuevo sidebar
- [ ] `/dashboard/cms/services/*` (CRUD completo)
- [ ] `/dashboard/cms/destinations/*` (CRUD completo)
- [ ] `/dashboard/cms/categories/*` (CRUD completo)
- [ ] Uploader de imágenes

### Fase 4: Dashboard UI - Proveedores (2-3 días)
- [ ] `/dashboard/providers/*` (CRUD completo)
- [ ] Gestión de contratos
- [ ] Aprobación de proveedores

### Fase 5: Dashboard UI - Inventario (2-3 días)
- [ ] `/dashboard/inventory/*` (CRUD completo)
- [ ] Historial de precios
- [ ] Filtros avanzados

### Fase 6: Integración Home (1-2 días)
- [ ] Actualizar `ServicesSection`
- [ ] Actualizar `VenezuelaDestinations`
- [ ] Actualizar `PopularFlightDestinations`
- [ ] Actualizar `PopularHotelDestinations`
- [ ] Cache y revalidación

### Fase 7: Testing y Deploy (1-2 días)
- [ ] Tests de integración
- [ ] Pruebas de usuario
- [ ] Deploy a producción

---

## Resumen Visual del Dashboard Final

```
┌─────────────────────────────────────────────────────────────────┐
│                        DASHBOARD                                 │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                   │
│   SIDEBAR    │              CONTENIDO PRINCIPAL                  │
│   (w-64)     │                                                   │
│              │                                                   │
│  ─────────── │  ┌─────────────────────────────────────────────┐ │
│  CRM         │  │  Stats: Leads | Cotizaciones | Tickets      │ │
│  ─────────── │  │          Servicios | Destinos | Proveedores │ │
│  • Dashboard │  │          Productos en Inventario            │ │
│  • Leads     │  └─────────────────────────────────────────────┘ │
│  • Cotizac.  │                                                   │
│  • Soporte   │  ┌─────────────────────────────────────────────┐ │
│              │  │  Tabla/Lista del módulo seleccionado        │ │
│  ─────────── │  │                                              │ │
│  CONTENIDO   │  │  [+ Nuevo]  [Filtros]  [Exportar]           │ │
│  ─────────── │  │                                              │ │
│  • Servicios │  │  ┌──────┬──────┬──────┬──────┬──────┐       │ │
│  • Destinos  │  │  │ Col1 │ Col2 │ Col3 │ Col4 │ Acc. │       │ │
│  • Categorías│  │  ├──────┼──────┼──────┼──────┼──────┤       │ │
│              │  │  │ ...  │ ...  │ ...  │ ...  │ Ver  │       │ │
│  ─────────── │  │  │ ...  │ ...  │ ...  │ ...  │ Ver  │       │ │
│  OPERACIONES │  │  └──────┴──────┴──────┴──────┴──────┘       │ │
│  ─────────── │  └─────────────────────────────────────────────┘ │
│  • Proveedor.│                                                   │
│  • Inventario│                                                   │
│              │                                                   │
│  ─────────── │                                                   │
│  • Mi Perfil │                                                   │
│  • Volver    │                                                   │
│              │                                                   │
└──────────────┴──────────────────────────────────────────────────┘
```

---

## Próximos Pasos

1. **Aprobar** este plan
2. **Crear rama** `feature/cms-inventory`
3. **Ejecutar** migración SQL en Supabase
4. **Implementar** siguiendo las fases

¿Deseas proceder con la implementación?
