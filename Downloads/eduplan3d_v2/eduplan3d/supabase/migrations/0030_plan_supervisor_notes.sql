-- Columna para que supervisores/admins dejen retroalimentación
-- por planificación. El docente la ve como lectura en su editor.
ALTER TABLE planificaciones_manuales
  ADD COLUMN IF NOT EXISTS supervisor_notes TEXT;
