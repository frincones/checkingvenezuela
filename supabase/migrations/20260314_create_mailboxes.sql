-- Buzones de email
CREATE TABLE IF NOT EXISTS mailboxes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agregar columna mailbox_id a emails
ALTER TABLE emails ADD COLUMN IF NOT EXISTS mailbox_id UUID REFERENCES mailboxes(id);
CREATE INDEX IF NOT EXISTS idx_emails_mailbox ON emails(mailbox_id);

-- Seed: buzones iniciales
INSERT INTO mailboxes (address, name, display_name) VALUES
  ('ventas@venezuelavoyages.com', 'Ventas', 'Venezuela Voyages - Ventas'),
  ('info@venezuelavoyages.com', 'Info', 'Venezuela Voyages'),
  ('reservas@venezuelavoyages.com', 'Reservas', 'Venezuela Voyages - Reservas'),
  ('m.sanchez@venezuelavoyages.com', 'M. Sanchez', 'M. Sanchez - Venezuela Voyages')
ON CONFLICT (address) DO NOTHING;
