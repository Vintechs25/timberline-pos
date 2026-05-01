-- =========================================
-- SUPPLIERS
-- =========================================
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  balance NUMERIC NOT NULL DEFAULT 0, -- amount we owe supplier
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View suppliers in business" ON public.suppliers
  FOR SELECT TO authenticated USING (public.is_business_member(auth.uid(), business_id));
CREATE POLICY "Admins manage suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.is_business_admin(auth.uid(), business_id))
  WITH CHECK (public.is_business_admin(auth.uid(), business_id) AND public.is_business_license_valid(business_id));
CREATE POLICY "System owners manage all suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

CREATE TRIGGER touch_suppliers BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- SUPPLIER PAYMENTS (history of payments to suppliers)
-- =========================================
CREATE TABLE public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  branch_id UUID,
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  paid_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View supplier payments" ON public.supplier_payments
  FOR SELECT TO authenticated USING (public.is_business_member(auth.uid(), business_id));
CREATE POLICY "Admins manage supplier payments" ON public.supplier_payments
  FOR ALL TO authenticated
  USING (public.is_business_admin(auth.uid(), business_id))
  WITH CHECK (public.is_business_admin(auth.uid(), business_id) AND public.is_business_license_valid(business_id));
CREATE POLICY "System owners manage all supplier payments" ON public.supplier_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

-- =========================================
-- PURCHASE ORDERS
-- =========================================
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  po_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, ordered, received, partial, cancelled
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  ordered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View POs in accessible branch" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (public.user_can_access_branch(auth.uid(), branch_id, business_id));
CREATE POLICY "Admins manage POs" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (public.is_business_admin(auth.uid(), business_id))
  WITH CHECK (public.is_business_admin(auth.uid(), business_id) AND public.is_business_license_valid(business_id));
CREATE POLICY "System owners manage all POs" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

CREATE TRIGGER touch_pos BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- PURCHASE ORDER ITEMS
-- =========================================
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_kind TEXT NOT NULL, -- 'hardware' | 'timber' | 'other'
  product_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  received_qty NUMERIC NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View PO items via parent" ON public.purchase_order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
      AND public.user_can_access_branch(auth.uid(), po.branch_id, po.business_id)
  ));
CREATE POLICY "Admins manage PO items" ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
      AND public.is_business_admin(auth.uid(), po.business_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
      AND public.is_business_admin(auth.uid(), po.business_id)
      AND public.is_business_license_valid(po.business_id)
  ));
CREATE POLICY "System owners manage all PO items" ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

-- =========================================
-- CUSTOMER REQUESTS (out-of-stock asks)
-- =========================================
CREATE TABLE public.customer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  customer_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, ordered, fulfilled, cancelled
  recorded_by UUID,
  notes TEXT,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View requests in accessible branch" ON public.customer_requests
  FOR SELECT TO authenticated
  USING (public.user_can_access_branch(auth.uid(), branch_id, business_id));
CREATE POLICY "Members create requests (license required)" ON public.customer_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_branch(auth.uid(), branch_id, business_id) AND public.is_business_license_valid(business_id));
CREATE POLICY "Members update requests in branch" ON public.customer_requests
  FOR UPDATE TO authenticated
  USING (public.user_can_access_branch(auth.uid(), branch_id, business_id))
  WITH CHECK (public.is_business_license_valid(business_id));
CREATE POLICY "Admins delete requests" ON public.customer_requests
  FOR DELETE TO authenticated
  USING (public.is_business_admin(auth.uid(), business_id));
CREATE POLICY "System owners manage all requests" ON public.customer_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

CREATE TRIGGER touch_requests BEFORE UPDATE ON public.customer_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- M-PESA TRANSACTIONS
-- =========================================
CREATE TABLE public.mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  sale_id UUID,
  checkout_request_id TEXT UNIQUE,
  merchant_request_id TEXT,
  phone TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, success, failed, cancelled
  result_code INTEGER,
  result_desc TEXT,
  mpesa_receipt TEXT,
  raw_callback JSONB,
  initiated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View mpesa in accessible branch" ON public.mpesa_transactions
  FOR SELECT TO authenticated
  USING (public.user_can_access_branch(auth.uid(), branch_id, business_id));
CREATE POLICY "Members create mpesa (license required)" ON public.mpesa_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_branch(auth.uid(), branch_id, business_id) AND public.is_business_license_valid(business_id));
CREATE POLICY "Admins update/delete mpesa" ON public.mpesa_transactions
  FOR UPDATE TO authenticated
  USING (public.is_business_admin(auth.uid(), business_id));
CREATE POLICY "System owners manage all mpesa" ON public.mpesa_transactions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

CREATE INDEX idx_mpesa_checkout ON public.mpesa_transactions(checkout_request_id);
CREATE INDEX idx_mpesa_sale ON public.mpesa_transactions(sale_id);

CREATE TRIGGER touch_mpesa BEFORE UPDATE ON public.mpesa_transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- INDEXES
-- =========================================
CREATE INDEX idx_suppliers_business ON public.suppliers(business_id);
CREATE INDEX idx_supplier_payments_supplier ON public.supplier_payments(supplier_id);
CREATE INDEX idx_pos_branch ON public.purchase_orders(branch_id);
CREATE INDEX idx_pos_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_po_items_po ON public.purchase_order_items(purchase_order_id);
CREATE INDEX idx_requests_branch ON public.customer_requests(branch_id);
CREATE INDEX idx_sales_branch_created ON public.sales(branch_id, created_at DESC);

-- =========================================
-- REALTIME PUBLICATION
-- =========================================
ALTER TABLE public.hardware_products REPLICA IDENTITY FULL;
ALTER TABLE public.timber_products REPLICA IDENTITY FULL;
ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.sale_items REPLICA IDENTITY FULL;
ALTER TABLE public.customers REPLICA IDENTITY FULL;
ALTER TABLE public.customer_requests REPLICA IDENTITY FULL;
ALTER TABLE public.suppliers REPLICA IDENTITY FULL;
ALTER TABLE public.purchase_orders REPLICA IDENTITY FULL;
ALTER TABLE public.mpesa_transactions REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.hardware_products,
  public.timber_products,
  public.sales,
  public.sale_items,
  public.customers,
  public.customer_requests,
  public.suppliers,
  public.purchase_orders,
  public.mpesa_transactions;

-- =========================================
-- HELPER: receive PO -> increment stock + update supplier balance
-- =========================================
CREATE OR REPLACE FUNCTION public.receive_purchase_order(_po_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _po RECORD;
  _item RECORD;
BEGIN
  SELECT * INTO _po FROM public.purchase_orders WHERE id = _po_id;
  IF _po IS NULL THEN RAISE EXCEPTION 'PO not found'; END IF;

  -- Authorization
  IF NOT (public.is_business_admin(auth.uid(), _po.business_id) OR public.has_role(auth.uid(), 'system_owner')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR _item IN SELECT * FROM public.purchase_order_items WHERE purchase_order_id = _po_id LOOP
    IF _item.product_kind = 'hardware' AND _item.product_id IS NOT NULL THEN
      UPDATE public.hardware_products
        SET stock = stock + (_item.quantity - _item.received_qty),
            updated_at = now()
        WHERE id = _item.product_id;
    ELSIF _item.product_kind = 'timber' AND _item.product_id IS NOT NULL THEN
      UPDATE public.timber_products
        SET pieces = pieces + (_item.quantity - _item.received_qty),
            updated_at = now()
        WHERE id = _item.product_id;
    END IF;
    UPDATE public.purchase_order_items SET received_qty = quantity WHERE id = _item.id;
  END LOOP;

  -- Add PO total minus already paid to supplier balance
  UPDATE public.suppliers
    SET balance = balance + (_po.total - _po.amount_paid),
        updated_at = now()
    WHERE id = _po.supplier_id;

  UPDATE public.purchase_orders
    SET status = 'received', received_at = now(), updated_at = now()
    WHERE id = _po_id;
END;
$$;

-- =========================================
-- HELPER: pay supplier -> decrement balance
-- =========================================
CREATE OR REPLACE FUNCTION public.pay_supplier(
  _supplier_id UUID,
  _amount NUMERIC,
  _method TEXT,
  _reference TEXT,
  _notes TEXT,
  _branch_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bid UUID;
  _payment_id UUID;
BEGIN
  SELECT business_id INTO _bid FROM public.suppliers WHERE id = _supplier_id;
  IF _bid IS NULL THEN RAISE EXCEPTION 'Supplier not found'; END IF;

  IF NOT (public.is_business_admin(auth.uid(), _bid) OR public.has_role(auth.uid(), 'system_owner')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.supplier_payments (business_id, supplier_id, branch_id, amount, method, reference, notes, paid_by)
  VALUES (_bid, _supplier_id, _branch_id, _amount, COALESCE(_method,'cash'), _reference, _notes, auth.uid())
  RETURNING id INTO _payment_id;

  UPDATE public.suppliers
    SET balance = balance - _amount, updated_at = now()
    WHERE id = _supplier_id;

  RETURN _payment_id;
END;
$$;