import { createClient } from "@supabase/supabase-js";

export function createServiceRoleClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      [
        "Supabase worker access is not configured.",
        `Supabase URL: ${url ? "found" : "missing"}.`,
        `SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? "found" : "missing"}.`,
        "The worker cannot use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY because task claiming and cross-user background writes require the Supabase service_role key.",
      ].join(" "),
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
