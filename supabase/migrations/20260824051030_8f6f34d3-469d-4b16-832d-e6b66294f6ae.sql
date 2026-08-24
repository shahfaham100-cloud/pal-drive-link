ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planned';

ALTER TABLE public.runs DROP CONSTRAINT IF EXISTS runs_status_check;
ALTER TABLE public.runs ADD CONSTRAINT runs_status_check CHECK (status IN ('planned', 'approved', 'not_completed'));