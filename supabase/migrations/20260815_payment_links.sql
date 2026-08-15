-- =============================================
-- MIGRACIÓN: cobros con PayPal (Invoicing API)
--
-- Tabla propia en vez de columnas en `quotations` porque:
--   · un cobro puede existir sin cotización (un extra acordado por WhatsApp)
--   · una cotización puede tener varios (anticipo + saldo)
--   · `provider` deja la puerta abierta a Stripe sin volver a migrar
--
-- Aditivo: no toca ninguna tabla existente salvo para añadir dos columnas.
-- Reversible con DROP TABLE payment_links, payment_webhook_events
--   y ALTER TABLE quotations DROP COLUMN amount_paid, paid_at;
-- =============================================

CREATE TABLE IF NOT EXISTS public.payment_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  quotation_id   UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  lead_id        UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  provider       TEXT NOT NULL DEFAULT 'paypal',
  external_id    TEXT NOT NULL,          -- INV2-XXXX-XXXX-XXXX-XXXX
  url            TEXT NOT NULL,          -- lo que se le manda al cliente
  merchant_url   TEXT,                   -- vista interna en PayPal

  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency       TEXT NOT NULL DEFAULT 'USD',
  concept        TEXT NOT NULL,

  status         TEXT NOT NULL DEFAULT 'created'
                 CHECK (status IN ('created','sent','viewed','partially_paid',
                                   'paid','cancelled','refunded','expired')),
  amount_paid    NUMERIC(12,2) NOT NULL DEFAULT 0,

  customer_name  TEXT,
  customer_email TEXT,
  created_by     UUID REFERENCES public.profiles(id),
  paid_at        TIMESTAMPTZ,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- La factura de PayPal es única: evita insertar dos veces el mismo webhook/cobro
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_links_external
  ON public.payment_links(provider, external_id);

-- Una sola factura VIVA por cotización. Se impone en la BD y no solo en código:
-- así dos clics simultáneos en "Generar cobro" no pueden crear dos facturas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_links_one_active
  ON public.payment_links(quotation_id)
  WHERE quotation_id IS NOT NULL
    AND status IN ('created','sent','viewed','partially_paid');

CREATE INDEX IF NOT EXISTS idx_payment_links_status     ON public.payment_links(status);
CREATE INDEX IF NOT EXISTS idx_payment_links_quotation  ON public.payment_links(quotation_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_created    ON public.payment_links(created_at DESC);

-- =============================================
-- Idempotencia de webhooks
--
-- PayPal reintenta la entrega. Sin esta tabla, un mismo pago se contaría
-- dos veces y `amount_paid` quedaría inflado.
-- =============================================

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  event_id     TEXT PRIMARY KEY,
  provider     TEXT NOT NULL DEFAULT 'paypal',
  event_type   TEXT,
  resource_id  TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload      JSONB
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_resource
  ON public.payment_webhook_events(resource_id);

-- =============================================
-- Reflejo del pago en la cotización
-- =============================================

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at     TIMESTAMPTZ;

COMMENT ON COLUMN public.quotations.amount_paid IS
  'Importe cobrado vía payment_links. Lo actualiza el webhook de PayPal, nunca la UI.';

-- =============================================
-- updated_at automático
-- =============================================

DROP TRIGGER IF EXISTS update_payment_links_updated_at ON public.payment_links;
CREATE TRIGGER update_payment_links_updated_at
  BEFORE UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- RLS
--
-- Solo el personal autenticado gestiona cobros. El cliente nunca toca estas
-- tablas: paga en la página alojada por PayPal.
-- =============================================

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage payment links" ON public.payment_links;
CREATE POLICY "Authenticated manage payment links" ON public.payment_links
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated read webhook events" ON public.payment_webhook_events;
CREATE POLICY "Authenticated read webhook events" ON public.payment_webhook_events
  FOR SELECT USING (auth.role() = 'authenticated');
