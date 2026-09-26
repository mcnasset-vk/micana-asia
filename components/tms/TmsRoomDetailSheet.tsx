"use client";

import { useEffect, useId } from "react";

import { Badge } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { IconChevronRight, IconClose } from "@/components/ui/icons";
import { TMS_TENANCY_STATUSES } from "@/lib/constants";
import { formatDate, formatRMExact, telHref } from "@/lib/format";
import { isTenancyHolding } from "@/lib/metrics";
import type { TmsRoomStatusRow } from "@/lib/metrics";

/**
 * Everything known about one room and whoever is in it.
 *
 * Opened by clicking a row in the room-status table. It carries prev/next
 * through the rows the table is currently showing, because the question after
 * "what about this room" is almost always "and the next one" — paging back out
 * to the table, finding your place and clicking again is three actions for
 * something that should be one.
 *
 * `index`/`total` describe position in the FILTERED, SORTED list rather than in
 * the whole portfolio, so the counter agrees with the table behind it. Stepping
 * off either end is impossible rather than wrapping: wrapping from the last row
 * to the first reads as a bug when the counter is the only thing that moved.
 */
export function TmsRoomDetailSheet({
  row,
  index,
  total,
  onClose,
  onStep,
  onEdit,
}: {
  row: TmsRoomStatusRow | null;
  index: number;
  total: number;
  onClose: () => void;
  onStep: (delta: number) => void;
  /** Agent-only. Absent for a landlord or tenant, who cannot write. */
  onEdit?: (row: TmsRoomStatusRow) => void;
}) {
  const titleId = useId();

  // Arrow keys step through the rows. Sheet already owns Escape and Tab; this
  // adds the two that make a record browser feel like one.
  useEffect(() => {
    if (!row) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Never steal an arrow key from something a person is typing into.
      if (target?.closest("input, textarea, select")) return;
      if (event.key === "ArrowLeft") onStep(-1);
      if (event.key === "ArrowRight") onStep(1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [row, onStep]);

  if (!row) return null;

  const tenancy = row.tenancy;
  const status = tenancy
    ? TMS_TENANCY_STATUSES.find((s) => s.key === tenancy.status)
    : undefined;
  // Empty today, already spoken for. Worth saying, because "Vacant" alone
  // reads as an opportunity going begging.
  const booked = !row.rented && tenancy && isTenancyHolding(tenancy);

  return (
    <Sheet open onClose={onClose} labelledBy={titleId} width="max-w-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            Tenant and room status
          </h2>
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            {row.roomCode}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <IconClose className="size-4" />
        </button>
      </header>

      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-2.5">
        <Badge tone={row.rented ? "received" : "idle"}>
          {row.rented ? "Rented" : "Vacant"}
        </Badge>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={index <= 0}
            aria-label="Previous room"
            className="rounded-lg border border-line p-1.5 text-ink-muted transition hover:border-accent-line hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconChevronRight className="size-4 rotate-180" />
          </button>
          <span className="tnum px-1 text-xs text-ink-muted">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={index >= total - 1}
            aria-label="Next room"
            className="rounded-lg border border-line p-1.5 text-ink-muted transition hover:border-accent-line hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="scrollbar-slim flex-1 overflow-y-auto px-5 py-5">
        <Section title="The room">
          <Field label="Room ID" value={row.roomCode} mono />
          <Field label="Property name" value={row.propertyName || "—"} />
          <Field label="Unit" value={row.unitNumber || "—"} />
          <Field label="Room" value={row.roomLabel || "—"} />
          <Field label="Market rent" value={formatRMExact(row.monthlyRent)} />
          <Field
            label="Lettable"
            value={row.active ? "Yes" : "Withdrawn from letting"}
          />
        </Section>

        {tenancy ? (
          <>
            <Section
              title={row.rented ? "The tenant" : "Latest tenancy"}
              hint={
                row.rented
                  ? undefined
                  : booked
                    ? "Not in residence yet — this room is held"
                    : "Nobody is in this room now"
              }
            >
              <Field label="Tenant name" value={tenancy.tenantName || "—"} />
              <Field
                label="Mobile number"
                value={tenancy.phone || "—"}
                href={tenancy.phone ? telHref(tenancy.phone) : undefined}
              />
              <Field
                label="Email"
                value={tenancy.email || "—"}
                href={tenancy.email ? `mailto:${tenancy.email}` : undefined}
              />
              <Field label="NRIC / passport" value={tenancy.idNumber || "—"} />
              <div>
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-subtle">
                  Tenancy status
                </p>
                <div className="mt-1.5">
                  <Badge tone={tenancy.status === "active" ? "received" : "idle"}>
                    {status?.label ?? tenancy.status}
                  </Badge>
                </div>
              </div>
              <Field
                label="Signed-in as"
                value={tenancy.loginEmail || "No login linked"}
                mono={Boolean(tenancy.loginEmail)}
              />
            </Section>

            <Section title="The agreement">
              <Field
                label="Monthly rent"
                value={formatRMExact(tenancy.monthlyRent)}
              />
              <Field label="Deposit held" value={formatRMExact(tenancy.deposit)} />
              <Field
                label="Advance rent"
                value={
                  tenancy.advanceRent > 0
                    ? formatRMExact(tenancy.advanceRent)
                    : "None"
                }
              />
              <Field
                label="Rent due on"
                value={`Day ${tenancy.rentDueDay} of each month`}
              />
              <Field label="Move in date" value={formatDate(tenancy.movedInAt)} />
              <Field
                label="Move out date"
                value={formatDate(tenancy.movedOutAt)}
              />
            </Section>

            {tenancy.notes ? (
              <div className="mt-5 rounded-lg border border-line bg-surface-2 px-4 py-3">
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-subtle">
                  Notes
                </p>
                <p className="mt-1 max-w-prose whitespace-pre-wrap text-sm text-ink">
                  {tenancy.notes}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-5 rounded-lg border border-line bg-surface-2 px-4 py-6 text-sm text-ink-muted">
            <p className="font-medium text-ink">No tenancy on record.</p>
            <p className="mt-1 max-w-prose">
              This room has never been let, so there is nothing to show beyond
              the room itself.
            </p>
          </div>
        )}
      </div>

      {onEdit ? (
        <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted transition hover:border-accent-line hover:text-accent"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onEdit(row)}
            disabled={!tenancy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tenancy ? "Edit tenancy" : "No tenancy to edit"}
          </button>
        </footer>
      ) : null}
    </Sheet>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  href,
  mono,
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-subtle">
        {label}
      </p>
      {href ? (
        <a
          href={href}
          className={
            mono
              ? "mt-1 block break-words font-mono text-sm text-accent hover:underline"
              : "mt-1 block break-words text-sm text-accent hover:underline"
          }
        >
          {value}
        </a>
      ) : (
        <p
          className={
            mono
              ? "mt-1 break-words font-mono text-sm text-ink"
              : "mt-1 break-words text-sm text-ink"
          }
        >
          {value}
        </p>
      )}
    </div>
  );
}
