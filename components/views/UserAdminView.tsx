"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { saveUserAccess, type FormState } from "@/app/(dashboard)/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  BUSINESS_LINE_LABELS,
  LINES_BY_ROLE,
  ROLE_LABELS,
} from "@/lib/types";
import type { BusinessLine, Role, UserProfile } from "@/lib/types";

const ROLES: { value: Role; hint: string }[] = [
  { value: "super_admin", hint: "Every division" },
  { value: "mdna", hint: "MDNA division" },
  { value: "mec", hint: "MEC division" },
  { value: "micana", hint: "Micana division" },
  { value: "tms", hint: "Tenant Management System" },
  { value: "pending", hint: "No access yet" },
];

const ROLE_TONE = {
  super_admin: "accent",
  mdna: "received",
  mec: "committed",
  micana: "accent",
  tms: "risk",
  pending: "idle",
} as const;

export function UserAdminView({ profiles }: { profiles: UserProfile[] }) {
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="User Access"
        description="A role is a division. Leaving the business line blank gives someone the whole division — that is what an MDNA admin holds. Setting a line narrows an MDNA person to that line, and for MEC it chooses which desk they land on."
      />

      <Card>
        <CardHeader
          title="Accounts"
          hint={`${profiles.length} ${profiles.length === 1 ? "account" : "accounts"} · changes take effect on the person's next page load`}
        />
        <ul className="divide-y divide-line">
          {profiles.map((p) => (
            <li key={p.id}>
              <UserRow profile={p} />
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-muted">
        Access is enforced in the database, not here. An MDNA person gets zero
        rows from MEC even calling the API directly with their own token, so
        this page decides what someone is scoped to — never whether the hiding
        works. The last super admin cannot be demoted: the database refuses it,
        because otherwise nobody could manage roles again.
      </p>
    </>
  );
}

function UserRow({ profile }: { profile: UserProfile }) {
  const { profile: me } = useDashboard();
  const [state, action] = useActionState<FormState, FormData>(
    saveUserAccess,
    {},
  );

  const [role, setRole] = useState<Role>(profile.role);
  const [line, setLine] = useState<BusinessLine | "">(
    profile.businessLine ?? "",
  );
  const [canInvoice, setCanInvoice] = useState(profile.canIssueInvoices);

  const isSelf = profile.id === me.id;
  // Micana is a division too, but it has no lines beneath it, so the selector
  // below is about whether lines exist — not about division-ness.
  const hasLines =
    role === "mdna" || role === "mec" || role === "micana";
  const lines = hasLines ? LINES_BY_ROLE[role] : [];

  // Switching division invalidates the previous line, so a stale value must
  // not be submitted.
  const effectiveLine = lines.includes(line as BusinessLine) ? line : "";
  // Super admin holds the capability implicitly, so the box is shown ticked
  // and disabled for them rather than pretending it can be turned off.
  const superAdmin = role === "super_admin";
  const dirty =
    role !== profile.role ||
    (effectiveLine || null) !== profile.businessLine ||
    (!superAdmin && canInvoice !== profile.canIssueInvoices);

  return (
    <form action={action} className="px-5 py-4">
      <input type="hidden" name="id" value={profile.id} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
            {profile.fullName || profile.email}
            {isSelf ? (
              <Badge tone="accent" className="px-1.5 py-0.5 text-[0.625rem]">
                you
              </Badge>
            ) : null}
          </p>
          <p className="truncate text-xs text-ink-subtle">{profile.email}</p>
        </div>
        <Badge tone={ROLE_TONE[profile.role]} dot>
          {profile.businessLine
            ? BUSINESS_LINE_LABELS[profile.businessLine]
            : ROLE_LABELS[profile.role]}
        </Badge>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">
            Role · division
          </span>
          <select
            name="role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role);
              setLine("");
            }}
            className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {ROLE_LABELS[r.value]} — {r.hint}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">
            Business line
          </span>
          <select
            name="business_line"
            value={effectiveLine}
            onChange={(e) => setLine(e.target.value as BusinessLine | "")}
            disabled={!hasLines}
            className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none disabled:opacity-50"
          >
            <option value="">
              {hasLines ? "— whole division —" : "— not applicable —"}
            </option>
            {lines.map((l) => (
              <option key={l} value={l}>
                {BUSINESS_LINE_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5 transition hover:border-accent-line">
        <input
          type="checkbox"
          name="can_issue_invoices"
          checked={superAdmin || canInvoice}
          disabled={superAdmin}
          onChange={(e) => setCanInvoice(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">
            Can raise invoices
          </span>
          <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-ink-subtle">
            {superAdmin
              ? "A super admin always can."
              : "Adds the Invoice Generator under Tools. Grants that tool and the issuing companies behind it — no other module, and no access to this page."}
          </span>
        </span>
      </label>

      {isSelf && role !== "super_admin" ? (
        <p className="mt-2 text-xs text-risk">
          This is your own account. Removing your super admin role will end your
          access to this page.
        </p>
      ) : null}

      {state.error ? (
        <p role="alert" className="mt-2 text-xs text-stalled">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="mt-2 text-xs text-received">Saved.</p> : null}

      <div className="mt-3 flex justify-end">
        <SaveButton disabled={!dirty} />
      </div>
    </form>
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}
