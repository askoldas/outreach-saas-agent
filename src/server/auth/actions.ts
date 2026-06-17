"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signInAction(formData: FormData) {
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  const next = getSafeNext(getString(formData, "next"));

  if (!emailPattern.test(email) || password.length < 6) {
    redirect(
      `/auth/sign-in?error=${encodeURIComponent("Enter a valid email and password.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/auth/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect(next);
}

export async function signUpAction(formData: FormData) {
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  const confirmPassword = getString(formData, "confirmPassword");

  if (!emailPattern.test(email)) {
    redirect(`/auth/sign-up?error=${encodeURIComponent("Enter a valid email address.")}`);
  }

  if (password.length < 6 || password !== confirmPassword) {
    redirect(
      `/auth/sign-up?error=${encodeURIComponent(
        "Passwords must match and contain at least 6 characters.",
      )}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/auth/sign-up?error=${encodeURIComponent(error.message)}`);
  }

  redirect(
    `/auth/sign-in?message=${encodeURIComponent(
      "Account created. Check your email if confirmation is enabled, then sign in.",
    )}`,
  );
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getSafeNext(next: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}
