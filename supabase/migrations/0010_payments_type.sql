-- Add type column to distinguish matrícula vs pensión
ALTER TABLE payments ADD COLUMN IF NOT EXISTS type text DEFAULT 'pension'
  CHECK (type IN ('matricula', 'pension', 'otro'));
