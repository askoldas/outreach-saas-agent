-- The native Company Intelligence constructor hashes its frozen source set
-- with pgcrypto. Supabase installs pgcrypto functions in the extensions schema.

alter function public.create_native_company_profile_v3_draft(
  uuid, text, jsonb, uuid
)
set search_path = public, extensions;
