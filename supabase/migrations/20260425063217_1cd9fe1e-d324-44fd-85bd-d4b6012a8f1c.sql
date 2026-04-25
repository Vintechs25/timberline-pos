
-- 1. Expand role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cashier';

-- 2. License validity helper
CREATE OR REPLACE FUNCTION public.is_business_license_valid(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = _business_id
      AND status = 'active'
      AND (license_expires_at IS NULL OR license_expires_at > now())
  );
$$;

-- 3. Branch access helper
CREATE OR REPLACE FUNCTION public.user_can_access_branch(_user_id uuid, _branch_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'system_owner')
    OR public.is_business_admin(_user_id, _business_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND business_id = _business_id
        AND (branch_id IS NULL OR branch_id = _branch_id)
    );
$$;

-- 4. Hardware inventory (per-branch)
CREATE TABLE IF NOT EXISTS public.hardware_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  category text,
  unit text NOT NULL DEFAULT 'pcs',
  price numeric(12,2) NOT NULL DEFAULT 0,
  cost numeric(12,2) NOT NULL DEFAULT 0,
  stock numeric(12,2) NOT NULL DEFAULT 0,
  low_stock_threshold numeric(12,2) NOT NULL DEFAULT 5,
  supplier text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hardware_branch ON public.hardware_products(branch_id);
CREATE INDEX IF NOT EXISTS idx_hardware_business ON public.hardware_products(business_id);
ALTER TABLE public.hardware_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View hardware in accessible branches"
  ON public.hardware_products FOR SELECT TO authenticated
  USING (public.user_can_access_branch(auth.uid(), branch_id, business_id));

CREATE POLICY "Admins manage hardware (license required)"
  ON public.hardware_products FOR ALL TO authenticated
  USING (public.is_business_admin(auth.uid(), business_id))
  WITH CHECK (public.is_business_admin(auth.uid(), business_id) AND public.is_business_license_valid(business_id));

CREATE POLICY "System owners manage all hardware"
  ON public.hardware_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

-- 5. Timber inventory (per-branch)
CREATE TABLE IF NOT EXISTS public.timber_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  species text NOT NULL,
  grade text,
  thickness numeric(8,2) NOT NULL,
  width numeric(8,2) NOT NULL,
  length numeric(8,2) NOT NULL,
  dim_unit text NOT NULL DEFAULT 'in',
  length_unit text NOT NULL DEFAULT 'ft',
  price_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  price_unit text NOT NULL DEFAULT 'piece',
  pieces numeric(12,2) NOT NULL DEFAULT 0,
  low_stock_threshold numeric(12,2) NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_timber_branch ON public.timber_products(branch_id);
ALTER TABLE public.timber_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View timber in accessible branches"
  ON public.timber_products FOR SELECT TO authenticated
  USING (public.user_can_access_branch(auth.uid(), branch_id, business_id));

CREATE POLICY "Admins manage timber (license required)"
  ON public.timber_products FOR ALL TO authenticated
  USING (public.is_business_admin(auth.uid(), business_id))
  WITH CHECK (public.is_business_admin(auth.uid(), business_id) AND public.is_business_license_valid(business_id));

CREATE POLICY "System owners manage all timber"
  ON public.timber_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

-- 6. Customers (per-business, shared across branches)
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  type text NOT NULL DEFAULT 'walkin',
  credit_limit numeric(12,2) NOT NULL DEFAULT 0,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  loyalty_discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_business ON public.customers(business_id);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view customers"
  ON public.customers FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id));

CREATE POLICY "Members manage customers (license required)"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_business_member(auth.uid(), business_id) AND public.is_business_license_valid(business_id));

CREATE POLICY "Members update customers (license required)"
  ON public.customers FOR UPDATE TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_license_valid(business_id));

CREATE POLICY "Admins delete customers"
  ON public.customers FOR DELETE TO authenticated
  USING (public.is_business_admin(auth.uid(), business_id));

CREATE POLICY "System owners manage all customers"
  ON public.customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

-- 7. Sales (per-branch)
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  cashier_id uuid,
  receipt_no text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  status text NOT NULL DEFAULT 'paid',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON public.sales(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_business ON public.sales(business_id, created_at DESC);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View sales in accessible branches"
  ON public.sales FOR SELECT TO authenticated
  USING (public.user_can_access_branch(auth.uid(), branch_id, business_id));

CREATE POLICY "Members create sales (license required)"
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_access_branch(auth.uid(), branch_id, business_id)
    AND public.is_business_license_valid(business_id)
  );

CREATE POLICY "Admins update/delete sales"
  ON public.sales FOR UPDATE TO authenticated
  USING (public.is_business_admin(auth.uid(), business_id));

CREATE POLICY "System owners manage all sales"
  ON public.sales FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

-- 8. Sale items
CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_kind text NOT NULL,
  product_id uuid,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View sale items via parent sale"
  ON public.sale_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id
      AND public.user_can_access_branch(auth.uid(), s.branch_id, s.business_id)
  ));

CREATE POLICY "Insert sale items via parent sale"
  ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id
      AND public.user_can_access_branch(auth.uid(), s.branch_id, s.business_id)
      AND public.is_business_license_valid(s.business_id)
  ));

CREATE POLICY "System owners manage all sale items"
  ON public.sale_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

-- 9. updated_at triggers
CREATE TRIGGER trg_hardware_updated BEFORE UPDATE ON public.hardware_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_timber_updated BEFORE UPDATE ON public.timber_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
