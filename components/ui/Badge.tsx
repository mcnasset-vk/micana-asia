import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/types";

/**
 * Tone classes are written out in full because Tailwind needs to see the
 * literal class names at build time — no string interpolation.
 */
const TONE_CLASS: Record<Tone, string> = {
  received: "bg-received-soft text-received border-received-line",
  committed: "bg-committed-soft text-committed border-committed-line",
  risk: "bg-risk-soft text-risk border-risk-line",
  stalled: "bg-stalled-soft text-stalled border-stalled-line",
  idle: "bg-idle-soft text-idle border-idle-line",
  accent: "bg-accent-soft text-accent border-accent-line",
};

export const TONE_DOT: Record<Tone, string> = {
  received: "bg-received",
  committed: "bg-committed",
  risk: "bg-risk",
  stalled: "bg-stalled",
  idle: "bg-idle",
  accent: "bg-accent",
};

export const TONE_TEXT: Record<Tone, string> = {
  received: "text-received",
  committed: "text-committed",
  risk: "text-risk",
  stalled: "text-stalled",
  idle: "text-idle",
  accent: "text-accent",
};

export function Badge({
  tone = "idle",
  children,
  className,
  dot = false,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", TONE_DOT[tone])}
        />
      ) : null}
      {children}
    </span>
  );
}
