-- Enum for application roles
CREATE TYPE public.app_role AS ENUM ('system_owner', 'business_admin', 'staff');

-- Enum for business status
CREATE TYPE public.business_status AS ENUM ('active', 'suspended', 'revoked');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Businesses
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status public.business_status NOT NULL DEFAULT 'active',
  license_key TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  license_expires_at TIMESTAMPTZ,
  features JSONB NOT NULL DEFAULT '{"timber": true, "hardware": true, "credit": true, "reports": true}'::jsonb,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Branches
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, code)
);

-- User roles (separate from profiles to avoid recursion attacks)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, business_id, branch_id)
);

-- Business users (convenience link)
CREATE TABLE public.business_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

-- Security definer role-check function (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Helper: is user a member of a business (any role)?
CREATE OR REPLACE FUNCTION public.is_business_member(_user_id UUID, _business_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_users
    WHERE user_id = _user_id AND business_id = _business_id
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND business_id = _business_id
  );
$$;

-- Helper: is user a business_admin for given business?
CREATE OR REPLACE FUNCTION public.is_business_admin(_user_id UUID, _business_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'business_admin'
      AND business_id = _business_id
  );
$$;

-- Auto profile creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER businesses_touch BEFORE UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users view own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id);
CREATE POLICY "System owners view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'system_owner'));

-- Businesses policies
CREATE POLICY "System owners manage businesses" ON public.businesses
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'system_owner'))
WITH CHECK (public.has_role(auth.uid(), 'system_owner'));
CREATE POLICY "Members view their business" ON public.businesses
FOR SELECT TO authenticated
USING (public.is_business_member(auth.uid(), id));
CREATE POLICY "Business admins update their business" ON public.businesses
FOR UPDATE TO authenticated
USING (public.is_business_admin(auth.uid(), id))
WITH CHECK (public.is_business_admin(auth.uid(), id));

-- Branches policies
CREATE POLICY "System owners manage all branches" ON public.branches
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'system_owner'))
WITH CHECK (public.has_role(auth.uid(), 'system_owner'));
CREATE POLICY "Members view branches in their business" ON public.branches
FOR SELECT TO authenticated
USING (public.is_business_member(auth.uid(), business_id));
CREATE POLICY "Business admins manage branches" ON public.branches
FOR ALL TO authenticated
USING (public.is_business_admin(auth.uid(), business_id))
WITH CHECK (public.is_business_admin(auth.uid(), business_id));

-- User roles policies
CREATE POLICY "Users view own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "System owners manage all roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'system_owner'))
WITH CHECK (public.has_role(auth.uid(), 'system_owner'));
CREATE POLICY "Business admins manage roles in their business" ON public.user_roles
FOR ALL TO authenticated
USING (business_id IS NOT NULL AND public.is_business_admin(auth.uid(), business_id))
WITH CHECK (business_id IS NOT NULL AND public.is_business_admin(auth.uid(), business_id));

-- Business users policies
CREATE POLICY "System owners manage all business_users" ON public.business_users
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'system_owner'))
WITH CHECK (public.has_role(auth.uid(), 'system_owner'));
CREATE POLICY "Members view business_users of their business" ON public.business_users
FOR SELECT TO authenticated
USING (public.is_business_member(auth.uid(), business_id));
CREATE POLICY "Business admins manage business_users" ON public.business_users
FOR ALL TO authenticated
USING (public.is_business_admin(auth.uid(), business_id))
WITH CHECK (public.is_business_admin(auth.uid(), business_id));

-- Indexes
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_business ON public.user_roles(business_id);
CREATE INDEX idx_branches_business ON public.branches(business_id);
CREATE INDEX idx_business_users_user ON public.business_users(user_id);
CREATE INDEX idx_business_users_business ON public.business_users(business_id);