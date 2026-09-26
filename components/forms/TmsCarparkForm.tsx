"use client";

import { useActionState } from "react";

import { saveTmsCarpark, type FormState } from "@/app/(dashboard)/actions";
import {
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Field";
import type { TmsCarpark, TmsTenancy, TmsUnit } from "@/lib/types";

import { RecordFormSheet } from "./RecordFormSheet";

export function TmsCarparkForm({
  open,
  onClose,
  carpark,
  units,
  tenancies,
}: {
  open: boolean;
  onClose: () => void;
  carpark?: TmsCarpark | null;
  units: TmsUnit[];
  tenancies: TmsTenancy[];
}) {
  const [state, action] = useActionState<FormState, FormData>(
    saveTmsCarpark,
    {},
  );

  return (
    <RecordFormSheet
      open={open}
      onClose={onClose}
      title={carpark ? "Edit carpark" : "Add carpark"}
      subtitle="Bays come with the unit, not with a room, and there are usually fewer of them than there are tenants."
      action={action}
      state={state}
    >
      {carpark ? <input type="hidden" name="id" value={carpark.id} /> : null}

      <SelectField
        label="Unit"
        name="unit_id"
        defaultValue={carpark?.unitId ?? units[0]?.id}
        options={units.map((u) => ({
          value: u.id,
          label: `${u.propertyName} ${u.unitNumber}`.trim(),
        }))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Bay label"
          name="bay_label"
          required
          defaultValue={carpark?.bayLabel}
          placeholder="B2-114"
        />
        <TextField
          label="Monthly fee (RM)"
          name="monthly_fee"
          type="number"
          defaultValue={String(carpark?.monthlyFee ?? 0)}
          hint="Zero means the bay is bundled into the rent and raises no charge of its own."
        />
      </div>

      <SelectField
        label="Assigned to"
        name="tenancy_id"
        defaultValue={carpark?.tenancyId ?? ""}
        options={[
          { value: "", label: "— not assigned —" },
          ...tenancies.map((t) => ({
            value: t.id,
            label: `${t.tenantName} · ${t.roomCode || t.roomLabel}`,
          })),
        ]}
        hint="One bay to one tenant. Ending a tenancy frees its bay automatically."
      />

      <CheckboxField
        label="In service"
        name="active"
        defaultChecked={carpark?.active ?? true}
        hint="Clear this to take the bay out of the vacancy count altogether."
      />

      <TextAreaField label="Notes" name="notes" defaultValue={carpark?.notes} />
    </RecordFormSheet>
  );
}
