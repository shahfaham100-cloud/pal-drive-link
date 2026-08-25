ALTER TABLE public.schedule_entries ADD COLUMN IF NOT EXISTS driver_id uuid;

DROP POLICY IF EXISTS sched_driver_read ON public.schedule_entries;
CREATE POLICY sched_driver_read ON public.schedule_entries FOR SELECT TO authenticated
USING (
  driver_id = auth.uid()
  OR EXISTS (SELECT 1 FROM vans v WHERE v.id = schedule_entries.van_id AND v.driver_id = auth.uid())
);

DROP POLICY IF EXISTS sched_driver_update ON public.schedule_entries;
CREATE POLICY sched_driver_update ON public.schedule_entries FOR UPDATE TO authenticated
USING (
  driver_id = auth.uid()
  OR EXISTS (SELECT 1 FROM vans v WHERE v.id = schedule_entries.van_id AND v.driver_id = auth.uid())
)
WITH CHECK (
  driver_id = auth.uid()
  OR EXISTS (SELECT 1 FROM vans v WHERE v.id = schedule_entries.van_id AND v.driver_id = auth.uid())
);