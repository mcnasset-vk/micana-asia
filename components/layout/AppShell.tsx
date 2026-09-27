"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useDashboard } from "@/components/providers/DashboardProvider";
import { IconDashboard, IconReceipt, IconBolt } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { ModuleKey } from "@/lib/types";

import { UserMenu } from "./UserMenu";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: (props: { className?: string }) => ReactNode;
  /** null = visible to everyone; a module = CIOs of that module only. */
  module: ModuleKey | null;
};

/**
 * What a tenant gets: their dashboard, and the two things they come here to
 * do.
 *
 * Listed as separate entries rather than tabs inside one page, so a link to
 * the rent screen is a link to the rent screen.
 *
 * There is no agent list beside this one any more — the agent screens are not
 * published at this address — so this no longer has to be described as what a
 * tenant gets "instead".
 */
const TMS_LANDLORD_LINES: NavItem[] = [
  {
    href: "/tms",
    label: "Your Properties",
    short: "Property",
    icon: IconDashboard,
    module: "tms",
  },
];

const TMS_TENANT_LINES: NavItem[] = [
  {
    href: "/tms",
    label: "Your Tenancy",
    short: "Tenancy",
    icon: IconDashboard,
    module: "tms",
  },
  {
    href: "/tms/pay",
    label: "Room Rental",
    short: "Pay Rent",
    icon: IconReceipt,
    module: "tms",
  },
  {
    href: "/tms/topup",
    label: "Smartmeter Topup",
    short: "Topup",
    icon: IconBolt,
    module: "tms",
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { profile, canView } = useDashboard();

  const visible = (item: NavItem) =>
    item.module === null || canView(item.module);

  // Mirrors TmsModule, which makes the same decision from the same two
  // fields. If these two ever disagree, the nav is the one that is wrong: the
  // module decides what renders.
  const isTmsTenant =
    profile.role === "tms" && profile.businessLine === "tms_tenant";
  const isTmsLandlord =
    profile.role === "tms" && profile.businessLine === "tms_landlord";

  // Staff get no links at all: TmsModule shows them the notice, and a nav
  // full of entries that all lead back to it would be worse than an empty
  // one. Two lists rather than one filtered two ways — a landlord's nav is
  // not the tenant's with entries removed, because a landlord does not pay
  // the rent.
  const tmsLines = isTmsTenant
    ? TMS_TENANT_LINES.filter(visible)
    : isTmsLandlord
      ? TMS_LANDLORD_LINES.filter(visible)
      : [];

  // Mobile has no room for a nested tree, so it shows the leaves.
  const mobileItems = tmsLines;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Sidebar — desktop only ------------------------------------------ */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="border-b border-line px-5 py-5">
          <p className="font-display text-lg font-semibold leading-tight tracking-tight text-ink">
            Micana Asia
          </p>
          <p className="mt-0.5 text-[0.6875rem] uppercase tracking-[0.09em] text-ink-subtle">
            Rooms &amp; Tenancies
          </p>
        </div>

        <nav
          className="scrollbar-slim flex-1 space-y-1 overflow-y-auto p-3"
          aria-label="Main"
        >
          {/* No section heading: there is one section, and "TMS" is a name
              for the software rather than for anything a tenant came to do. */}
          {tmsLines.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}

        </nav>

        <div className="border-t border-line px-5 py-4">
          <p className="text-xs font-medium text-ink">{profile.fullName}</p>
          <p className="truncate text-[0.6875rem] text-ink-subtle">
            {profile.email}
          </p>
          <p className="mt-1.5 text-[0.6875rem] text-ink-subtle">
            {isTmsTenant
              ? "Your tenancy"
              : isTmsLandlord
                ? "Your properties"
                : "Staff — management screens are on the internal dashboard"}
          </p>
        </div>
      </aside>

      {/* Main ------------------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 lg:hidden">
              <p className="truncate font-display text-base font-semibold tracking-tight text-ink">
                Micana Asia
              </p>
            </div>
            <p className="hidden text-xs text-ink-muted lg:block">Signed in</p>
            <div className="flex min-w-0 items-center gap-2">
              <UserMenu />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Bottom nav — mobile only ----------------------------------------- */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      >
        <ul className="flex">
          {mobileItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 px-1 py-2.5 text-[0.6875rem] font-medium transition",
                    active ? "text-accent" : "text-ink-subtle",
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  <span className="max-w-full truncate">{item.short}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-accent-soft text-accent"
          : "text-ink-muted hover:bg-surface-3 hover:text-ink",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // A route that is both a page of its own and the prefix of its siblings has
  // to match exactly, or it stays lit while a sibling is open: /mdna against
  // /mdna/admin, /tms against the three pages beneath it.
  if (href === "/mdna" || href === "/tms") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
