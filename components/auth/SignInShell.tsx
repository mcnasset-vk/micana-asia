import { IconHome } from "@/components/ui/icons";

/**
 * The frame both sign-in screens share: the mark, the name, the card.
 *
 * Deliberately light whatever the device prefers, which is why the colours
 * here are written out rather than taken from the theme tokens the rest of the
 * app uses. Everything behind the sign-in is a working screen and follows the
 * reader's choice; these are greetings, and a greeting that arrives as a
 * near-black rectangle on half the phones that open it is not doing its job.
 * That also means no theme toggle on either: it would appear to do nothing.
 */
export function SignInShell({
  subtitle,
  footer,
  children,
}: {
  subtitle: string;
  footer: string;
  children: React.ReactNode;
}) {
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
          <p className="mt-2 text-base font-medium text-amber-700">{subtitle}</p>
        </div>

        <div className="rounded-3xl border border-amber-100 bg-white p-7 shadow-xl shadow-amber-900/5">
          {children}
        </div>

        <p className="mx-auto mt-6 max-w-xs text-center text-xs leading-relaxed text-slate-500">
          {footer}
        </p>
      </div>
    </main>
  );
}
