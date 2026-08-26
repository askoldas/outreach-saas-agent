import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig } from "./config";

const authRoutes = new Set(["/login", "/signup"]);
const protectedPrefixes = [
  "/dashboard",
  "/campaigns",
  "/leads",
  "/sequences",
  "/company-profile",
  "/usage",
  "/settings",
  "/help",
  "/onboarding",
  "/workspaces",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { publishableKey, url } = getSupabaseConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, options, value }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { pathname, search } = request.nextUrl;
  const isAuthRoute = authRoutes.has(pathname);
  const isProtectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";

    if (isProtectedRoute) {
      redirectUrl.searchParams.set("next", `${pathname}${search}`);
    }

    const recoveryResponse = isAuthRoute
      ? NextResponse.next({ request })
      : NextResponse.redirect(redirectUrl);

    request.cookies
      .getAll()
      .filter(({ name }) => name.startsWith("sb-") && name.includes("auth-token"))
      .forEach(({ name }) => recoveryResponse.cookies.set(name, "", { maxAge: 0, path: "/" }));

    return recoveryResponse;
  }

  if (!user && isProtectedRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/campaigns";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
