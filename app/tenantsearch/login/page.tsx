import { SignInShell } from "@/components/auth/SignInShell";
import { Notice } from "@/components/auth/parts";

import { TenantCodeForm } from "./TenantCodeForm";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  "no-profile":
    "Your account exists but has not been connected to a room yet. Give the office a call and they will sort it out.",
};

/**
 * The tenant's own door.
 *
 * A separate route from /login rather than a mode of it, because this is the
 * link that goes on a tenancy agreement and into a WhatsApp group: a tenant
 * who follows it should never be shown a password box, wonder which password
 * is meant, and ring the office about it. /login keeps the password form for
 * staff and is untouched by this.
 */
export default async function TenantLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next = "/", reason } = await searchParams;
  const notice = reason ? NOTICES[reason] : undefined;

  return (
    <SignInShell
      subtitle="Tenant sign-in"
      footer="See what you owe, pay your rent and top up your meter."
    >
      <div className="space-y-4">
        {notice ? <Notice>{notice}</Notice> : null}
        <TenantCodeForm next={next} />
      </div>
    </SignInShell>
  );
}
