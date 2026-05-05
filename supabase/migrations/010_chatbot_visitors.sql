-- =============================================
-- CHECK-IN VENEZUELA - CHATBOT VISITORS MIGRATION
-- Refactor del modelo de identidad: ahora la PII (nombre, email, teléfono)
-- y el consent viven en una tabla `chat_visitors` separada. Cada visitor
-- puede tener múltiples `chat_conversations` (threads), tipo ChatGPT.
--
-- Antes: cookie httpOnly → 1 conversation con contact_captured
-- Ahora: localStorage visitor_token → 1 visitor → N conversaciones
--
-- Idempotente: usa IF NOT EXISTS y DO blocks. Aditivo (no rompe data
-- existente, solo migra a la nueva forma).
-- =============================================

-- =============================================
-- SECTION 1: TABLE chat_visitors
-- =============================================

CREATE TABLE IF NOT EXISTS public.chat_visitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Token persistente en el localStorage del cliente (UUID v4)
  visitor_token TEXT UNIQUE NOT NULL,

  -- Vinculación opcional con usuario autenticado (Supabase Auth)
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Datos de contacto capturados (UNA vez, persistentes a través de threads)
  contact_captured JSONB DEFAULT '{}',
  -- Schema esperado:
  -- {
  --   "name": "Freddy",
  --   "email": "freddy@email.com",
  --   "phone": "+584141234567",
  --   "interestType": "package"
  -- }

  -- Consentimiento de tratamiento de datos
  consent_accepted BOOLEAN DEFAULT FALSE,
  consent_accepted_at TIMESTAMPTZ,
  consent_text_version TEXT,

  -- Idioma preferido del visitor (sticky entre conversaciones)
  preferred_language TEXT DEFAULT 'es' CHECK (preferred_language IN ('es', 'en')),

  -- Trazabilidad
  user_agent TEXT,
  ip_hash TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_visitors_token ON public.chat_visitors(visitor_token);
CREATE INDEX IF NOT EXISTS idx_chat_visitors_profile ON public.chat_visitors(profile_id);
CREATE INDEX IF NOT EXISTS idx_chat_visitors_last_seen ON public.chat_visitors(last_seen_at DESC);

-- =============================================
-- SECTION 2: ALTER chat_conversations - vincular a visitor
-- =============================================

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS visitor_id UUID REFERENCES public.chat_visitors(id) ON DELETE CASCADE;

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS title TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_conv_visitor ON public.chat_conversations(visitor_id);

-- =============================================
-- SECTION 3: MIGRATION DE DATOS — convertir conversaciones existentes
-- a visitors. Cada conversación con contact_captured no-vacío genera un
-- visitor; conversaciones huérfanas (sin datos) generan un visitor anónimo.
-- =============================================

-- Crear visitor para conversaciones que tengan contact_captured no vacío
-- (agrupadas por contact_email si existe, sino una por conversación)
DO $$
DECLARE
  conv_record RECORD;
  visitor_uuid UUID;
  found_token TEXT;
  found_email TEXT;
BEGIN
  FOR conv_record IN
    SELECT id, session_id, contact_captured, consent_accepted, consent_accepted_at,
           consent_text_version, language, user_agent, ip_hash,
           started_at, last_message_at
    FROM public.chat_conversations
    WHERE visitor_id IS NULL
  LOOP
    found_email := conv_record.contact_captured->>'email';

    -- Si ya hay un visitor con ese email, reusar
    visitor_uuid := NULL;
    IF found_email IS NOT NULL AND length(found_email) > 0 THEN
      SELECT id INTO visitor_uuid FROM public.chat_visitors
      WHERE contact_captured->>'email' = found_email
      LIMIT 1;
    END IF;

    -- Si no hay visitor, crear uno
    IF visitor_uuid IS NULL THEN
      -- Token: usamos session_id como token legacy (es único)
      found_token := COALESCE(conv_record.session_id, gen_random_uuid()::text);

      INSERT INTO public.chat_visitors (
        visitor_token, contact_captured,
        consent_accepted, consent_accepted_at, consent_text_version,
        preferred_language, user_agent, ip_hash,
        first_seen_at, last_seen_at
      ) VALUES (
        found_token,
        COALESCE(conv_record.contact_captured, '{}'),
        COALESCE(conv_record.consent_accepted, FALSE),
        conv_record.consent_accepted_at,
        conv_record.consent_text_version,
        COALESCE(conv_record.language, 'es'),
        conv_record.user_agent,
        conv_record.ip_hash,
        conv_record.started_at,
        conv_record.last_message_at
      )
      ON CONFLICT (visitor_token) DO UPDATE SET
        last_seen_at = GREATEST(public.chat_visitors.last_seen_at, EXCLUDED.last_seen_at)
      RETURNING id INTO visitor_uuid;
    END IF;

    -- Vincular la conversación al visitor
    UPDATE public.chat_conversations
    SET visitor_id = visitor_uuid
    WHERE id = conv_record.id;
  END LOOP;
END $$;

-- =============================================
-- SECTION 4: TRIGGERS
-- =============================================

-- Trigger: actualizar updated_at en chat_visitors
DROP TRIGGER IF EXISTS trg_chat_visitors_updated_at ON public.chat_visitors;
CREATE TRIGGER trg_chat_visitors_updated_at
  BEFORE UPDATE ON public.chat_visitors
  FOR EACH ROW EXECUTE FUNCTION public.chatbot_set_updated_at();

-- Trigger: cuando se crea o actualiza un mensaje, actualizar last_seen del visitor
CREATE OR REPLACE FUNCTION public.chatbot_update_visitor_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_visitors v
  SET last_seen_at = NEW.created_at
  FROM public.chat_conversations c
  WHERE c.id = NEW.conversation_id
    AND v.id = c.visitor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_msg_update_visitor ON public.chat_messages;
CREATE TRIGGER trg_chat_msg_update_visitor
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chatbot_update_visitor_on_message();

-- =============================================
-- SECTION 5: ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.chat_visitors ENABLE ROW LEVEL SECURITY;

-- Service role bypassa RLS automáticamente; estas policies son para advisors

DROP POLICY IF EXISTS "Advisors view all visitors" ON public.chat_visitors;
CREATE POLICY "Advisors view all visitors" ON public.chat_visitors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.advisors WHERE advisors.profile_id = auth.uid())
  );

-- Visitors NO pueden auto-leer su registro vía RLS — siempre va por
-- service-role en el server (los anónimos no tienen auth.uid()).

-- =============================================
-- SECTION 6: ROLLBACK (comentado)
-- =============================================

/*
-- Eliminar trigger del visitor
DROP TRIGGER IF EXISTS trg_chat_msg_update_visitor ON public.chat_messages;
DROP TRIGGER IF EXISTS trg_chat_visitors_updated_at ON public.chat_visitors;
DROP FUNCTION IF EXISTS public.chatbot_update_visitor_on_message();

-- Quitar columnas y FK
ALTER TABLE public.chat_conversations DROP COLUMN IF EXISTS visitor_id;
ALTER TABLE public.chat_conversations DROP COLUMN IF EXISTS title;

-- Eliminar políticas
DROP POLICY IF EXISTS "Advisors view all visitors" ON public.chat_visitors;

-- Eliminar tabla
DROP TABLE IF EXISTS public.chat_visitors;
*/
