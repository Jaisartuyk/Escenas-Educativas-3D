-- 0009_assignment_details.sql
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Agrega campos extra para el modal de detalle de actividad

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS due_time text DEFAULT '23:59';
