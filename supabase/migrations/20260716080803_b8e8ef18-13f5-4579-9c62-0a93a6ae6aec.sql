
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'driver');
CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.frequency_type AS ENUM ('weekly', 'fortnightly', '3weekly', 'monthly', '6weekly', '2monthly', '3monthly', 'oncall', 'custom');
CREATE TYPE public.job_status AS ENUM ('completed', 'missed');

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User Roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- has_role helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Admins can read all profiles and roles
CREATE POLICY "profiles_admin_all" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Vans
CREATE TABLE public.vans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vans TO authenticated;
GRANT ALL ON public.vans TO service_role;
ALTER TABLE public.vans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vans_admin_all" ON public.vans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "vans_driver_read" ON public.vans FOR SELECT TO authenticated USING (driver_id = auth.uid());

-- Filter Categories (preset + custom)
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_read_all" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_admin_write" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.categories (key, label, color) VALUES
  ('standard_a', 'Standard A', '#3b82f6'),
  ('standard_b', 'Standard B', '#eab308'),
  ('standard_c', 'Standard C', '#10b981'),
  ('standard_d', 'Standard D', '#f97316'),
  ('standard_cd', 'Standard C/D', '#8b5cf6'),
  ('square_500a', 'Square 500A', '#ec4899'),
  ('square_500b', 'Square 500B', '#06b6d4'),
  ('clips', 'Clips', '#facc15');

-- Clients
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  time_notes text,
  comments text,
  priority public.priority_level NOT NULL DEFAULT 'medium',
  frequency public.frequency_type NOT NULL DEFAULT 'weekly',
  custom_frequency_days integer,
  custom_frequency_label text,
  van_id uuid REFERENCES public.vans(id) ON DELETE SET NULL,
  next_service_date date NOT NULL DEFAULT CURRENT_DATE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_admin_all" ON public.clients FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "clients_driver_read" ON public.clients FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vans v WHERE v.id = clients.van_id AND v.driver_id = auth.uid())
);
CREATE POLICY "clients_driver_update" ON public.clients FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vans v WHERE v.id = clients.van_id AND v.driver_id = auth.uid())
);

-- Client Categories (filters per client)
CREATE TABLE public.client_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  UNIQUE (client_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_categories TO authenticated;
GRANT ALL ON public.client_categories TO service_role;
ALTER TABLE public.client_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_admin_all" ON public.client_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cc_driver_read" ON public.client_categories FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.clients c JOIN public.vans v ON v.id = c.van_id WHERE c.id = client_categories.client_id AND v.driver_id = auth.uid())
);

-- Service Pauses
CREATE TABLE public.service_pauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_pauses TO authenticated;
GRANT ALL ON public.service_pauses TO service_role;
ALTER TABLE public.service_pauses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pauses_admin_all" ON public.service_pauses FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pauses_driver_read" ON public.service_pauses FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.clients c JOIN public.vans v ON v.id = c.van_id WHERE c.id = service_pauses.client_id AND v.driver_id = auth.uid())
);

-- Jobs (history)
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  van_id uuid REFERENCES public.vans(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  completed_at timestamptz,
  status public.job_status NOT NULL,
  payment_amount numeric(10,2),
  comments text,
  driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_client_idx ON public.jobs(client_id);
CREATE INDEX jobs_scheduled_idx ON public.jobs(scheduled_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_admin_all" ON public.jobs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "jobs_driver_read" ON public.jobs FOR SELECT TO authenticated USING (
  driver_id = auth.uid() OR EXISTS (SELECT 1 FROM public.vans v WHERE v.id = jobs.van_id AND v.driver_id = auth.uid())
);
CREATE POLICY "jobs_driver_insert" ON public.jobs FOR INSERT TO authenticated WITH CHECK (
  driver_id = auth.uid() AND EXISTS (SELECT 1 FROM public.vans v WHERE v.id = jobs.van_id AND v.driver_id = auth.uid())
);

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
