CREATE POLICY "job_photos_admin_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'job-photos' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'job-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "job_photos_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "job_photos_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "job_photos_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = auth.uid()::text);