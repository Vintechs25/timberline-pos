-- M-Pesa Daraja configuration per business (sensitive credentials)
CREATE TABLE IF NOT EXISTS public.mpesa_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  shortcode TEXT NOT NULL,
  passkey TEXT NOT NULL,
  consumer_key TEXT NOT NULL,
  consumer_secret TEXT NOT NULL,
  callback_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mpesa_configs ENABLE ROW LEVEL SECURITY;

-- ONLY system owners can access these credentials
CREATE POLICY "Only system owners read mpesa configs"
ON public.mpesa_configs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'system_owner'));

CREATE POLICY "Only system owners manage mpesa configs"
ON public.mpesa_configs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'system_owner'))
WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

CREATE TRIGGER mpesa_configs_touch
BEFORE UPDATE ON public.mpesa_configs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Safe function for business members to know if mpesa is available (no secrets returned)
CREATE OR REPLACE FUNCTION public.get_mpesa_status(_business_id UUID)
RETURNS TABLE(configured BOOLEAN, active BOOLEAN, environment TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS(SELECT 1 FROM public.mpesa_configs WHERE business_id = _business_id) AS configured,
    COALESCE((SELECT is_active FROM public.mpesa_configs WHERE business_id = _business_id), false) AS active,
    COALESCE((SELECT environment FROM public.mpesa_configs WHERE business_id = _business_id), 'sandbox') AS environment
  WHERE public.is_business_member(auth.uid(), _business_id) OR public.has_role(auth.uid(), 'system_owner');
$$;