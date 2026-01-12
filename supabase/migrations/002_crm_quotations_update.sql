-- =============================================
-- CHECK-IN VENEZUELA - CRM QUOTATIONS UPDATE
-- Make lead_id and advisor_id optional, add pdf_url and metadata
-- =============================================

-- Alter quotations table to make lead_id nullable
ALTER TABLE public.quotations ALTER COLUMN lead_id DROP NOT NULL;

-- Alter quotations table to make advisor_id nullable
ALTER TABLE public.quotations ALTER COLUMN advisor_id DROP NOT NULL;

-- Add pdf_url column to quotations
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Add metadata column to quotations for storing customer info when no lead
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- =============================================
-- STORAGE BUCKET FOR DOCUMENTS (PDFs)
-- =============================================

-- Create storage bucket for documents (quotation PDFs, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view public documents
CREATE POLICY "Public documents are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- Policy: Authenticated users can upload documents
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);

-- Policy: Authenticated users can update their documents
CREATE POLICY "Authenticated users can update documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);

-- Policy: Authenticated users can delete documents
CREATE POLICY "Authenticated users can delete documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);

-- =============================================
-- FIN DE LA MIGRACIÓN
-- =============================================
