"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  error?: string;
}

/**
 * Where a successful sign-in lands. Only ever a path on this site: `next`
 * arrives in the URL, so an absolute one would be an open redirect — somewhere
 * to send a tenant after they have typed their code.
 */
function safeNext(raw: FormDataEntryValue | null): string {
  const next = String(raw ?? "/");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function email(raw: FormDataEntryValue | null): string {
  return String(raw ?? "").trim().toLowerCase();
}

/**
 * Email + password. Kept as the second way in, not the first.
 *
 * Staff have passwords and are used to them, and it is the fallback for the
 * evening the mail provider is having a bad time. Tenants are not expected to
 * come this way.
 */
export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const address = email(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!address || !password) {
    return { error: "Enter both your email address and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: address,
    password,
  });

  if (error) {
    // Deliberately vague: distinguishing "wrong password" from "no such user"
    // tells an attacker which addresses are real.
    return { error: "Those details do not match an account." };
  }

  redirect(safeNext(formData.get("next")));
}

export interface CodeState {
  error?: string;
  /** Set once a code has gone out, which is what moves the form to step two. */
  sent?: boolean;
  /** Echoed back so step two can verify against the address step one used. */
  email?: string;
}

/**
 * Step one: ask Supabase to email a six-digit code.
 *
 * `shouldCreateUser: false` is the important line. Without it, typing any
 * address at all creates an account for it, and the sign-in page becomes a
 * public sign-up page for a system that holds other people's tenancies.
 *
 * The answer is the same whether or not the address is known, for the reason
 * given on the password branch above. That does cost a tenant who mistypes
 * their address a minute of waiting for a code that is not coming, which is
 * why the screen that follows says so and offers the way back.
 */
export async function requestCode(
  _prev: CodeState,
  formData: FormData,
): Promise<CodeState> {
  const address = email(formData.get("email"));
  if (!address) return { error: "Enter your email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: { shouldCreateUser: false },
  });

  // A rate limit is worth saying out loud: it is the one failure where
  // waiting for the email is genuinely pointless, and it reveals nothing
  // about whether the address exists.
  if (error && /rate limit|too many/i.test(error.message)) {
    return {
      error:
        "Too many codes requested. Wait a few minutes and try again, or call the office.",
    };
  }

  return { sent: true, email: address };
}

/**
 * Step two: exchange the code for a session.
 *
 * `type: "email"` is the one-time password sent by signInWithOtp above.
 */
export async function verifyCode(
  _prev: CodeState,
  formData: FormData,
): Promise<CodeState> {
  const address = email(formData.get("email"));
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");

  if (!address) return { error: "Start again and enter your email address." };
  if (token.length !== 6) {
    return { sent: true, email: address, error: "Enter the six digits from the email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: address,
    token,
    type: "email",
  });

  if (error) {
    return {
      sent: true,
      email: address,
      error: "That code is wrong or has expired. Ask for a new one.",
    };
  }

  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
