"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useDashboard } from "@/components/providers/DashboardProvider";
import {
  IconDashboard,
  IconReceipt,
  IconBolt,
  IconShield,
  IconUsers,
} from "@/components/ui/icons";
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
  /** Shown only to the super admin, whatever `module` says. */
  superAdminOnly?: boolean;
};

/**
 * TMS is a fourth division. Unlike the others it has four pages rather than
 * one, because the work splits four ways: the agent's daily view, the records
 * behind it, what the portfolio costs, and the meters.
 *
 * They are listed as separate nav entries rather than tabs inside one page so
 * a link to the expenses screen is a link to the expenses screen.
 */
const TMS_LINES: NavItem[] = [
  {
    href: "/tms",
    label: "Agent Dashboard",
    short: "Agent",
    icon: IconDashboard,
    module: "tms",
  },
  {
    href: "/tms/tenants",
    label: "Tenant Management",
    short: "Tenants",
    icon: IconUsers,
    module: "tms",
  },
  {
    href: "/tms/expenses",
    label: "Expenses",
    short: "Expenses",
    icon: IconReceipt,
    module: "tms",
  },
  {
    href: "/tms/monitors",
    label: "Monitors",
    short: "Monitors",
    icon: IconBolt,
    module: "tms",
  },
];

/**
 * What a TMS tenant gets instead. Their dashboard, and the two things they
 * come here to do — neither of which appears on the agent's list above,
 * because an agent never pays their own rent.
 */
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

/** Super admin only — granting access is not a business line. */
const ADMIN: NavItem = {
  href: "/admin/users",
  label: "User Access",
  short: "Users",
  icon: IconShield,
  module: null,
  superAdminOnly: true,
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { profile, isSuperAdmin, canView } = useDashboard();

  const visible = (item: NavItem) =>
    item.module === null || canView(item.module);

  // The division summary spans all four MDNA lines, so it is offered to the
  // super admin and to MDNA Admin — the two roles that can actually see them.

  // Mirrors HomeView: it hands ExecutiveView to the super admin, and to the
  // `pending` fallback. Every other role it routes to a module of its own.
  // Three different lists rather than one filtered three ways. A tenant's nav
  // is not the agent's with entries removed — it has two links the agent's
  // does not, and calling the first one "Agent Dashboard" would name the page
  // TmsModule diverts them away from.
  const isTmsTenant =
    profile.role === "tms" && profile.businessLine === "tms_tenant";
  const isTmsLandlord =
    profile.role === "tms" && profile.businessLine === "tms_landlord";

  const tmsLines = isTmsTenant
    ? TMS_TENANT_LINES.filter(visible)
    : isTmsLandlord
      ? TMS_LINES.filter(visible)
          .filter((item) => item.href === "/tms")
          .map((item) => ({
            ...item,
            label: "Your Properties",
            short: "Property",
          }))
      : TMS_LINES.filter(visible);

  // Mobile has no room for a nested tree, so it shows the leaves.
  const mobileItems = [
    ...tmsLines,
    ...(isSuperAdmin ? [ADMIN] : []),
  ];

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Sidebar — desktop only ------------------------------------------ */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="border-b border-line px-5 py-5">
          <p className="font-display text-lg font-semibold leading-tight tracking-tight text-ink">
            MCN Asset HQ
          </p>
          <p className="mt-0.5 text-[0.6875rem] uppercase tracking-[0.09em] text-ink-subtle">
            Capital &amp; Pipeline
          </p>
        </div>

        <nav
          className="scrollbar-slim flex-1 space-y-1 overflow-y-auto p-3"
          aria-label="Main"
        >
          {tmsLines.length > 0 ? (
            <div className="pt-3">
              {/* A heading rather than a link: the pages below are peers, and
                  none of them is a summary of the rest. */}
              <p className="px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-ink-subtle">
                TMS
              </p>
              <div className="mt-1 space-y-1 border-l border-line pl-2">
                {tmsLines.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </div>
          ) : null}

          {isSuperAdmin ? (
            <div className="mt-3 space-y-1 border-t border-line pt-3">
              <NavLink item={ADMIN} pathname={pathname} />
            </div>
          ) : null}
        </nav>

        <div className="border-t border-line px-5 py-4">
          <p className="text-xs font-medium text-ink">{profile.fullName}</p>
          <p className="truncate text-[0.6875rem] text-ink-subtle">
            {profile.email}
          </p>
          <p className="mt-1.5 text-[0.6875rem] text-ink-subtle">
            {isSuperAdmin
              ? "Full access to all modules"
              : profile.role === "mdna"
                ? "MDNA division — four business lines"
                : "Scoped to one module"}
          </p>
        </div>
      </aside>

      {/* Main ------------------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 lg:hidden">
              <p className="truncate font-display text-base font-semibold tracking-tight text-ink">
                MCN Asset HQ
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
