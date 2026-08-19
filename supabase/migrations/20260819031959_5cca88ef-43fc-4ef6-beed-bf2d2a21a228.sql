ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS filters_no integer,
  ADD COLUMN IF NOT EXISTS job_details text;