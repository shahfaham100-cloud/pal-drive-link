CREATE OR REPLACE FUNCTION public.admin_create_driver(_email text, _password text, _full_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  _id uuid := gen_random_uuid();
  _em text := lower(btrim(_email));
  _name text := coalesce(nullif(btrim(_full_name), ''), lower(btrim(_email)));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the admin can manage drivers';
  END IF;
  IF _em IS NULL OR _em = '' OR _password IS NULL OR length(_password) < 6 THEN
    RAISE EXCEPTION 'Email and a password of at least 6 characters are required';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = _em) THEN
    RAISE EXCEPTION 'A user with this email already exists';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', _id, 'authenticated', 'authenticated', _em,
    extensions.crypt(_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', _name), now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (_id::text, _id,
    jsonb_build_object('sub', _id::text, 'email', _em, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now());

  INSERT INTO public.user_roles (user_id, role) VALUES (_id, 'driver') ON CONFLICT DO NOTHING;
  UPDATE public.profiles SET approved = true, full_name = _name, email = _em WHERE id = _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_driver(_id uuid, _email text, _full_name text, _password text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  _em text := lower(btrim(_email));
  _name text := btrim(coalesce(_full_name, ''));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the admin can manage drivers';
  END IF;
  IF public.has_role(_id, 'admin') THEN
    RAISE EXCEPTION 'The admin account cannot be edited here';
  END IF;
  IF _em IS NULL OR _em = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  IF _password IS NOT NULL AND _password <> '' AND length(_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = _em AND id <> _id) THEN
    RAISE EXCEPTION 'A user with this email already exists';
  END IF;

  UPDATE auth.users SET
    email = _em,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', _name),
    encrypted_password = CASE WHEN _password IS NOT NULL AND _password <> ''
      THEN extensions.crypt(_password, extensions.gen_salt('bf')) ELSE encrypted_password END,
    updated_at = now()
  WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Driver not found'; END IF;

  UPDATE auth.identities SET
    identity_data = identity_data || jsonb_build_object('email', _em),
    updated_at = now()
  WHERE user_id = _id AND provider = 'email';

  UPDATE public.profiles SET full_name = _name, email = _em WHERE id = _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_driver(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the admin can manage drivers';
  END IF;
  IF public.has_role(_id, 'admin') THEN
    RAISE EXCEPTION 'The admin account cannot be deleted';
  END IF;
  UPDATE public.vans SET driver_id = NULL WHERE driver_id = _id;
  DELETE FROM auth.users WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Driver not found'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_driver(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_driver(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_driver(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_driver(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_driver(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_driver(uuid) TO authenticated;