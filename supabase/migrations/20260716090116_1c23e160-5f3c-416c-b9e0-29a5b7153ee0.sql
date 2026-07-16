-- Allow drivers to self-assign the driver role on signup (RLS was blocking client-side insert)
CREATE POLICY "user_roles_self_insert_driver"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND role = 'driver');