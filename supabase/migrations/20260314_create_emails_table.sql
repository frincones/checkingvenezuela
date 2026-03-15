-- Tabla de emails para módulo de correo integrado
CREATE TABLE IF NOT EXISTS emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resend_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  folder TEXT DEFAULT 'inbox' CHECK (folder IN ('inbox', 'sent', 'drafts', 'trash', 'archive')),
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails JSONB NOT NULL DEFAULT '[]',
  cc JSONB DEFAULT '[]',
  bcc JSONB DEFAULT '[]',
  reply_to TEXT,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  attachments JSONB DEFAULT '[]',
  status TEXT DEFAULT 'delivered' CHECK (status IN ('delivered', 'sent', 'draft', 'failed', 'bounced', 'opened')),
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  thread_id UUID,
  in_reply_to TEXT,
  message_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_direction ON emails(direction);
CREATE INDEX IF NOT EXISTS idx_emails_created ON emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_is_read ON emails(is_read);
CREATE INDEX IF NOT EXISTS idx_emails_resend_id ON emails(resend_id);
