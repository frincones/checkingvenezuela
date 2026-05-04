-- =============================================
-- CHECK-IN VENEZUELA - CHATBOT RAG MIGRATION
-- Tablas para chat conversacional, knowledge base con pgvector y métricas
-- Idempotente: usa IF NOT EXISTS y DO blocks para enums
-- Aditivo: solo agrega columnas a leads (no destruye ni modifica existentes)
-- =============================================

-- =============================================
-- SECTION 1: EXTENSIONS
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================
-- SECTION 2: ENUM TYPES
-- =============================================

DO $$ BEGIN
  CREATE TYPE chat_message_role AS ENUM ('user', 'assistant', 'system', 'tool');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE chat_conversation_status AS ENUM ('active', 'idle', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kb_source_type AS ENUM (
    'docx', 'pdf', 'txt', 'md', 'web',
    'db_destinations', 'db_packages', 'db_services', 'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kb_source_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- SECTION 3: TABLE chat_conversations
-- =============================================

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identidad de sesión (cookie httpOnly del cliente)
  session_id TEXT UNIQUE NOT NULL,

  -- Vinculación opcional con usuario autenticado
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Vinculación con lead (cuando se captura)
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  -- Idioma detectado (es | en)
  language TEXT DEFAULT 'es' CHECK (language IN ('es', 'en')),

  -- Estado y métricas agregadas
  status chat_conversation_status DEFAULT 'active',
  message_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  -- Consentimiento de tratamiento de datos
  consent_accepted BOOLEAN DEFAULT FALSE,
  consent_accepted_at TIMESTAMPTZ,
  consent_text_version TEXT,

  -- Datos de contacto capturados parcialmente (antes del consent)
  contact_captured JSONB DEFAULT '{}',

  -- Metadata libre (UTM, intent histórico, etc.)
  metadata JSONB DEFAULT '{}',

  -- Trazabilidad
  user_agent TEXT,
  ip_hash TEXT,
  referrer_url TEXT,
  landing_page TEXT,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conv_session ON public.chat_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_profile ON public.chat_conversations(profile_id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_lead ON public.chat_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_status ON public.chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_conv_started ON public.chat_conversations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conv_lang ON public.chat_conversations(language);

-- =============================================
-- SECTION 4: TABLE chat_messages
-- =============================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,

  role chat_message_role NOT NULL,
  content TEXT NOT NULL,

  -- Tool calls del LLM y sus resultados
  tool_calls JSONB DEFAULT '[]',
  tool_results JSONB DEFAULT '[]',

  -- Sources de RAG usadas en esta respuesta
  sources JSONB DEFAULT '[]',

  -- Clasificación de intent
  intent TEXT,

  -- Telemetría del modelo usado
  model TEXT,
  provider TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  latency_ms INTEGER,

  -- Error tracking si hubo fallback
  error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_msg_created ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_msg_role ON public.chat_messages(role);
CREATE INDEX IF NOT EXISTS idx_chat_msg_intent ON public.chat_messages(intent);

-- =============================================
-- SECTION 5: TABLE kb_sources (fuentes de conocimiento)
-- =============================================

CREATE TABLE IF NOT EXISTS public.kb_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  type kb_source_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- URL si es web, storage_path si es archivo subido
  url TEXT,
  storage_path TEXT,
  storage_bucket TEXT DEFAULT 'chatbot-kb',

  language TEXT DEFAULT 'es' CHECK (language IN ('es', 'en')),

  -- Estado del pipeline
  status kb_source_status DEFAULT 'pending',
  ingestion_error TEXT,

  -- Métricas
  document_count INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  metadata JSONB DEFAULT '{}',

  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ingested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_src_type ON public.kb_sources(type);
CREATE INDEX IF NOT EXISTS idx_kb_src_status ON public.kb_sources(status);

-- =============================================
-- SECTION 6: TABLE kb_documents (un source puede generar varios)
-- =============================================

CREATE TABLE IF NOT EXISTS public.kb_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES public.kb_sources(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  raw_content TEXT,
  language TEXT DEFAULT 'es' CHECK (language IN ('es', 'en')),
  version INTEGER DEFAULT 1,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (source_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_kb_doc_source ON public.kb_documents(source_id);
CREATE INDEX IF NOT EXISTS idx_kb_doc_lang ON public.kb_documents(language);

-- =============================================
-- SECTION 7: TABLE kb_chunks (vector + texto para hybrid search)
-- =============================================

CREATE TABLE IF NOT EXISTS public.kb_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,

  chunk_order INTEGER NOT NULL,
  content TEXT NOT NULL,
  tokens INTEGER,

  -- Jina v3 multilingual: 1024 dimensions
  embedding vector(1024),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc ON public.kb_chunks(document_id);
-- Vector index (ivfflat con cosine distance, 100 listas para datasets pequeños)
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding
  ON public.kb_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- Trigram index para búsqueda full-text fuzzy
CREATE INDEX IF NOT EXISTS idx_kb_chunks_content_trgm
  ON public.kb_chunks USING gin (content gin_trgm_ops);

-- =============================================
-- SECTION 8: TABLE kb_usage_log (tracking de cuotas)
-- =============================================

CREATE TABLE IF NOT EXISTS public.kb_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  model TEXT,

  tokens INTEGER DEFAULT 0,
  requests INTEGER DEFAULT 1,

  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  source_id UUID REFERENCES public.kb_sources(id) ON DELETE SET NULL,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_usage_provider_date ON public.kb_usage_log(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_usage_operation ON public.kb_usage_log(operation);

-- =============================================
-- SECTION 9: ALTER LEADS (aditivo, NO destructivo)
-- =============================================

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS consent_text_version TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS chatbot_conversation_id UUID
  REFERENCES public.chat_conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_chatbot_conv ON public.leads(chatbot_conversation_id);

-- =============================================
-- SECTION 10: STORAGE BUCKET (para uploads del KB)
-- =============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chatbot-kb',
  'chatbot-kb',
  FALSE,
  52428800, -- 50MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SECTION 11: FUNCTIONS & TRIGGERS
-- =============================================

-- Trigger: actualizar updated_at en chat_conversations y kb_sources
CREATE OR REPLACE FUNCTION public.chatbot_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_conv_updated_at ON public.chat_conversations;
CREATE TRIGGER trg_chat_conv_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.chatbot_set_updated_at();

DROP TRIGGER IF EXISTS trg_kb_sources_updated_at ON public.kb_sources;
CREATE TRIGGER trg_kb_sources_updated_at
  BEFORE UPDATE ON public.kb_sources
  FOR EACH ROW EXECUTE FUNCTION public.chatbot_set_updated_at();

-- Trigger: auto-actualizar message_count, total_tokens y last_message_at
CREATE OR REPLACE FUNCTION public.chatbot_update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_conversations
  SET message_count = message_count + 1,
      last_message_at = NEW.created_at,
      total_tokens = total_tokens + COALESCE(NEW.tokens_in, 0) + COALESCE(NEW.tokens_out, 0)
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_msg_update_conv ON public.chat_messages;
CREATE TRIGGER trg_chat_msg_update_conv
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chatbot_update_conversation_on_message();

-- Función: hybrid search (vector + trigram)
CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  query_embedding vector(1024),
  query_text TEXT,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INTEGER DEFAULT 5,
  filter_language TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT,
  text_score FLOAT,
  combined_score FLOAT,
  document_title TEXT,
  source_id UUID,
  source_name TEXT,
  source_type TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    (1 - (c.embedding <=> query_embedding))::FLOAT AS similarity,
    similarity(c.content, query_text)::FLOAT AS text_score,
    (0.7 * (1 - (c.embedding <=> query_embedding)) + 0.3 * similarity(c.content, query_text))::FLOAT AS combined_score,
    d.title AS document_title,
    s.id AS source_id,
    s.name AS source_name,
    s.type::TEXT AS source_type,
    c.metadata
  FROM public.kb_chunks c
  JOIN public.kb_documents d ON d.id = c.document_id
  JOIN public.kb_sources s ON s.id = d.source_id
  WHERE (1 - (c.embedding <=> query_embedding)) > match_threshold
    AND s.status = 'completed'
    AND (filter_language IS NULL OR d.language = filter_language)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- =============================================
-- SECTION 12: ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_usage_log ENABLE ROW LEVEL SECURITY;

-- chat_conversations: usuarios autenticados ven las suyas, advisors ven todas
DROP POLICY IF EXISTS "Users view own conversations" ON public.chat_conversations;
CREATE POLICY "Users view own conversations" ON public.chat_conversations
  FOR SELECT USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Advisors view all conversations" ON public.chat_conversations;
CREATE POLICY "Advisors view all conversations" ON public.chat_conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.advisors WHERE advisors.profile_id = auth.uid())
  );

-- chat_messages: hereda scope de la conversación
DROP POLICY IF EXISTS "Users view own messages" ON public.chat_messages;
CREATE POLICY "Users view own messages" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id AND c.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Advisors view all messages" ON public.chat_messages;
CREATE POLICY "Advisors view all messages" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.advisors WHERE advisors.profile_id = auth.uid())
  );

-- kb_*: solo advisors leen vía cliente; service-role escribe
DROP POLICY IF EXISTS "Advisors read kb_sources" ON public.kb_sources;
CREATE POLICY "Advisors read kb_sources" ON public.kb_sources
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.advisors WHERE advisors.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "Advisors read kb_documents" ON public.kb_documents;
CREATE POLICY "Advisors read kb_documents" ON public.kb_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.advisors WHERE advisors.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "Advisors read kb_chunks" ON public.kb_chunks;
CREATE POLICY "Advisors read kb_chunks" ON public.kb_chunks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.advisors WHERE advisors.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "Advisors read kb_usage" ON public.kb_usage_log;
CREATE POLICY "Advisors read kb_usage" ON public.kb_usage_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.advisors WHERE advisors.profile_id = auth.uid())
  );

-- =============================================
-- SECTION 13: ROLLBACK (comentado, ejecutar manualmente si se requiere)
-- =============================================

/*
-- Eliminar políticas
DROP POLICY IF EXISTS "Users view own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Advisors view all conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users view own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Advisors view all messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Advisors read kb_sources" ON public.kb_sources;
DROP POLICY IF EXISTS "Advisors read kb_documents" ON public.kb_documents;
DROP POLICY IF EXISTS "Advisors read kb_chunks" ON public.kb_chunks;
DROP POLICY IF EXISTS "Advisors read kb_usage" ON public.kb_usage_log;

-- Eliminar triggers y funciones
DROP TRIGGER IF EXISTS trg_chat_msg_update_conv ON public.chat_messages;
DROP TRIGGER IF EXISTS trg_chat_conv_updated_at ON public.chat_conversations;
DROP TRIGGER IF EXISTS trg_kb_sources_updated_at ON public.kb_sources;
DROP FUNCTION IF EXISTS public.chatbot_update_conversation_on_message();
DROP FUNCTION IF EXISTS public.chatbot_set_updated_at();
DROP FUNCTION IF EXISTS public.match_kb_chunks(vector, TEXT, FLOAT, INTEGER, TEXT);

-- Quitar columnas agregadas a leads
ALTER TABLE public.leads DROP COLUMN IF EXISTS chatbot_conversation_id;
ALTER TABLE public.leads DROP COLUMN IF EXISTS consent_text_version;
ALTER TABLE public.leads DROP COLUMN IF EXISTS consent_accepted_at;

-- Eliminar tablas (orden inverso por FKs)
DROP TABLE IF EXISTS public.kb_usage_log;
DROP TABLE IF EXISTS public.kb_chunks;
DROP TABLE IF EXISTS public.kb_documents;
DROP TABLE IF EXISTS public.kb_sources;
DROP TABLE IF EXISTS public.chat_messages;
DROP TABLE IF EXISTS public.chat_conversations;

-- Eliminar enums
DROP TYPE IF EXISTS chat_message_role;
DROP TYPE IF EXISTS chat_conversation_status;
DROP TYPE IF EXISTS kb_source_type;
DROP TYPE IF EXISTS kb_source_status;

-- Eliminar bucket
DELETE FROM storage.buckets WHERE id = 'chatbot-kb';
*/
