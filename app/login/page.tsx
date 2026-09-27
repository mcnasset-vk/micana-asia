import { IconHome } from "@/components/ui/icons";

import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  "no-profile":
    "Your account exists but has not been assigned a room yet. Give the office a call and they will sort it out.",
};

/**
 * The front door, and for most people the only page they see before deciding
 * whether this is a site they should be typing a password into.
 *
 * Deliberately light whatever the device prefers, which is why the colours
 * here are written out rather than taken from the theme tokens the rest of the
 * app uses. Everything behind the sign-in is a working screen and follows the
 * reader's choice of light or dark; this one is a greeting, and a greeting that
 * arrives as a near-black rectangle on half the phones that open it is not
 * doing its job. That also means no theme toggle on this page: it would appear
 * to do nothing, which is worse than not being there.
 *
 * The heading used to read "MCN Asset HQ — Capital & Pipeline", the group's
 * internal dashboard. A tenant arriving to pay their rent had no way of telling
 * they were in the right place.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next = "/", reason } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-[#fdf3dd] via-[#fefaf1] to-white px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-500/25">
            <IconHome className="size-8" />
          </span>
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Micana Asia
          </h1>
          <p className="mt-2 text-base font-medium text-amber-700">
            Rooms &amp; Tenancies
          </p>
        </div>

        <div className="rounded-3xl border border-amber-100 bg-white p-7 shadow-xl shadow-amber-900/5">
          <LoginForm
            next={next}
            notice={reason ? NOTICES[reason] : undefined}
          />
        </div>

        <p className="mx-auto mt-6 max-w-xs text-center text-xs leading-relaxed text-slate-500">
          Sign in to see what you owe, pay your rent and top up your meter.
        </p>
      </div>
    </main>
  );
}
