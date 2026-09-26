"use client";

import { useActionState, useMemo, useState, useTransition } from "react";

import { ringgitInWords } from "@/lib/words";
import {
  attachTmsRegistrationFile,
  saveTmsBooking,
  type FormState,
} from "@/app/(dashboard)/actions";
import {
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Field";
import { agreementFilename, agreementPdfBlob } from "@/lib/agreement";
import { formatRMExact } from "@/lib/format";
import { downloadPdf } from "@/lib/pdf";
import { proRateFirstMonth } from "@/lib/prorate";
import type { TmsAccessCard, TmsRoom, TmsTenancy } from "@/lib/types";

import { RecordFormSheet } from "./RecordFormSheet";

/**
 * Booking / tenancy registration — the agent's intake form.
 *
 * Three things here are worked out rather than typed, and each is shown so the
 * agent can see what the database will hold:
 *
 *   The room, unit and property details come from the room they pick. The
 *   tenancy trigger fills them on save, so echoing a second copy back from
 *   this form would only let the two drift.
 *
 *   The amounts in words come from ringgitInWords, the same function the
 *   invoice tool uses, because a Malaysian tenancy agreement states each sum
 *   both ways and the words govern.
 *
 *   The first month is built up in the open. A part month is apportioned by
 *   actual days as a starting point, and the agent adds to it or takes from it
 *   — a cleaning fee, waived days, a negotiated discount. Whatever total they
 *   settle on is what tms_generate_month bills for that month.
 */

type Adjustment = { id: number; label: string; amount: string };

/** Rows an agent can add to, so the field starts where the paperwork does. */
const BLANK_CARD = { label: "", keyNo: "" };

export function TmsBookingForm({
  open,
  onClose,
  tenancy,
  rooms,
  accessCards = [],
}: {
  open: boolean;
  onClose: () => void;
  tenancy?: TmsTenancy | null;
  rooms: TmsRoom[];
  accessCards?: TmsAccessCard[];
}) {
  const [state, action] = useActionState<FormState, FormData>(
    saveTmsBooking,
    {},
  );

  const [roomId, setRoomId] = useState(tenancy?.roomId ?? rooms[0]?.id ?? "");
  const [movedInAt, setMovedInAt] = useState(tenancy?.movedInAt ?? "");
  const [movedOutAt, setMovedOutAt] = useState(tenancy?.movedOutAt ?? "");
  const [rent, setRent] = useState(String(tenancy?.monthlyRent ?? ""));

  const [base, setBase] = useState(
    tenancy?.proRate ? String(tenancy.proRate) : "",
  );
  const [baseTouched, setBaseTouched] = useState(Boolean(tenancy?.proRate));
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);

  const saved = tenancy
    ? accessCards.filter((card) => card.tenancyId === tenancy.id)
    : [];
  const [cards, setCards] = useState<
    { id?: string; label: string; keyNo: string }[]
  >(
    saved.length > 0
      ? saved.map((card) => ({
          id: card.id,
          label: card.cardLabel,
          keyNo: card.keyNo,
        }))
      : [{ ...BLANK_CARD }, { ...BLANK_CARD }],
  );

  const room = rooms.find((r) => r.id === roomId);
  const rentNumber = Number(rent) || 0;

  const suggestion = useMemo(
    () => proRateFirstMonth(rentNumber, movedInAt),
    [rentNumber, movedInAt],
  );

  // An untouched box tracks the suggestion; a typed one is left alone.
  const baseValue = baseTouched
    ? Number(base) || 0
    : (suggestion?.amount ?? rentNumber);

  const firstMonthTotal = useMemo(() => {
    const sum = adjustments.reduce(
      (total, row) => total + (Number(row.amount) || 0),
      baseValue,
    );
    return Math.round(sum * 100) / 100;
  }, [adjustments, baseValue]);

  /** Whole months, matching the trigger: a part month does not count. */
  const termMonths = useMemo(() => {
    if (!movedInAt || !movedOutAt) return null;
    const [ay, am, ad] = movedInAt.split("-").map(Number);
    const [by, bm, bd] = movedOutAt.split("-").map(Number);
    let months = (by - ay) * 12 + (bm - am);
    if (bd < ad) months -= 1;
    return months;
  }, [movedInAt, movedOutAt]);

  return (
    <RecordFormSheet
      open={open}
      onClose={onClose}
      title={tenancy ? "Edit registration" : "Register a tenant"}
      subtitle="The booking paperwork. The room's details, the amounts in words and the first month's rent are worked out below rather than typed — a serial number is issued on save and never changes."
      action={action}
      state={state}
    >
      {tenancy ? <input type="hidden" name="id" value={tenancy.id} /> : null}

      {tenancy?.serialNo ? (
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink-muted">
          Serial <span className="font-medium text-ink">{tenancy.serialNo}</span>
          {tenancy.agentName ? ` · taken by ${tenancy.agentName}` : null}
        </p>
      ) : null}

      {/* ------------------------------------------------------- tenant --- */}
      <Legend>Tenant</Legend>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Full name"
          name="tenant_name"
          required
          defaultValue={tenancy?.tenantName}
        />
        <TextField
          label="Nickname"
          name="nickname"
          defaultValue={tenancy?.nickname}
          hint="What they are actually called, if different."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Gender"
          name="gender"
          defaultValue={tenancy?.gender ?? ""}
          options={[
            { value: "", label: "Not stated" },
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
        />
        <TextField
          label="Mobile"
          name="phone"
          type="tel"
          defaultValue={tenancy?.phone}
        />
        <TextField
          label="Nationality"
          name="nationality"
          defaultValue={tenancy?.nationality}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Email"
          name="email"
          type="email"
          defaultValue={tenancy?.email}
          hint="Where the overdue-rent reminder goes."
        />
        <TextField
          label="NRIC or passport"
          name="id_number"
          defaultValue={tenancy?.idNumber}
        />
      </div>

      {/* -------------------------------------------- emergency contact --- */}
      <Legend>Emergency contact</Legend>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Full name" name="ec_name" defaultValue={tenancy?.ecName} />
        <TextField
          label="Mobile"
          name="ec_phone"
          type="tel"
          defaultValue={tenancy?.ecPhone}
        />
        <TextField
          label="Relationship"
          name="ec_relationship"
          defaultValue={tenancy?.ecRelationship}
          placeholder="Father, spouse, friend"
        />
      </div>

      {/* --------------------------------------------------------- room --- */}
      <Legend>Room and term</Legend>

      <SelectField
        label="Room"
        name="room_id"
        defaultValue={roomId}
        onChange={setRoomId}
        options={rooms.map((r) => ({ value: r.id, label: r.roomCode }))}
        hint="A room takes one live tenancy at a time."
      />

      {room ? (
        <Derived
          rows={[
            ["Property", room.propertyName],
            ["Unit", room.unitNumber],
            ["Room type", room.roomType],
            ["Market rent", formatRMExact(room.marketRent)],
          ]}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Move in"
          name="moved_in_at"
          type="date"
          defaultValue={tenancy?.movedInAt ?? ""}
          onChange={setMovedInAt}
        />
        <TextField
          label="Move out"
          name="moved_out_at"
          type="date"
          defaultValue={tenancy?.movedOutAt ?? ""}
          onChange={setMovedOutAt}
          hint="Leave blank while the term is open."
        />
        <TextField
          label="Smart meter"
          name="smart_meter_id"
          defaultValue={tenancy?.smartMeterId}
        />
      </div>

      {termMonths !== null ? (
        <Derived
          rows={[
            [
              "Term",
              `${termMonths} whole ${termMonths === 1 ? "month" : "months"}`,
            ],
          ]}
        />
      ) : null}

      {/* --------------------------------------------------------- keys --- */}
      <Legend>Access and parking</Legend>

      <div className="grid gap-4 sm:grid-cols-2">
        <CheckboxField
          label="Keys issued"
          name="key_issued"
          defaultChecked={tenancy?.keyIssued ?? false}
        />
        <CheckboxField
          label="Parking included"
          name="parking_included"
          defaultChecked={tenancy?.parkingIncluded ?? false}
          hint="The bay itself is assigned under Carparks."
        />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-ink-muted">Access cards</p>
        {cards.map((card, index) => (
          <div
            key={card.id ?? `new-${index}`}
            className="rounded-lg border border-line p-3"
          >
            {card.id ? (
              <input type="hidden" name={`card_id_${index}`} value={card.id} />
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label={`Card ${index + 1}`}
                name={`card_label_${index}`}
                defaultValue={card.label}
                placeholder="Lobby card, lift fob"
              />
              <TextField
                label="Key number"
                name={`card_key_${index}`}
                defaultValue={card.keyNo}
              />
            </div>
            {tenancy && card.id ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Attach
                  tenancyId={tenancy.id}
                  kind="card_front"
                  cardId={card.id}
                  label="Front"
                  existing={
                    saved.find((c) => c.id === card.id)?.frontPath ?? ""
                  }
                />
                <Attach
                  tenancyId={tenancy.id}
                  kind="card_back"
                  cardId={card.id}
                  label="Back"
                  existing={saved.find((c) => c.id === card.id)?.backPath ?? ""}
                />
              </div>
            ) : (
              <p className="mt-2 text-[0.6875rem] text-ink-subtle">
                Save the registration to photograph this card.
              </p>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setCards((rows) => [...rows, { ...BLANK_CARD }])}
          className="text-xs font-medium text-accent hover:underline"
        >
          + Add another card
        </button>
      </div>

      {tenancy ? (
        <Attach
          tenancyId={tenancy.id}
          kind="inventory"
          label="Inventory photographs"
          hint={
            tenancy.inventoryPaths.length > 0
              ? `${tenancy.inventoryPaths.length} already attached. Adding another keeps them.`
              : "The state of the room at handover. Add them one at a time."
          }
        />
      ) : null}

      <SelectField
        label="Renewal option"
        name="renewal_months"
        defaultValue={String(tenancy?.renewalMonths ?? 12)}
        options={[
          { value: "0", label: "None" },
          { value: "12", label: "One (1) year" },
          { value: "24", label: "Two (2) years" },
        ]}
      />

      {/* -------------------------------------------------------- money --- */}
      <Legend>Charges and deposits</Legend>

      <div className="grid gap-4 sm:grid-cols-2">
        <Money
          label="Monthly rental"
          name="monthly_rent"
          value={rent}
          onChange={setRent}
        />
        <Money
          label="Security deposit"
          name="security_deposit"
          defaultValue={tenancy?.securityDeposit}
        />
        <Money
          label="Utility deposit"
          name="utility_deposit"
          defaultValue={tenancy?.utilityDeposit}
        />
        <Money
          label="Agreement fee"
          name="agreement_fee"
          defaultValue={tenancy?.agreementFee}
        />
        <Money
          label="Access key deposit"
          name="access_key_deposit"
          defaultValue={tenancy?.accessKeyDeposit}
        />
        <TextField
          label="Number of keys"
          name="access_key_count"
          type="number"
          defaultValue={String(tenancy?.accessKeyCount ?? 0)}
        />
      </div>

      {/* --------------------------------------------------- first month -- */}
      <div className="rounded-xl border border-accent-line bg-accent-soft p-4">
        <p className="text-xs font-medium text-ink-muted">
          First month — what the tenant is charged
        </p>

        <div className="mt-3 flex items-center gap-3">
          <span className="flex-1 text-xs text-ink-muted">
            {suggestion
              ? `Rent by days — ${suggestion.daysOccupied}/${suggestion.daysInMonth} of ${formatRMExact(rentNumber)}`
              : movedInAt
                ? "A whole month"
                : "Set a move-in date"}
          </span>
          <input
            name="pro_rate_base"
            type="number"
            step="0.01"
            value={baseTouched ? base : baseValue.toFixed(2)}
            onChange={(event) => {
              setBase(event.target.value);
              setBaseTouched(true);
            }}
            className="w-32 rounded-lg border border-line bg-surface px-3 py-2 text-right text-sm text-ink focus:border-accent focus:outline-none"
          />
          {suggestion && baseTouched ? (
            <button
              type="button"
              onClick={() => setBaseTouched(false)}
              className="text-xs font-medium text-accent hover:underline"
            >
              reset
            </button>
          ) : null}
        </div>

        {adjustments.map((row, index) => (
          <div key={row.id} className="mt-2 flex items-center gap-3">
            <input
              name={`adj_label_${index}`}
              value={row.label}
              placeholder="Reason — cleaning, waived days"
              onChange={(event) =>
                setAdjustments((rows) =>
                  rows.map((r) =>
                    r.id === row.id ? { ...r, label: event.target.value } : r,
                  ),
                )
              }
              className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <input
              name={`adj_amount_${index}`}
              type="number"
              step="0.01"
              value={row.amount}
              placeholder="0.00"
              onChange={(event) =>
                setAdjustments((rows) =>
                  rows.map((r) =>
                    r.id === row.id ? { ...r, amount: event.target.value } : r,
                  ),
                )
              }
              className="w-32 rounded-lg border border-line bg-surface px-3 py-2 text-right text-sm text-ink focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() =>
                setAdjustments((rows) => rows.filter((r) => r.id !== row.id))
              }
              className="text-xs text-ink-subtle hover:text-stalled"
            >
              remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setAdjustments((rows) => [
              ...rows,
              { id: Date.now(), label: "", amount: "" },
            ])
          }
          className="mt-3 text-xs font-medium text-accent hover:underline"
        >
          + Add or deduct
        </button>

        <div className="mt-3 flex items-baseline justify-between border-t border-accent-line pt-3">
          <span className="text-xs text-ink-muted">Total</span>
          <span className="text-base font-semibold tabular-nums text-ink">
            {formatRMExact(firstMonthTotal)}
          </span>
        </div>
        <p className="mt-1 font-mono text-[0.6875rem] text-ink-subtle">
          {ringgitInWords(Math.abs(firstMonthTotal))}
        </p>

        {/* What the generator bills. The parts above are the working. */}
        <input type="hidden" name="pro_rate" value={firstMonthTotal} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Status"
          name="status"
          defaultValue={tenancy?.status ?? "active"}
          options={[
            { value: "enquiry", label: "Enquiry" },
            { value: "reserved", label: "Reserved" },
            { value: "active", label: "Active" },
            { value: "notice", label: "Under notice" },
            { value: "ended", label: "Moved out" },
          ]}
          hint="Moved out keeps the record and its rent history."
        />
        <TextField
          label="Rent due on"
          name="rent_due_day"
          type="number"
          defaultValue={String(tenancy?.rentDueDay ?? 1)}
          hint="Day of the month, 1–28."
        />
      </div>

      <TextField
        label="Tenant sign-in (email)"
        name="login_email"
        type="email"
        defaultValue={tenancy?.loginEmail}
        hint="Links an account that already exists. Leave blank if nobody signs in."
      />

      <TextAreaField label="Notes" name="notes" defaultValue={tenancy?.notes} />

      {/* Only once there is a registration to draw from. On a blank form the
          serial has not been issued, the room chain is not filled in, and the
          document would be mostly dashes. */}
      {tenancy ? (
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <p className="text-xs font-medium text-ink">Tenancy agreement</p>
          <p className="mt-1 text-[0.6875rem] text-ink-subtle">
            Draws the particulars from this registration — parties, premises,
            term, and every figure with the words that govern it. Your standard
            terms and conditions are appended to it.
          </p>
          <button
            type="button"
            onClick={() =>
              downloadPdf(agreementPdfBlob(tenancy), agreementFilename(tenancy))
            }
            className="mt-3 rounded-lg border border-accent bg-accent px-4 py-2 text-xs font-semibold text-ink-invert hover:bg-accent-hover"
          >
            Generate tenancy agreement
          </button>
          <p className="mt-2 text-[0.6875rem] text-ink-subtle">
            Generated from what was last saved. Save your edits first if you
            have just changed something.
          </p>

          <div className="mt-4 border-t border-line pt-3">
            <Attach
              tenancyId={tenancy.id}
              kind="agreement"
              label="Signed agreement"
              existing={tenancy.agreementPath}
              hint="Upload the copy both parties have signed."
            />
          </div>
        </div>
      ) : null}
    </RecordFormSheet>
  );
}

/**
 * Attaches one file to a saved registration.
 *
 * Calls the action directly rather than submitting, because this sits inside
 * the booking form and a form cannot be nested in another. The input carries
 * no name for the same reason: it must not ride along with the main save.
 */
function Attach({
  tenancyId,
  kind,
  cardId,
  label,
  hint,
  existing,
}: {
  tenancyId: string;
  kind: "card_front" | "card_back" | "inventory" | "agreement";
  cardId?: string;
  label: string;
  hint?: string;
  existing?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label}
        {existing ? (
          <span className="ml-2 font-normal text-received">attached</span>
        ) : null}
      </span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const data = new FormData();
          data.set("tenancy_id", tenancyId);
          data.set("kind", kind);
          if (cardId) data.set("card_id", cardId);
          data.set("file", file);
          setMessage(null);
          startTransition(async () => {
            const result = await attachTmsRegistrationFile({}, data);
            setMessage(result.error ?? "Attached.");
          });
        }}
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink file:mr-3 file:rounded file:border-0 file:bg-idle-soft file:px-2 file:py-1 file:text-xs file:text-ink disabled:opacity-50"
      />
      {message ? (
        <p className="mt-1 text-[0.6875rem] text-ink-subtle">{message}</p>
      ) : hint ? (
        <p className="mt-1 text-[0.6875rem] text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

function Legend({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b border-line pb-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
      {children}
    </p>
  );
}

/** Read-only facts that come from elsewhere, shown so nobody retypes them. */
function Derived({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-dashed border-line bg-surface-2 px-3 py-2.5 sm:grid-cols-4">
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt className="text-[0.6875rem] text-ink-subtle">{term}</dt>
          <dd className="text-xs font-medium text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A ringgit figure with the words it will be written as underneath. */
function Money({
  label,
  name,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  name: string;
  value?: string;
  defaultValue?: number;
  onChange?: (value: string) => void;
}) {
  const [internal, setInternal] = useState(
    defaultValue ? String(defaultValue) : "",
  );
  const shown = value ?? internal;
  const amount = Number(shown) || 0;

  return (
    <div>
      <TextField
        label={label}
        name={name}
        type="number"
        defaultValue={shown}
        onChange={(next) => {
          if (onChange) onChange(next);
          else setInternal(next);
        }}
      />
      <p className="mt-1 font-mono text-[0.6875rem] text-ink-subtle">
        {ringgitInWords(amount)}
      </p>
    </div>
  );
}
