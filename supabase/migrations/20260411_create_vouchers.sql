-- =============================================
-- MIGRATION: Create vouchers table
-- Date: 2026-04-11
-- Author: Voucher Module Implementation
-- Purpose: Manual voucher generation for pre-paid services
-- =============================================
--
-- Vouchers are manually issued by agents/admins from the dashboard.
-- They are NOT tied to a Stripe payment because the platform does not
-- yet have a payment gateway. A voucher is a standalone document that
-- references optional CRM entities (lead / quotation / advisor) and
-- stores a snapshot of the services contracted by the client.
--
-- Dependencies:
--   - public.leads (001_crm_tables.sql)
--   - public.advisors (001_crm_tables.sql)
--   - public.quotations (001_crm_tables.sql)
--   - public.tourism_providers (003_cms_providers_inventory.sql)
--   - function update_updated_at_column() (003_cms_providers_inventory.sql)
-- =============================================

-- =============================================
-- SECTION 1: SEQUENCE FOR VOUCHER NUMBER
-- =============================================

CREATE SEQUENCE IF NOT EXISTS public.vouchers_seq START 1;

-- =============================================
-- SECTION 2: VOUCHERS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_number VARCHAR(20) UNIQUE NOT NULL,

    -- Optional CRM relations
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
    advisor_id UUID REFERENCES public.advisors(id) ON DELETE SET NULL,

    -- Identification (editable by admin)
    title VARCHAR(200) NOT NULL DEFAULT 'Voucher de Servicios Pre-pagados',
    subtitle VARCHAR(300) DEFAULT 'Su puerta de entrada a experiencias inolvidables en Venezuela',
    locator_code VARCHAR(50),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Passengers snapshot
    -- Example:
    -- [
    --   {
    --     "full_name": "STEPHANIE/SCHREIER DEL SOLAR",
    --     "id_type": "PP",
    --     "id_number": "C84F2HPKY"
    --   }
    -- ]
    passengers JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Contracted services snapshot
    -- Example:
    -- {
    --   "accommodation": {
    --     "hotel_name": "CAMPAMENTO / HABITACION MATRIMONIAL SUPERIOR",
    --     "room_description": "con aire acondicionado, bano privado y agua caliente",
    --     "check_in": "2026-05-21",
    --     "check_out": "2026-05-24",
    --     "nights": 3,
    --     "days": 4,
    --     "location": "Canaima, Edo. Bolivar"
    --   },
    --   "excursions": [
    --     { "title": "Paseo por la Laguna de Canaima", "included": true, "note": null }
    --   ],
    --   "transfers": ["Aeropuerto / Hotel / Aeropuerto"],
    --   "meals": "Desayunos, almuerzos y cenas...",
    --   "others": ["Coctel de bienvenida", "WiFi"]
    -- }
    services JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Observations
    observations TEXT,
    emergency_contact VARCHAR(50) DEFAULT '+58 426-4034052',
    important_notes TEXT,
    validity_notes TEXT,

    -- Provider snapshot (optional)
    provider_id UUID REFERENCES public.tourism_providers(id) ON DELETE SET NULL,
    provider_snapshot JSONB,

    -- Status machine
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'issued', 'sent', 'cancelled')),

    -- PDF cache (invalidated on edit)
    pdf_url TEXT,
    pdf_generated_at TIMESTAMPTZ,
    pdf_stale BOOLEAN NOT NULL DEFAULT true,

    -- Audit
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    issued_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    sent_to_email VARCHAR(200),
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    -- Free metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- SECTION 3: INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_vouchers_number     ON public.vouchers(voucher_number);
CREATE INDEX IF NOT EXISTS idx_vouchers_status     ON public.vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_lead       ON public.vouchers(lead_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_quotation  ON public.vouchers(quotation_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_advisor    ON public.vouchers(advisor_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_created_at ON public.vouchers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_issue_date ON public.vouchers(issue_date DESC);

-- =============================================
-- SECTION 4: FUNCTIONS & TRIGGERS
-- =============================================

-- Generate voucher_number on INSERT if not provided: VV-VC-000001
CREATE OR REPLACE FUNCTION public.generate_voucher_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.voucher_number IS NULL OR NEW.voucher_number = '' THEN
        NEW.voucher_number := 'VV-VC-' || LPAD(NEXTVAL('public.vouchers_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_voucher_number ON public.vouchers;
CREATE TRIGGER trigger_generate_voucher_number
    BEFORE INSERT ON public.vouchers
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_voucher_number();

-- Invalidate PDF cache whenever content fields change. Also refresh updated_at.
CREATE OR REPLACE FUNCTION public.vouchers_on_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();

    IF (NEW.title, NEW.subtitle, NEW.locator_code, NEW.issue_date,
        NEW.passengers, NEW.services, NEW.observations,
        NEW.important_notes, NEW.validity_notes, NEW.emergency_contact,
        NEW.provider_id, NEW.provider_snapshot)
       IS DISTINCT FROM
       (OLD.title, OLD.subtitle, OLD.locator_code, OLD.issue_date,
        OLD.passengers, OLD.services, OLD.observations,
        OLD.important_notes, OLD.validity_notes, OLD.emergency_contact,
        OLD.provider_id, OLD.provider_snapshot)
    THEN
        NEW.pdf_stale := true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vouchers_on_update ON public.vouchers;
CREATE TRIGGER trigger_vouchers_on_update
    BEFORE UPDATE ON public.vouchers
    FOR EACH ROW
    EXECUTE FUNCTION public.vouchers_on_update();

-- =============================================
-- SECTION 5: ROW LEVEL SECURITY
-- =============================================
--
-- NOTE: Role-based access control (RBAC) is deferred per product decision.
-- For now any authenticated user can read and write vouchers. This matches
-- the current /dashboard behaviour (no role guards on other CRM tables).
-- TODO: Restrict to admin/agent roles when RBAC is introduced.
-- =============================================

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vouchers_authenticated_read" ON public.vouchers;
CREATE POLICY "vouchers_authenticated_read" ON public.vouchers
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "vouchers_authenticated_write" ON public.vouchers;
CREATE POLICY "vouchers_authenticated_write" ON public.vouchers
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =============================================
-- SECTION 6: STORAGE (vouchers folder inside documents bucket)
-- =============================================
--
-- The 'documents' bucket already exists from 002_crm_quotations_update.sql.
-- Voucher PDFs will live under: documents/vouchers/{YYYY}/{MM}/{voucher_number}.pdf
-- No additional bucket setup needed.
-- =============================================

-- =============================================
-- SECTION 7: COMMENTS (documentation)
-- =============================================

COMMENT ON TABLE public.vouchers IS
    'Manually-issued vouchers for pre-paid services. Not tied to a payment gateway.';
COMMENT ON COLUMN public.vouchers.voucher_number IS
    'Auto-generated identifier with format VV-VC-000000';
COMMENT ON COLUMN public.vouchers.passengers IS
    'JSONB array of passenger objects: {full_name, id_type, id_number}';
COMMENT ON COLUMN public.vouchers.services IS
    'JSONB structure with keys accommodation, excursions, transfers, meals, others';
COMMENT ON COLUMN public.vouchers.pdf_stale IS
    'True when content changed after last PDF generation; next download regenerates';
COMMENT ON COLUMN public.vouchers.status IS
    'draft -> issued (pdf generated) -> sent (emailed) or cancelled (terminal)';

-- =============================================
-- SECTION 8: ROLLBACK (commented — run manually if needed)
-- =============================================
--
-- DROP TRIGGER IF EXISTS trigger_vouchers_on_update ON public.vouchers;
-- DROP TRIGGER IF EXISTS trigger_generate_voucher_number ON public.vouchers;
-- DROP FUNCTION IF EXISTS public.vouchers_on_update();
-- DROP FUNCTION IF EXISTS public.generate_voucher_number();
-- DROP POLICY IF EXISTS "vouchers_authenticated_write" ON public.vouchers;
-- DROP POLICY IF EXISTS "vouchers_authenticated_read" ON public.vouchers;
-- DROP TABLE IF EXISTS public.vouchers;
-- DROP SEQUENCE IF EXISTS public.vouchers_seq;
