-- Tabla para gestionar transmisiones temporales
CREATE TABLE IF NOT EXISTS streams (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES auth.users(id),
  viewers_count INTEGER DEFAULT 0
);

-- Índice para búsquedas rápidas
CREATE INDEX idx_streams_active ON streams(active);
CREATE INDEX idx_streams_user ON streams(user_id);

-- Habilitar Row Level Security
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver sus propias transmisiones
CREATE POLICY "Users can view own streams"
  ON streams FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Los usuarios pueden crear transmisiones
CREATE POLICY "Users can create streams"
  ON streams FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden actualizar sus transmisiones
CREATE POLICY "Users can update own streams"
  ON streams FOR UPDATE
  USING (auth.uid() = user_id);

-- Política: Cualquiera puede ver transmisiones activas (para espectadores)
CREATE POLICY "Anyone can view active streams"
  ON streams FOR SELECT
  USING (active = true);
