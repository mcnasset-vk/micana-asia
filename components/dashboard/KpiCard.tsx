"use client";

import { IconChevronRight } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/types";

const ACCENT_BAR: Record<Tone, string> = {
  received: "bg-received",
  committed: "bg-committed",
  risk: "bg-risk",
  stalled: "bg-stalled",
  idle: "bg-idle",
  accent: "bg-accent",
};

const VALUE_TEXT: Record<Tone, string> = {
  received: "text-received",
  committed: "text-committed",
  risk: "text-risk",
  stalled: "text-stalled",
  idle: "text-ink",
  accent: "text-accent",
};

/** Clickable summary tile. Every KPI on the dashboard opens a record list. */
export function KpiCard({
  label,
  value,
  detail,
  tone = "idle",
  onClick,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full flex-col items-start overflow-hidden rounded-xl border border-line bg-surface p-4 text-left shadow-sm transition hover:border-accent-line hover:shadow-md"
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-0.5 opacity-70",
          ACCENT_BAR[tone],
        )}
      />
      <span className="flex w-full items-start justify-between gap-2">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
          {label}
        </span>
        <IconChevronRight className="size-4 shrink-0 text-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-accent" />
      </span>

      <span
        className={cn(
          "tnum mt-2 font-display text-2xl font-bold tracking-tight",
          VALUE_TEXT[tone],
        )}
      >
        {value}
      </span>

      {detail ? (
        <span className="mt-1 text-xs text-ink-muted">{detail}</span>
      ) : null}
    </button>
  );
}
