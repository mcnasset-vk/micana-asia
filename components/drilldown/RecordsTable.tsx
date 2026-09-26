"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import {
  IconDocument,
  IconDownload,
  IconPhone,
  IconSearch,
  IconWarning,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber, formatRM, telHref } from "@/lib/format";
import type { DocumentRef, DrillDownContent, DrillRow } from "@/lib/types";

type SortKey = "name" | "amount" | "date" | "status";
type SortDir = "asc" | "desc";

/**
 * The single table used by every drill-down. Modules map their records into
 * `DrillRow` (see metrics.ts) rather than each shipping its own table.
 */
export function RecordsTable({
  content,
  onPreview,
}: {
  content: DrillDownContent;
  onPreview: (doc: DocumentRef, ownerName: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const statuses = useMemo(() => {
    const seen = new Map<string, number>();
    for (const row of content.rows) {
      seen.set(row.statusLabel, (seen.get(row.statusLabel) ?? 0) + 1);
    }
    return [...seen.entries()];
  }, [content.rows]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = content.rows.filter((row) => {
      if (status !== "all" && row.statusLabel !== status) return false;
      if (!needle) return true;
      return (
        row.name.toLowerCase().includes(needle) ||
        (row.subtitle ?? "").toLowerCase().includes(needle) ||
        row.phone.toLowerCase().includes(needle) ||
        row.statusLabel.toLowerCase().includes(needle)
      );
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "status":
          return a.statusLabel.localeCompare(b.statusLabel) * dir;
        case "date":
          return ((a.date ?? "").localeCompare(b.date ?? "")) * dir;
        default:
          return (a.amount - b.amount) * dir;
      }
    });
  }, [content.rows, query, status, sortKey, sortDir]);

  const visibleTotal = rows.reduce((total, row) => total + row.amount, 0);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "status" ? "asc" : "desc");
    }
  }

  function exportCsv() {
    const header = [
      "Name",
      "Details",
      "Telephone",
      "Amount (RM)",
      "Status",
      "Date",
      "Documents",
    ];
    const body = rows.map((row) => [
      row.name,
      row.subtitle ?? "",
      row.phone,
      String(row.amount),
      row.statusLabel,
      row.date ?? "",
      row.documents.map((d) => d.name).join(" | "),
    ]);
    const csv = [header, ...body]
      .map((line) =>
        line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\r\n");

    // Leading BOM so Excel opens the file as UTF-8 rather than ANSI —
    // without it, names with "·" or accents arrive mangled.
    const blob = new Blob([`﻿${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${content.title.replace(/[^\w]+/g, "-").toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const amountHeader = content.amountHeader ?? "Amount (RM)";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar ---------------------------------------------------------- */}
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search records</span>
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, contact or phone…"
              className="w-full rounded-lg border border-line bg-surface-2 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
            />
          </label>

          <div className="flex items-center gap-2">
            <label className="flex-1 sm:flex-none">
              <span className="sr-only">Filter by status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none sm:w-auto"
              >
                <option value="all">All statuses ({content.rows.length})</option>
                {statuses.map(([label, count]) => (
                  <option key={label} value={label}>
                    {label} ({count})
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconDownload className="size-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>

        <p className="mt-2.5 text-xs text-ink-muted">
          Showing <span className="tnum font-semibold text-ink">{rows.length}</span>{" "}
          of {content.rows.length}
          {content.hideTotal ? (
            <> · amounts are in mixed units, so no combined total is shown</>
          ) : (
            <>
              {" "}
              · total{" "}
              <span className="tnum font-semibold text-ink">
                {formatRM(visibleTotal)}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Rows ------------------------------------------------------------- */}
      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <EmptyState hasFilters={Boolean(query) || status !== "all"} />
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full border-collapse lg:table">
              <thead className="sticky top-0 z-[1] bg-surface-2">
                <tr className="border-b border-line text-left">
                  <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>
                    Name
                  </Th>
                  <Th>Telephone</Th>
                  <Th
                    align="right"
                    onClick={() => toggleSort("amount")}
                    active={sortKey === "amount"}
                    dir={sortDir}
                  >
                    {amountHeader}
                  </Th>
                  <Th onClick={() => toggleSort("status")} active={sortKey === "status"} dir={sortDir}>
                    Status
                  </Th>
                  <Th onClick={() => toggleSort("date")} active={sortKey === "date"} dir={sortDir}>
                    Date
                  </Th>
                  <Th align="right">Documents</Th>
                  {content.rowAction ? <Th align="right">Action</Th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-line align-top transition hover:bg-surface-2"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{row.name}</p>
                      {row.subtitle ? (
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {row.subtitle}
                        </p>
                      ) : null}
                      {row.flag ? <RowFlag text={row.flag} /> : null}
                    </td>
                    <td className="px-5 py-3">
                      <PhoneLink phone={row.phone} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <p className="tnum font-semibold text-ink">
                        {formatNumber(row.amount)}
                      </p>
                      {row.amountLabel ? (
                        <p className="text-xs text-ink-subtle">{row.amountLabel}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={row.statusTone} dot>
                        {row.statusLabel}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <p className="tnum text-sm text-ink">{formatDate(row.date)}</p>
                      {row.dateLabel ? (
                        <p className="text-xs text-ink-subtle">{row.dateLabel}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <DocumentButtons row={row} onPreview={onPreview} />
                    </td>
                    {content.rowAction ? (
                      <td className="px-5 py-3 text-right">
                        <RowActionButton action={content.rowAction} row={row} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-line lg:hidden">
              {rows.map((row) => (
                <li key={row.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{row.name}</p>
                      {row.subtitle ? (
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {row.subtitle}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum font-semibold text-ink">
                        {formatNumber(row.amount)}
                      </p>
                      {row.amountLabel ? (
                        <p className="text-xs text-ink-subtle">{row.amountLabel}</p>
                      ) : null}
                    </div>
                  </div>

                  {row.flag ? <RowFlag text={row.flag} /> : null}

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <Badge tone={row.statusTone} dot>
                      {row.statusLabel}
                    </Badge>
                    <span className="tnum text-xs text-ink-subtle">
                      {row.dateLabel} {formatDate(row.date)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <PhoneLink phone={row.phone} />
                    <DocumentButtons row={row} onPreview={onPreview} />
                    {content.rowAction ? (
                      <RowActionButton action={content.rowAction} row={row} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Th({
  children,
  onClick,
  active,
  dir,
  align = "left",
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: SortDir;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-5 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-ink-subtle",
        align === "right" && "text-right",
      )}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "inline-flex items-center gap-1 uppercase tracking-[0.07em] transition hover:text-ink",
            active && "text-ink",
          )}
        >
          {children}
          <span aria-hidden className="text-[0.625rem]">
            {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function PhoneLink({ phone }: { phone: string }) {
  return (
    <a
      href={telHref(phone)}
      className="tnum inline-flex items-center gap-1.5 text-sm text-ink transition hover:text-accent"
    >
      <IconPhone className="size-3.5 text-ink-subtle" />
      {phone}
    </a>
  );
}

function RowFlag({ text }: { text: string }) {
  return (
    <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-stalled-soft px-2 py-1 text-[0.6875rem] font-medium text-stalled">
      <IconWarning className="size-3.5 shrink-0" />
      {text}
    </p>
  );
}

function DocumentButtons({
  row,
  onPreview,
}: {
  row: DrillRow;
  onPreview: (doc: DocumentRef, ownerName: string) => void;
}) {
  if (row.documents.length === 0) {
    return <span className="text-xs text-ink-subtle">No documents</span>;
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {row.documents.map((doc) => (
        <button
          key={doc.id}
          type="button"
          onClick={() => onPreview(doc, row.name)}
          title={doc.name}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-1 text-[0.6875rem] font-medium text-ink-muted transition hover:border-accent-line hover:bg-accent-soft hover:text-accent"
        >
          <IconDocument className="size-3.5" />
          {doc.category}
        </button>
      ))}
    </div>
  );
}

function RowActionButton({
  action,
  row,
}: {
  action: NonNullable<DrillDownContent["rowAction"]>;
  row: DrillRow;
}) {
  return (
    <button
      type="button"
      onClick={() => action.run(row)}
      className="whitespace-nowrap rounded-md border border-line bg-surface-2 px-2.5 py-1 text-[0.6875rem] font-medium text-ink-muted transition hover:border-accent-line hover:bg-accent-soft hover:text-accent"
    >
      {action.label(row)}
    </button>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 px-6 text-center">
      <IconSearch className="size-7 text-ink-subtle" />
      <p className="text-sm font-medium text-ink">No records match</p>
      <p className="max-w-sm text-xs text-ink-muted">
        {hasFilters
          ? "Try clearing the search box or switching the status filter back to “All statuses”."
          : "There is nothing in this segment yet."}
      </p>
    </div>
  );
}
