import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

export async function createClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getSupabaseConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Middleware refresh handles session writes.
        }
      },
    },
  });
}

export async function createAuthenticatedDatabaseClient() {
  const cookieClient = await createClient();
  const {
    data: { user },
    error: userError,
  } = await cookieClient.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required");
  }

  const {
    data: { session },
    error: sessionError,
  } = await cookieClient.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error("Authentication session is missing");
  }

  const { publishableKey, url } = getSupabaseConfig();

  return {
    supabase: createSupabaseClient(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    }),
    user,
  };
}
