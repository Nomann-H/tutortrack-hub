REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ensure_profile(TEXT) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.protect_last_super_admin() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, public;