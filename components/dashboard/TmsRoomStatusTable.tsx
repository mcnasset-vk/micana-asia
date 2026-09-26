"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconChevronRight, IconSearch, IconSort } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { TmsRoomDetailSheet } from "@/components/tms/TmsRoomDetailSheet";
import { formatDate, formatRM } from "@/lib/format";
import { isTenancyHolding } from "@/lib/metrics";
import type { TmsRoomStatusRow } from "@/lib/metrics";

type SortKey = "roomCode" | "propertyName" | "status" | "movedInAt" | "movedOutAt";

const PAGE_SIZES = [20, 50, 100];

/**
 * Every room with its status resolved — the table an agent lives in.
 *
 * Sorted, searchable and paged rather than a scrolling wall, because a
 * portfolio of any size runs to several hundred rooms and the question is
 * always about a handful of them.
 *
 * A vacant room can still carry move-in and move-out dates. That is not a
 * contradiction: the room is empty today and already booked, and hiding the
 * dates would make it look like an opportunity going begging.
 *
 * Clicking a row opens its full record. Every row is clickable, including for
 * a landlord who cannot edit anything — reading the detail is not a write, and
 * making the affordance depend on `onOpenRoom` meant a read-only viewer got a
 * table that silently ignored their clicks.
 */
export function TmsRoomStatusTable({
  rows,
  onOpenRoom,
  onOpenAll,
}: {
  rows: TmsRoomStatusRow[];
  onOpenRoom?: (row: TmsRoomStatusRow) => void;
  onOpenAll: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "rented" | "vacant">("all");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "roomCode",
    desc: false,
  });
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  /**
   * Index into `sorted`, not into the visible page: the detail sheet steps
   * through the whole filtered list, so it can walk off the end of page one
   * into page two without the table needing to turn the page first.
   */
  const [openAt, setOpenAt] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && row.rented !== (status === "rented")) return false;
      if (!q) return true;
      return (
        row.roomCode.toLowerCase().includes(q) ||
        row.propertyName.toLowerCase().includes(q) ||
        row.tenantName.toLowerCase().includes(q) ||
        row.phone.toLowerCase().includes(q)
      );
    });
  }, [rows, query, status]);

  const sorted = useMemo(() => {
    const dir = sort.desc ? -1 : 1;
    return [...filtered].sort((a, b) => {
      if (sort.key === "status") {
        return (Number(b.rented) - Number(a.rented)) * dir;
      }
      // Nulls last whichever way the column is pointing: an empty date is not
      // "earliest", it is unknown, and sorting it to the top buries the rows
      // the agent opened the column to find.
      const av = a[sort.key] ?? "";
      const bv = b[sort.key] ?? "";
      if (av === "" && bv === "") return 0;
      if (av === "") return 1;
      if (bv === "") return -1;
      return av.localeCompare(bv) * dir;
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);

  // Pull `page` back to whatever is actually renderable.
  //
  // Clamping only at render left the state ahead of the view: filtering the
  // dashboard down from ten pages to five clamped the display to five while
  // `page` stayed at ten, so Previous had to be pressed five times before
  // anything moved. `rows` changing from the parent is the case that matters —
  // the in-table controls already reset it themselves.
  if (page !== current) setPage(current);

  const header = (key: SortKey, label: string, className?: string) => (
    <th className={cn("px-4 py-2 text-left font-medium", className)}>
      <button
        type="button"
        onClick={() =>
          setSort((s) => ({ key, desc: s.key === key ? !s.desc : false }))
        }
        className={cn(
          "inline-flex items-center gap-1 transition hover:text-ink",
          sort.key === key ? "text-ink" : "",
        )}
      >
        {label}
        <IconSort className="size-3" />
      </button>
    </th>
  );

  return (
    <Card>
      <CardHeader
        title="Tenant And Room Status"
        hint="Every lettable room, and whoever is in it"
        action={
          <button
            type="button"
            onClick={onOpenAll}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-muted transition hover:border-accent-line hover:text-accent"
          >
            Open as records
            <IconChevronRight className="size-3.5" />
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <div className="relative min-w-[14rem] flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search room, property, tenant or phone"
            aria-label="Search rooms"
            className="w-full rounded-lg border border-line bg-surface-2 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1">
          {(["all", "rented", "vacant"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setStatus(key);
                setPage(1);
              }}
              aria-pressed={status === key}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-medium capitalize transition",
                status === key
                  ? "border-accent-line bg-accent-soft text-accent"
                  : "border-line text-ink-muted hover:border-accent-line hover:text-accent",
              )}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-[0.06em] text-ink-subtle">
              <th className="px-4 py-2 text-left font-medium">Status</th>
              {header("propertyName", "Property")}
              {header("roomCode", "Room")}
              <th className="px-4 py-2 text-left font-medium">Tenant</th>
              <th className="px-4 py-2 text-right font-medium">Rent</th>
              {header("movedInAt", "Move in")}
              {header("movedOutAt", "Move out")}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const booked =
                !row.rented && row.tenancy && isTenancyHolding(row.tenancy);
              return (
                <tr
                  key={row.roomId}
                  onClick={() => setOpenAt(sorted.indexOf(row))}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setOpenAt(sorted.indexOf(row));
                    }
                  }}
                  className={cn(
                    "cursor-pointer border-b border-line transition-colors last:border-0",
                    // Green on hover and on keyboard focus, so the row reads as
                    // something you can open rather than something you are
                    // merely pointing at.
                    "hover:bg-received-soft focus:bg-received-soft focus:outline-none",
                  )}
                >
                  <td className="px-4 py-2.5">
                    <Badge tone={row.rented ? "received" : "idle"}>
                      {row.rented ? "Rented" : "Vacant"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">
                    {row.propertyName || "—"}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-ink">
                    {row.roomCode}
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">
                    {row.tenantName || "—"}
                    {booked ? (
                      <span className="ml-2 text-[0.6875rem] text-committed">
                        booked
                      </span>
                    ) : null}
                  </td>
                  <td className="tnum px-4 py-2.5 text-right text-ink">
                    {formatRM(row.monthlyRent)}
                  </td>
                  <td className="tnum px-4 py-2.5 text-ink-muted">
                    {formatDate(row.movedInAt)}
                  </td>
                  <td className="tnum px-4 py-2.5 text-ink-muted">
                    {formatDate(row.movedOutAt)}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ink-muted">
                  {rows.length === 0
                    ? "No rooms yet. Add a property, a unit and its rooms to see them here."
                    : "Nothing matches that search."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            aria-label="Rows per page"
            className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}/page
              </option>
            ))}
          </select>
          <span className="tnum">Total: {sorted.length}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={current === 1}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-muted transition hover:border-accent-line hover:text-accent disabled:cursor-not-allowed disabled:opacity-45"
          >
            Previous
          </button>
          <span className="tnum px-2 text-xs text-ink-muted">
            {current} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={current === pageCount}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-muted transition hover:border-accent-line hover:text-accent disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next
          </button>
        </div>
      </footer>

      <TmsRoomDetailSheet
        row={openAt === null ? null : (sorted[openAt] ?? null)}
        index={openAt ?? 0}
        total={sorted.length}
        onClose={() => setOpenAt(null)}
        onStep={(delta) =>
          setOpenAt((at) =>
            at === null
              ? null
              : Math.min(sorted.length - 1, Math.max(0, at + delta)),
          )
        }
        // Editing closes the detail first: the tenancy form is itself a sheet,
        // and stacking one over the other traps focus in the wrong panel.
        onEdit={
          onOpenRoom
            ? (row) => {
                setOpenAt(null);
                onOpenRoom(row);
              }
            : undefined
        }
      />
    </Card>
  );
}
