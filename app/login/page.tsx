import { SignInShell } from "@/components/auth/SignInShell";

import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  "no-profile":
    "Your account exists but has not been assigned a role yet. Ask the office to set it up.",
};

/**
 * The general sign-in, for anyone holding a password.
 *
 * Tenants have their own at /tenantsearch/login. This one is unchanged in what
 * it asks for; it only gained a link across, so somebody who was never given a
 * password is not left staring at a field they cannot fill.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next = "/", reason } = await searchParams;

  return (
    <SignInShell
      subtitle="Rooms &amp; Tenancies"
      footer="Sign in to see what you owe, pay your rent and top up your meter."
    >
      <LoginForm next={next} notice={reason ? NOTICES[reason] : undefined} />
    </SignInShell>
  );
}
