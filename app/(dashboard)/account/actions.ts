"use server";

import { createClient } from "@/lib/supabase/server";

export interface PasswordState {
  ok?: boolean;
  error?: string;
}

/** Long enough to matter, short enough that people will actually set it. */
const MIN_LENGTH = 12;

/**
 * Change the signed-in user's own password.
 *
 * The current password is re-checked first. Without that, anyone who got hold
 * of a live session cookie could lock the real owner out of their own account
 * without ever knowing the password.
 */
export async function changeOwnPassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!current || !next) {
    return { error: "Fill in your current and new password." };
  }
  if (next.length < MIN_LENGTH) {
    return { error: `Use at least ${MIN_LENGTH} characters.` };
  }
  if (next !== confirm) {
    return { error: "The two new password fields do not match." };
  }
  if (next === current) {
    return { error: "The new password must be different from the current one." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "Your session has expired. Sign in again." };
  }

  // Re-authenticate before allowing the change.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (reauthError) {
    return { error: "Your current password is not correct." };
  }

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    // Supabase rejects reuse of the existing password with its own wording.
    if (/different from the old password/i.test(error.message)) {
      return {
        error: "The new password must be different from the current one.",
      };
    }
    return { error: error.message };
  }

  return { ok: true };
}
