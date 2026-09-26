"use client";

import { useActionState } from "react";

import { saveTmsCharge, type FormState } from "@/app/(dashboard)/actions";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { TMS_CHARGE_KINDS, TMS_CHARGE_STATUSES } from "@/lib/constants";
import type { TmsRentCharge, TmsTenancy } from "@/lib/types";

import { RecordFormSheet } from "./RecordFormSheet";

const METHODS = [
  { value: "", label: "— not recorded —" },
  { value: "bank", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "online", label: "Online" },
];

export function TmsChargeForm({
  open,
  onClose,
  charge,
  tenancies,
}: {
  open: boolean;
  onClose: () => void;
  charge?: TmsRentCharge | null;
  tenancies: TmsTenancy[];
}) {
  const [state, action] = useActionState<FormState, FormData>(
    saveTmsCharge,
    {},
  );

  return (
    <RecordFormSheet
      open={open}
      onClose={onClose}
      title={charge ? "Edit charge" : "Add charge"}
      subtitle="Rent and carpark charges are normally raised a month at a time rather than added here. Use this for a utility recharge, damages, or to correct a figure."
      action={action}
      state={state}
    >
      {charge ? <input type="hidden" name="id" value={charge.id} /> : null}

      <SelectField
        label="Tenancy"
        name="tenancy_id"
        defaultValue={charge?.tenancyId ?? tenancies[0]?.id}
        options={tenancies.map((t) => ({
          value: t.id,
          label: `${t.tenantName} · ${t.roomCode || t.roomLabel}`,
        }))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Month"
          name="period_month"
          type="date"
          defaultValue={charge?.periodMonth}
          hint="The month this is rent — or a recharge — for. Any day in it; stored as the first."
        />
        <SelectField
          label="Kind"
          name="kind"
          defaultValue={charge?.kind ?? "rent"}
          options={TMS_CHARGE_KINDS.map((k) => ({
            value: k.key,
            label: `${k.label} — ${k.hint}`,
          }))}
        />
      </div>

      <TextField
        label="Description"
        name="description"
        defaultValue={charge?.description}
        placeholder="July electricity share"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Amount (RM)"
          name="amount"
          type="number"
          defaultValue={String(charge?.amount ?? 0)}
        />
        <TextField
          label="Due"
          name="due_at"
          type="date"
          defaultValue={charge?.dueAt}
        />
      </div>

      <SelectField
        label="Status"
        name="status"
        defaultValue={charge?.status ?? "unpaid"}
        options={TMS_CHARGE_STATUSES.map((s) => ({
          value: s.key,
          label: s.label,
        }))}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Paid on"
          name="paid_at"
          type="date"
          defaultValue={charge?.paidAt}
          hint="Left blank on a paid charge, today is used."
        />
        <SelectField
          label="Method"
          name="method"
          defaultValue={charge?.method ?? ""}
          options={METHODS}
        />
        <TextField
          label="Reference"
          name="reference"
          defaultValue={charge?.reference}
          placeholder="Bank slip no."
        />
      </div>

      <TextAreaField label="Notes" name="notes" defaultValue={charge?.notes} />
    </RecordFormSheet>
  );
}
