"use client";

import { useActionState } from "react";

import { saveTmsExpense, type FormState } from "@/app/(dashboard)/actions";
import {
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Field";
import { TMS_EXPENSE_CATEGORIES } from "@/lib/constants";
import type {
  TmsExpense,
  TmsProperty,
  TmsTenancy,
  TmsUnit,
} from "@/lib/types";

import { RecordFormSheet } from "./RecordFormSheet";

export function TmsExpenseForm({
  open,
  onClose,
  expense,
  properties,
  units,
  tenancies,
}: {
  open: boolean;
  onClose: () => void;
  expense?: TmsExpense | null;
  properties: TmsProperty[];
  units: TmsUnit[];
  tenancies: TmsTenancy[];
}) {
  const [state, action] = useActionState<FormState, FormData>(
    saveTmsExpense,
    {},
  );

  return (
    <RecordFormSheet
      open={open}
      onClose={onClose}
      title={expense ? "Edit expense" : "Add expense"}
      subtitle="Pinning a cost to a tenancy is what makes it a tenant expense. Leave the tenancy blank and it is the cost of running the unit."
      action={action}
      state={state}
    >
      {expense ? <input type="hidden" name="id" value={expense.id} /> : null}

      <SelectField
        label="Property"
        name="property_id"
        defaultValue={expense?.propertyId ?? properties[0]?.id}
        options={properties.map((p) => ({
          value: p.id,
          label: p.propertyName,
        }))}
      />

      <SelectField
        label="Unit"
        name="unit_id"
        defaultValue={expense?.unitId ?? ""}
        options={[
          { value: "", label: "— the whole building —" },
          ...units.map((u) => ({
            value: u.id,
            label: `${u.propertyName} ${u.unitNumber}`.trim(),
          })),
        ]}
        hint="A quarterly management fee belongs to the building and to no unit in it."
      />

      <SelectField
        label="Tenancy"
        name="tenancy_id"
        defaultValue={expense?.tenancyId ?? ""}
        options={[
          { value: "", label: "— not a tenant cost —" },
          ...tenancies.map((t) => ({
            value: t.id,
            label: `${t.tenantName} · ${t.roomCode || t.roomLabel}`,
          })),
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Category"
          name="category"
          defaultValue={expense?.category ?? "maintenance"}
          options={TMS_EXPENSE_CATEGORIES.map((c) => ({
            value: c.key,
            label: `${c.label} — ${c.hint}`,
          }))}
        />
        <TextField
          label="Amount (RM)"
          name="amount"
          type="number"
          defaultValue={String(expense?.amount ?? 0)}
        />
      </div>

      <TextField
        label="Description"
        name="description"
        defaultValue={expense?.description}
        placeholder="Replaced the water heater"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Incurred on"
          name="incurred_on"
          type="date"
          defaultValue={expense?.incurredOn}
        />
        <TextField
          label="Paid on"
          name="paid_at"
          type="date"
          defaultValue={expense?.paidAt}
          hint="Blank means the bill is still outstanding."
        />
      </div>

      <CheckboxField
        label="Recoverable from the tenant"
        name="billable_to_tenant"
        defaultChecked={expense?.billableToTenant ?? false}
        hint="Needs a tenancy above. Raise the recharge as a charge against them — this box only records that the cost is recoverable."
      />

      <TextField
        label="Recharged on"
        name="recharged_at"
        type="date"
        defaultValue={expense?.rechargedAt}
        hint="Set once the charge has been raised, so the cost stops showing as money out with nothing coming back."
      />

      <TextAreaField label="Notes" name="notes" defaultValue={expense?.notes} />
    </RecordFormSheet>
  );
}
