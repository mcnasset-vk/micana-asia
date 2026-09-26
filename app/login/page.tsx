import { ThemeToggle } from "@/components/layout/ThemeToggle";

import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  "no-profile":
    "Your account exists but has not been assigned a role yet. Ask the super admin to set it up.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next = "/", reason } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            MCN Asset HQ
          </h1>
          <p className="mt-1 text-[0.6875rem] uppercase tracking-[0.09em] text-ink-subtle">
            Capital &amp; Pipeline
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <LoginForm
            next={next}
            notice={reason ? NOTICES[reason] : undefined}
          />
        </div>

        <p className="mt-5 text-center text-[0.6875rem] leading-relaxed text-ink-subtle">
          This dashboard holds confidential investor and contact information.
          Access is restricted and recorded.
        </p>
      </div>
    </main>
  );
}
