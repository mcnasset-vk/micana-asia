import { signOut } from "@/app/login/actions";
import { IconLock } from "@/components/ui/icons";
import type { UserProfile } from "@/lib/types";

/**
 * Shown to a signed-in account that has not been given a scope yet.
 * Row level security already returns nothing for these users; this just
 * explains why the dashboard is empty instead of showing zeroes.
 */
export function PendingAccess({ profile }: { profile: UserProfile }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-12 text-center shadow-sm">
        <span className="rounded-full border border-line bg-surface-3 p-3 text-ink-subtle">
          <IconLock className="size-6" />
        </span>
        <h1 className="font-display text-xl font-semibold text-ink">
          Waiting for access
        </h1>
        <p className="text-sm text-ink-muted">
          Your account (<span className="text-ink">{profile.email}</span>) is
          signed in but has not been assigned a role yet.
        </p>
        <p className="text-xs leading-relaxed text-ink-subtle">
          Ask the super admin to make you a CIO for one of the business lines,
          or to grant you full access. Until then the database returns no
          records for this account.
        </p>
        <form action={signOut} className="mt-2">
          <button
            type="submit"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-3 hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
