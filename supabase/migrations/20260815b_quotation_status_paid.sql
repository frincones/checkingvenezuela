-- =============================================
-- MIGRACIÓN: estado 'paid' en quotation_status
--
-- Va en un archivo APARTE a propósito: en PostgreSQL
-- `ALTER TYPE ... ADD VALUE` no puede ejecutarse dentro de un bloque de
-- transacción. Si se mezcla con otras sentencias, la migración falla con
-- "ALTER TYPE ... ADD cannot run inside a transaction block".
--
-- Por qué un estado nuevo y no reutilizar 'accepted':
--   'accepted'  = el cliente dijo que sí
--   'paid'      = el cliente pagó
-- Son cosas distintas y el negocio necesita distinguirlas.
--
-- Ejecutar SOLO este archivo, sin envolver en BEGIN/COMMIT.
-- =============================================

ALTER TYPE quotation_status ADD VALUE IF NOT EXISTS 'paid';
