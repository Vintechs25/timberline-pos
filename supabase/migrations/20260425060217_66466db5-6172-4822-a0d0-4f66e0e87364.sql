CREATE OR REPLACE FUNCTION public.bootstrap_first_system_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'system_owner') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'system_owner')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_bootstrap_owner
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_system_owner();