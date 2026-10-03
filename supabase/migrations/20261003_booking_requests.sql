-- =============================================
-- MIGRACIÓN: solicitudes de reserva / cotización desde el sitio público
--
-- Tabla propia en vez de columnas nuevas en `leads` porque:
--   · `leads` lo consumen 11 sitios del CRM; ampliarla arriesga cada uno
--   · un lead puede generar varias solicitudes (pregunta por dos paquetes)
--   · estos datos tienen vida propia: caducan, se purgan y se archivan
--     con criterios distintos a los del lead comercial
--
-- NO guarda datos de pasaporte. El formulario público solo recoge lo
-- necesario para responder: contacto, fechas aproximadas y nº de viajeros.
-- Los datos de identidad se piden al confirmar la reserva, desde el CRM,
-- donde existe base legal de ejecución de contrato. Pedirlos en una
-- solicitud web incumple el principio de minimización de datos (la AEPD
-- sancionó esa práctica en junio de 2025, incluso habiendo obligación
-- legal de registrar viajeros).
--
-- Aditivo: no toca ninguna tabla existente.
-- Reversible con DROP TABLE public.booking_requests;
-- =============================================

CREATE TABLE IF NOT EXISTS public.booking_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- El lead es el registro comercial; esta fila es la solicitud concreta.
  -- CASCADE: si se borra el lead (p.ej. por derecho de supresión), la
  -- solicitud se va con él y no quedan datos huérfanos.
  lead_id          UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Lo deduce el asesor al responder; el cliente no elige entre "reservar"
  -- y "cotizar" porque esa distinción es interna nuestra.
  request_type     TEXT NOT NULL DEFAULT 'quote'
                   CHECK (request_type IN ('booking', 'quote')),

  -- Contexto del producto. Los tres son NULL cuando la solicitud viene del
  -- cintillo, el footer o /about, que son contacto genérico sin producto.
  product_type     TEXT,                    -- package | destination | service
  product_slug     TEXT,
  product_name     TEXT,

  -- Texto libre ("Dec 2026", "Not sure yet") en vez de DATE: el cliente
  -- todavía no tiene fecha cerrada y forzar un día concreto añade fricción
  -- y produce datos falsos.
  travel_period    TEXT,
  travelers_count  INT,
  adults           INT,
  children         INT,

  -- La razón de ser del selector de canal: hasta ahora
  -- leads.preferred_contact_method valía siempre 'whatsapp' porque estaba
  -- escrito a fuego en el código, así que no existe ningún dato real sobre
  -- qué canal prefiere la gente.
  preferred_channel TEXT
                   CHECK (preferred_channel IN ('whatsapp', 'email', 'phone')),

  -- Solo nombres, nunca documentos. JSONB porque es una lista corta que no
  -- se consulta ni se indexa por separado.
  companions       JSONB NOT NULL DEFAULT '[]'::jsonb,

  needs_flight     BOOLEAN NOT NULL DEFAULT FALSE,
  departure_city   TEXT,

  message          TEXT,                    -- campo libre del modal genérico
  special_requirements TEXT,

  -- Idioma en el que el cliente rellenó el formulario, para responderle igual.
  locale           TEXT NOT NULL DEFAULT 'en',

  -- Trazabilidad del envío: si uno falla, se ve cuál sin revisar logs.
  client_email_sent_at TIMESTAMPTZ,
  team_email_sent_at   TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS booking_requests_lead_id_idx
  ON public.booking_requests (lead_id);

CREATE INDEX IF NOT EXISTS booking_requests_created_at_idx
  ON public.booking_requests (created_at DESC);

-- RLS activada SIN políticas a propósito.
--
-- Con RLS activa y cero políticas, nadie pasa salvo el rol de servicio, que
-- las omite por diseño. El formulario público escribe a través de la API
-- (que usa el service role), y el CRM lee por endpoints autenticados.
--
-- Es el mismo patrón que ya protege `leads`: comprobado que un cliente
-- anónimo con la clave pública no puede insertar ahí.
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.booking_requests IS
  'Solicitudes de reserva o cotización del sitio público. No contiene datos de pasaporte: se recogen al confirmar, desde el CRM.';
