-- Add configurable parciales count per institution
-- Default is 2 (standard Ecuador MINEDUC), some institutions use 3
ALTER TABLE schedule_configs
ADD COLUMN IF NOT EXISTS parciales_count integer NOT NULL DEFAULT 2;

NOTIFY pgrst, 'reload schema';
