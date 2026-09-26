import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none disabled:opacity-50";

function Wrapper({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[0.6875rem] text-ink-subtle">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function TextField({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  hint,
  className,
  type = "text",
  onChange,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  type?: "text" | "tel" | "number" | "date" | "email";
  /**
   * Optional, for the few forms that have to react as somebody types — the
   * booking form recalculates the first month's rent from the move-in date.
   * Left off, the input stays uncontrolled and behaves exactly as before.
   */
  onChange?: (value: string) => void;
}) {
  return (
    <Wrapper label={label} hint={hint} className={className}>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className={CONTROL}
      />
    </Wrapper>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  options,
  hint,
  className,
  onChange,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  hint?: string;
  className?: string;
  /** As on TextField: only for forms that must react to the choice. */
  onChange?: (value: string) => void;
}) {
  return (
    <Wrapper label={label} hint={hint} className={className}>
      <select
        name={name}
        defaultValue={defaultValue}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className={CONTROL}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

/**
 * An unchecked checkbox submits nothing at all, so the server action reads
 * `"on"` as true and a missing key as false — never trust a hidden mirror
 * field, which desyncs the moment JavaScript is off.
 */
export function CheckboxField({
  label,
  name,
  defaultChecked,
  hint,
  className,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5 transition hover:border-accent-line",
        className,
      )}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[0.6875rem] text-ink-subtle">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function TextAreaField({
  label,
  name,
  defaultValue,
  hint,
  className,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  hint?: string;
  className?: string;
}) {
  return (
    <Wrapper label={label} hint={hint} className={className}>
      <textarea
        name={name}
        rows={3}
        defaultValue={defaultValue ?? ""}
        className={cn(CONTROL, "resize-y")}
      />
    </Wrapper>
  );
}
