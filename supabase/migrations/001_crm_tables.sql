-- =============================================
-- CHECK-IN VENEZUELA - CRM MIGRATION
-- Tablas para gestión de leads, asesores, cotizaciones y soporte
-- =============================================

-- =============================================
-- NUEVOS ENUM TYPES PARA CRM
-- =============================================

-- Estados del pipeline de leads
CREATE TYPE lead_status AS ENUM (
    'new',           -- Nuevo lead sin contactar
    'contacted',     -- Contactado por primera vez
    'quoting',       -- En proceso de cotización
    'quote_sent',    -- Cotización enviada
    'awaiting_payment', -- Esperando pago
    'paid',          -- Pagado
    'fulfilled',     -- Servicio entregado
    'won',           -- Lead ganado/cerrado exitosamente
    'lost'           -- Lead perdido
);

-- Fuentes de captación de leads
CREATE TYPE lead_source AS ENUM (
    'web_form',      -- Formulario web
    'whatsapp',      -- WhatsApp
    'chatbot',       -- Chatbot
    'registration',  -- Registro de usuario
    'booking_intent', -- Intención de reserva abandonada
    'referral',      -- Referido
    'social_media',  -- Redes sociales
    'phone',         -- Llamada telefónica
    'email',         -- Email directo
    'other'          -- Otro
);

-- Tipo de interés del lead
CREATE TYPE lead_interest_type AS ENUM (
    'flight',
    'hotel',
    'package',
    'transfer',
    'insurance',
    'other'
);

-- Estado de cotización
CREATE TYPE quotation_status AS ENUM (
    'draft',         -- Borrador
    'sent',          -- Enviada al cliente
    'viewed',        -- Vista por el cliente
    'accepted',      -- Aceptada
    'rejected',      -- Rechazada
    'expired',       -- Expirada
    'converted'      -- Convertida a reserva
);

-- Tipo de interacción con lead
CREATE TYPE interaction_type AS ENUM (
    'note',          -- Nota interna
    'call',          -- Llamada
    'email',         -- Email
    'whatsapp',      -- WhatsApp
    'status_change', -- Cambio de estado
    'quote_sent',    -- Cotización enviada
    'system'         -- Acción del sistema
);

-- Estado de ticket de soporte
CREATE TYPE ticket_status AS ENUM (
    'open',          -- Abierto
    'in_progress',   -- En progreso
    'waiting_customer', -- Esperando respuesta del cliente
    'waiting_provider', -- Esperando proveedor
    'resolved',      -- Resuelto
    'closed'         -- Cerrado
);

-- Prioridad de ticket
CREATE TYPE ticket_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);

-- Categoría de ticket
CREATE TYPE ticket_category AS ENUM (
    'booking_change', -- Cambio de reserva
    'cancellation',   -- Cancelación
    'refund',         -- Reembolso
    'complaint',      -- Queja
    'inquiry',        -- Consulta
    'technical',      -- Problema técnico
    'other'           -- Otro
);

-- =============================================
-- TABLA: ADVISORS (Asesores)
-- =============================================

CREATE TABLE public.advisors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_code TEXT UNIQUE,
    department TEXT DEFAULT 'sales',
    whatsapp_number TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    specializations TEXT[] DEFAULT '{}',
    max_concurrent_leads INTEGER DEFAULT 50,
    commission_rate DECIMAL(5, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para advisors
CREATE INDEX idx_advisors_profile ON public.advisors(profile_id);
CREATE INDEX idx_advisors_active ON public.advisors(is_active);
CREATE INDEX idx_advisors_employee_code ON public.advisors(employee_code);

-- =============================================
-- TABLA: LEADS
-- =============================================

CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Fuente y estado
    source lead_source NOT NULL DEFAULT 'web_form',
    status lead_status NOT NULL DEFAULT 'new',

    -- Vinculación con usuario (si está registrado)
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    anonymous_user_id UUID REFERENCES public.anonymous_users(id) ON DELETE SET NULL,

    -- Asignación de asesor
    advisor_id UUID REFERENCES public.advisors(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ,

    -- Información de contacto
    contact_name TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    contact_phone_dial_code TEXT DEFAULT '+58',
    preferred_contact_method TEXT DEFAULT 'whatsapp',

    -- Interés del lead
    interest_type lead_interest_type NOT NULL DEFAULT 'other',
    interest_details JSONB DEFAULT '{}',
    -- Ejemplo interest_details:
    -- {
    --   "destination": "Cancún",
    --   "origin": "Caracas",
    --   "departure_date": "2024-03-15",
    --   "return_date": "2024-03-22",
    --   "passengers": {"adults": 2, "children": 1},
    --   "budget": 2500,
    --   "notes": "Prefiere vuelos directos"
    -- }

    -- Conversión
    converted_at TIMESTAMPTZ,
    conversion_booking_type TEXT, -- 'flight' | 'hotel'
    conversion_booking_id UUID,

    -- Metadata
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    referrer_url TEXT,
    landing_page TEXT,

    -- Timestamps
    last_contacted_at TIMESTAMPTZ,
    next_follow_up_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para leads
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_source ON public.leads(source);
CREATE INDEX idx_leads_advisor ON public.leads(advisor_id);
CREATE INDEX idx_leads_profile ON public.leads(profile_id);
CREATE INDEX idx_leads_created ON public.leads(created_at DESC);
CREATE INDEX idx_leads_interest_type ON public.leads(interest_type);
CREATE INDEX idx_leads_next_follow_up ON public.leads(next_follow_up_at);

-- =============================================
-- TABLA: LEAD_INTERACTIONS (Historial de interacciones)
-- =============================================

CREATE TABLE public.lead_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    advisor_id UUID REFERENCES public.advisors(id) ON DELETE SET NULL,

    type interaction_type NOT NULL,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    -- Ejemplo metadata:
    -- {
    --   "previous_status": "new",
    --   "new_status": "contacted",
    --   "duration_minutes": 15,
    --   "outcome": "interested"
    -- }

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para interacciones
CREATE INDEX idx_lead_interactions_lead ON public.lead_interactions(lead_id);
CREATE INDEX idx_lead_interactions_advisor ON public.lead_interactions(advisor_id);
CREATE INDEX idx_lead_interactions_type ON public.lead_interactions(type);
CREATE INDEX idx_lead_interactions_created ON public.lead_interactions(created_at DESC);

-- =============================================
-- TABLA: QUOTATIONS (Cotizaciones)
-- =============================================

CREATE TABLE public.quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_number TEXT UNIQUE NOT NULL,

    -- Relaciones
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    advisor_id UUID NOT NULL REFERENCES public.advisors(id) ON DELETE RESTRICT,

    -- Items de la cotización (vuelos, hoteles, servicios)
    items JSONB NOT NULL DEFAULT '[]',
    -- Ejemplo items:
    -- [
    --   {
    --     "type": "flight",
    --     "description": "Vuelo CCS-CUN ida y vuelta",
    --     "details": {...},
    --     "quantity": 2,
    --     "unit_price": 450.00,
    --     "total": 900.00
    --   },
    --   {
    --     "type": "hotel",
    --     "description": "Hotel 5 noches Cancún",
    --     "details": {...},
    --     "quantity": 1,
    --     "unit_price": 1200.00,
    --     "total": 1200.00
    --   }
    -- ]

    -- Precios
    subtotal DECIMAL(12, 2) NOT NULL,
    taxes DECIMAL(12, 2) DEFAULT 0.00,
    fees DECIMAL(12, 2) DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) DEFAULT 0.00,
    discount_reason TEXT,
    total DECIMAL(12, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',

    -- Estado y validez
    status quotation_status NOT NULL DEFAULT 'draft',
    valid_until TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    sent_via TEXT, -- 'email' | 'whatsapp' | 'both'
    viewed_at TIMESTAMPTZ,

    -- Conversión
    converted_at TIMESTAMPTZ,
    converted_booking_type TEXT,
    converted_booking_id UUID,

    -- Notas
    internal_notes TEXT,
    customer_notes TEXT,
    terms_and_conditions TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para cotizaciones
CREATE INDEX idx_quotations_lead ON public.quotations(lead_id);
CREATE INDEX idx_quotations_advisor ON public.quotations(advisor_id);
CREATE INDEX idx_quotations_status ON public.quotations(status);
CREATE INDEX idx_quotations_number ON public.quotations(quotation_number);
CREATE INDEX idx_quotations_created ON public.quotations(created_at DESC);
CREATE INDEX idx_quotations_valid_until ON public.quotations(valid_until);

-- =============================================
-- TABLA: SUPPORT_TICKETS (Tickets de Soporte)
-- =============================================

CREATE TABLE public.support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number TEXT UNIQUE NOT NULL,

    -- Relación con reserva
    booking_type TEXT NOT NULL, -- 'flight' | 'hotel'
    booking_id UUID NOT NULL,

    -- Usuario
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Asignación
    assigned_advisor_id UUID REFERENCES public.advisors(id) ON DELETE SET NULL,

    -- Detalles del ticket
    subject TEXT NOT NULL,
    description TEXT,
    category ticket_category NOT NULL DEFAULT 'inquiry',
    priority ticket_priority NOT NULL DEFAULT 'medium',
    status ticket_status NOT NULL DEFAULT 'open',

    -- Resolución
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para tickets
CREATE INDEX idx_support_tickets_profile ON public.support_tickets(profile_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX idx_support_tickets_category ON public.support_tickets(category);
CREATE INDEX idx_support_tickets_advisor ON public.support_tickets(assigned_advisor_id);
CREATE INDEX idx_support_tickets_booking ON public.support_tickets(booking_type, booking_id);
CREATE INDEX idx_support_tickets_created ON public.support_tickets(created_at DESC);

-- =============================================
-- TABLA: TICKET_MESSAGES (Mensajes de tickets)
-- =============================================

CREATE TABLE public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,

    -- Autor del mensaje
    author_type TEXT NOT NULL, -- 'customer' | 'advisor' | 'system'
    author_id UUID, -- profile_id o advisor_id según author_type

    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    -- Ejemplo attachments:
    -- [
    --   {"name": "receipt.pdf", "url": "...", "type": "application/pdf"}
    -- ]

    is_internal BOOLEAN DEFAULT FALSE, -- Nota interna solo visible para asesores

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mensajes
CREATE INDEX idx_ticket_messages_ticket ON public.ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_author ON public.ticket_messages(author_type, author_id);
CREATE INDEX idx_ticket_messages_created ON public.ticket_messages(created_at);

-- =============================================
-- TRIGGERS PARA UPDATED_AT
-- =============================================

CREATE TRIGGER update_advisors_updated_at BEFORE UPDATE ON public.advisors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON public.quotations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCIONES AUXILIARES
-- =============================================

-- Función para generar número de cotización
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.quotation_number := 'COT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                            LPAD(NEXTVAL('quotation_seq')::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Secuencia para número de cotización
CREATE SEQUENCE IF NOT EXISTS quotation_seq START 1;

-- Trigger para auto-generar número de cotización
CREATE TRIGGER set_quotation_number
    BEFORE INSERT ON public.quotations
    FOR EACH ROW
    WHEN (NEW.quotation_number IS NULL OR NEW.quotation_number = '')
    EXECUTE FUNCTION generate_quotation_number();

-- Función para generar número de ticket
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.ticket_number := 'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                         LPAD(NEXTVAL('ticket_seq')::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Secuencia para número de ticket
CREATE SEQUENCE IF NOT EXISTS ticket_seq START 1;

-- Trigger para auto-generar número de ticket
CREATE TRIGGER set_ticket_number
    BEFORE INSERT ON public.support_tickets
    FOR EACH ROW
    WHEN (NEW.ticket_number IS NULL OR NEW.ticket_number = '')
    EXECUTE FUNCTION generate_ticket_number();

-- =============================================
-- FUNCIÓN: Crear lead automáticamente al registrar usuario
-- =============================================

CREATE OR REPLACE FUNCTION create_lead_on_user_signup()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.leads (
        source,
        status,
        profile_id,
        contact_name,
        contact_email,
        interest_type
    ) VALUES (
        'registration',
        'new',
        NEW.id,
        CONCAT(NEW.first_name, ' ', NEW.last_name),
        NEW.email,
        'other'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear lead al crear perfil
CREATE TRIGGER on_profile_created_create_lead
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION create_lead_on_user_signup();

-- =============================================
-- ROW LEVEL SECURITY (RLS) PARA NUEVAS TABLAS
-- =============================================

-- Habilitar RLS
ALTER TABLE public.advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Policies para advisors (solo admins y el propio asesor pueden ver)
CREATE POLICY "Advisors can view own data" ON public.advisors
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Advisors can update own data" ON public.advisors
    FOR UPDATE USING (auth.uid() = profile_id);

-- Policies para leads (asesores ven los asignados, usuarios ven los propios)
CREATE POLICY "Users can view own leads" ON public.leads
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Advisors can view assigned leads" ON public.leads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.advisors
            WHERE advisors.profile_id = auth.uid()
            AND advisors.id = leads.advisor_id
        )
    );

CREATE POLICY "Advisors can update assigned leads" ON public.leads
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.advisors
            WHERE advisors.profile_id = auth.uid()
            AND advisors.id = leads.advisor_id
        )
    );

-- Policies para interacciones (asesores ven las de sus leads)
CREATE POLICY "Advisors can view lead interactions" ON public.lead_interactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.leads l
            JOIN public.advisors a ON a.id = l.advisor_id
            WHERE l.id = lead_interactions.lead_id
            AND a.profile_id = auth.uid()
        )
    );

CREATE POLICY "Advisors can create lead interactions" ON public.lead_interactions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.advisors
            WHERE advisors.profile_id = auth.uid()
            AND advisors.id = lead_interactions.advisor_id
        )
    );

-- Policies para cotizaciones
CREATE POLICY "Advisors can view own quotations" ON public.quotations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.advisors
            WHERE advisors.profile_id = auth.uid()
            AND advisors.id = quotations.advisor_id
        )
    );

CREATE POLICY "Advisors can manage own quotations" ON public.quotations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.advisors
            WHERE advisors.profile_id = auth.uid()
            AND advisors.id = quotations.advisor_id
        )
    );

-- Policies para tickets de soporte
CREATE POLICY "Users can view own tickets" ON public.support_tickets
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Users can create tickets" ON public.support_tickets
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Advisors can view assigned tickets" ON public.support_tickets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.advisors
            WHERE advisors.profile_id = auth.uid()
            AND advisors.id = support_tickets.assigned_advisor_id
        )
    );

CREATE POLICY "Advisors can update assigned tickets" ON public.support_tickets
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.advisors
            WHERE advisors.profile_id = auth.uid()
            AND advisors.id = support_tickets.assigned_advisor_id
        )
    );

-- Policies para mensajes de tickets
CREATE POLICY "Users can view own ticket messages" ON public.ticket_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.support_tickets t
            WHERE t.id = ticket_messages.ticket_id
            AND t.profile_id = auth.uid()
            AND ticket_messages.is_internal = FALSE
        )
    );

CREATE POLICY "Users can create ticket messages" ON public.ticket_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.support_tickets t
            WHERE t.id = ticket_messages.ticket_id
            AND t.profile_id = auth.uid()
        )
        AND ticket_messages.author_type = 'customer'
    );

CREATE POLICY "Advisors can view assigned ticket messages" ON public.ticket_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.support_tickets t
            JOIN public.advisors a ON a.id = t.assigned_advisor_id
            WHERE t.id = ticket_messages.ticket_id
            AND a.profile_id = auth.uid()
        )
    );

CREATE POLICY "Advisors can create ticket messages" ON public.ticket_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.support_tickets t
            JOIN public.advisors a ON a.id = t.assigned_advisor_id
            WHERE t.id = ticket_messages.ticket_id
            AND a.profile_id = auth.uid()
        )
        AND ticket_messages.author_type = 'advisor'
    );

-- =============================================
-- FIN DE LA MIGRACIÓN CRM
-- =============================================
