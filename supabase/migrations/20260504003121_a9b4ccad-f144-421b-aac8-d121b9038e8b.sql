
CREATE OR REPLACE FUNCTION public.create_sale(
  _business_id uuid,
  _branch_id uuid,
  _customer_id uuid,
  _customer_name text,
  _subtotal numeric,
  _discount numeric,
  _total numeric,
  _payment_method text,
  _status text,
  _price_override boolean,
  _original_total numeric,
  _items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sale_id uuid;
  _item jsonb;
  _kind text;
  _pid uuid;
  _qty numeric;
  _pieces numeric;
BEGIN
  IF NOT (public.user_can_access_branch(auth.uid(), _branch_id, _business_id)) THEN
    RAISE EXCEPTION 'Not authorized for this branch';
  END IF;
  IF NOT public.is_business_license_valid(_business_id) THEN
    RAISE EXCEPTION 'License not valid';
  END IF;

  INSERT INTO public.sales (
    business_id, branch_id, customer_id, customer_name, cashier_id,
    receipt_no, subtotal, discount, total, payment_method, status,
    price_override, original_total
  ) VALUES (
    _business_id, _branch_id, _customer_id, _customer_name, auth.uid(),
    'R-' || to_char(now(),'YYMMDDHH24MISS') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,4),
    _subtotal, _discount, _total, _payment_method, _status,
    COALESCE(_price_override,false), _original_total
  ) RETURNING id INTO _sale_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _kind := _item->>'product_kind';
    _pid := NULLIF(_item->>'product_id','')::uuid;
    _qty := COALESCE((_item->>'quantity')::numeric, 0);
    _pieces := COALESCE((_item->'meta'->>'pieces')::numeric, _qty);

    INSERT INTO public.sale_items (sale_id, product_kind, product_id, description, quantity, unit_price, total, meta)
    VALUES (
      _sale_id, _kind, _pid,
      _item->>'description',
      _qty,
      COALESCE((_item->>'unit_price')::numeric, 0),
      COALESCE((_item->>'total')::numeric, 0),
      COALESCE(_item->'meta','{}'::jsonb)
    );

    IF _kind = 'hardware' AND _pid IS NOT NULL THEN
      UPDATE public.hardware_products SET stock = GREATEST(0, stock - _qty), updated_at = now()
        WHERE id = _pid AND business_id = _business_id;
    ELSIF _kind = 'timber' AND _pid IS NOT NULL THEN
      UPDATE public.timber_products SET pieces = GREATEST(0, pieces - _pieces), updated_at = now()
        WHERE id = _pid AND business_id = _business_id;
    END IF;
  END LOOP;

  IF _customer_id IS NOT NULL AND _payment_method = 'credit' THEN
    UPDATE public.customers SET balance = balance + _total, updated_at = now() WHERE id = _customer_id;
  END IF;

  RETURN _sale_id;
END;
$$;
