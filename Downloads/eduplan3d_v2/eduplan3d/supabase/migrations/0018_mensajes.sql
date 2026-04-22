-- 0018_mensajes.sql
-- Módulo de comunicaciones: mensajería directa tutor↔representante (cuenta del
-- estudiante) + boletines con acuse de lectura.
--
-- Modelo:
--   conversations           — hilo (directo 1-1 o boletín broadcast)
--   conversation_participants — quién ve el hilo y desde cuándo leyó por última vez
--   messages                — mensajes del hilo
--   message_read_receipts   — acuses "Recibido ✓" para boletines con requiresAck
--
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- ── 1. conversations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  type             text NOT NULL CHECK (type IN ('direct','bulletin')),
  title            text,                          -- para boletines, opcional en directos
  course_id        uuid REFERENCES courses(id) ON DELETE SET NULL,  -- para boletines del curso
  student_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,  -- para directos: sobre qué estudiante
  created_by       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at  timestamptz,
  last_message_preview text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_institution ON conversations(institution_id);
CREATE INDEX IF NOT EXISTS idx_conv_course      ON conversations(course_id);
CREATE INDEX IF NOT EXISTS idx_conv_student     ON conversations(student_id);
CREATE INDEX IF NOT EXISTS idx_conv_last_msg    ON conversations(last_message_at DESC NULLS LAST);

-- ── 2. conversation_participants ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('student','tutor','admin')),
  last_read_at    timestamptz,
  muted           boolean NOT NULL DEFAULT false,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cp_user ON conversation_participants(user_id);

-- ── 3. messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body             text NOT NULL,
  kind             text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','bulletin','system')),
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- metadata para boletines: {category:'academico'|'administrativo'|'evento'|'urgente', requiresAck:true}
  created_at       timestamptz NOT NULL DEFAULT now(),
  edited_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_msg_conv_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msg_sender       ON messages(sender_id);

-- ── 4. message_read_receipts ────────────────────────────────────────────────
-- Para boletines con requiresAck: registra el "Recibido ✓" del receptor.
CREATE TABLE IF NOT EXISTS message_read_receipts (
  message_id       uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  acknowledged_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- ── 5. Trigger: actualizar last_message_* en conversations al insertar un msg
CREATE OR REPLACE FUNCTION bump_conversation_on_message() RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
     SET last_message_at = NEW.created_at,
         last_message_preview = LEFT(NEW.body, 200)
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bump_conversation ON messages;
CREATE TRIGGER trg_bump_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE PROCEDURE bump_conversation_on_message();

-- ── 6. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE conversations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_receipts      ENABLE ROW LEVEL SECURITY;

-- Conversaciones: visibles para sus participantes
DROP POLICY IF EXISTS p_conv_select ON conversations;
CREATE POLICY p_conv_select ON conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid())
  );

-- Participantes: un usuario puede verse a sí mismo y a los demás participantes de sus hilos
DROP POLICY IF EXISTS p_cp_select ON conversation_participants;
CREATE POLICY p_cp_select ON conversation_participants
  FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM conversation_participants self
      WHERE self.conversation_id = conversation_participants.conversation_id
        AND self.user_id = auth.uid()
    )
  );

-- Mensajes: visibles si el usuario es participante del hilo
DROP POLICY IF EXISTS p_msg_select ON messages;
CREATE POLICY p_msg_select ON messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid())
  );

-- Receipts: el usuario ve los suyos, y el remitente del msg ve todos
DROP POLICY IF EXISTS p_rr_select ON message_read_receipts;
CREATE POLICY p_rr_select ON message_read_receipts
  FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_read_receipts.message_id AND m.sender_id = auth.uid()
    )
  );

-- Inserts/updates los manejan las API routes con service role → no hace falta policy pública.
