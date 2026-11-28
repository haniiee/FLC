-- FLC Supabase-native: document applied RLS helpers (already live on project gegmzokhmbxwjonyqmmz).
-- Applied remotely as: supabase_native_auth_rls_storage, fix_auth_email_phone_bridge,
-- seed_auth_users_phone_bridge, revoke_anon_execute_on_security_definer_helpers.
-- Do not re-run blindly against an empty DB; use apps/api/drizzle first for schema.

-- Realtime publication (idempotent)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
