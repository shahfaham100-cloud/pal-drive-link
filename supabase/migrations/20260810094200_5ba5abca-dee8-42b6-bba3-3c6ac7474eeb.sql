ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS suburb text;

UPDATE public.clients
SET suburb = NULLIF(btrim(split_part(address, ',', 2)), '')
WHERE suburb IS NULL AND address IS NOT NULL AND position(',' in address) > 0;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS finalized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalized_by uuid,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_amount numeric,
  ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual boolean NOT NULL DEFAULT false;

CREATE TABLE public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL,
  run_number integer NOT NULL,
  van_id uuid REFERENCES public.vans(id) ON DELETE SET NULL,
  driver_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT runs_number_range CHECK (run_number BETWEEN 1 AND 4),
  CONSTRAINT runs_date_number_unique UNIQUE (run_date, run_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.runs TO authenticated;
GRANT ALL ON public.runs TO service_role;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY runs_admin_all ON public.runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY runs_driver_read ON public.runs FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR EXISTS (SELECT 1 FROM public.vans v WHERE v.id = runs.van_id AND v.driver_id = auth.uid()));

CREATE TRIGGER runs_updated_at BEFORE UPDATE ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  van_id uuid REFERENCES public.vans(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned',
  notes text,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_entries_status_check CHECK (status IN ('planned','completed','missed','cancelled')),
  CONSTRAINT schedule_entries_unique UNIQUE (client_id, scheduled_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_entries TO authenticated;
GRANT ALL ON public.schedule_entries TO service_role;
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY sched_admin_all ON public.schedule_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY sched_driver_read ON public.schedule_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vans v WHERE v.id = schedule_entries.van_id AND v.driver_id = auth.uid()));
CREATE POLICY sched_driver_update ON public.schedule_entries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vans v WHERE v.id = schedule_entries.van_id AND v.driver_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vans v WHERE v.id = schedule_entries.van_id AND v.driver_id = auth.uid()));

CREATE TRIGGER schedule_entries_updated_at BEFORE UPDATE ON public.schedule_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX schedule_entries_date_idx ON public.schedule_entries (scheduled_date);
CREATE INDEX runs_date_idx ON public.runs (run_date);