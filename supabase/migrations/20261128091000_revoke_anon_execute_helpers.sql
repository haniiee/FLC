-- Harden SECURITY DEFINER helpers used by RLS (applied on project gegmzokhmbxwjonyqmmz).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'can_access_chat_channel',
        'current_platform_role',
        'ensure_group_chat_channels',
        'handle_new_user',
        'is_admin',
        'is_group_member',
        'is_group_staff',
        'my_group_role',
        'sync_user_app_metadata'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      r.nspname,
      r.proname,
      r.args
    );
    IF r.proname IN ('handle_new_user', 'ensure_group_chat_channels', 'sync_user_app_metadata') THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
        r.nspname,
        r.proname,
        r.args
      );
    ELSE
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
        r.nspname,
        r.proname,
        r.args
      );
    END IF;
  END LOOP;
END $$;
