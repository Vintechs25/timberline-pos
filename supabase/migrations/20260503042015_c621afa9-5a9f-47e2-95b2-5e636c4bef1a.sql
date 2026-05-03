
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_by UUID,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS price_override BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_total NUMERIC;

CREATE INDEX IF NOT EXISTS idx_sales_business_created ON public.sales(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mpesa_business_created ON public.mpesa_transactions(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mpesa_branch_status ON public.mpesa_transactions(branch_id, status);

CREATE OR REPLACE FUNCTION public.refund_sale(_sale_id UUID, _reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sale RECORD;
  _item RECORD;
BEGIN
  SELECT * INTO _sale FROM public.sales WHERE id = _sale_id;
  IF _sale IS NULL THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF NOT (public.is_business_admin(auth.uid(), _sale.business_id) OR public.has_role(auth.uid(), 'system_owner')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _sale.status = 'refunded' THEN RAISE EXCEPTION 'Sale already refunded'; END IF;

  FOR _item IN SELECT * FROM public.sale_items WHERE sale_id = _sale_id LOOP
    IF _item.product_kind = 'hardware' AND _item.product_id IS NOT NULL THEN
      UPDATE public.hardware_products
        SET stock = stock + _item.quantity, updated_at = now()
        WHERE id = _item.product_id;
    ELSIF _item.product_kind = 'timber' AND _item.product_id IS NOT NULL THEN
      UPDATE public.timber_products
        SET pieces = pieces + COALESCE((_item.meta->>'pieces')::numeric, _item.quantity), updated_at = now()
        WHERE id = _item.product_id;
    END IF;
  END LOOP;

  IF _sale.customer_id IS NOT NULL AND _sale.status = 'credit' THEN
    UPDATE public.customers SET balance = balance - _sale.total, updated_at = now() WHERE id = _sale.customer_id;
  END IF;

  UPDATE public.sales SET status = 'refunded', refunded_at = now(), refunded_by = auth.uid(), refund_reason = _reason, updated_at = now() WHERE id = _sale_id;
END;
$$;

-- Add updated_at column if missing on sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
