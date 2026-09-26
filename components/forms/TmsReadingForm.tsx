"use client";

import { useActionState } from "react";

import { saveTmsReading, type FormState } from "@/app/(dashboard)/actions";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { TMS_UTILITIES } from "@/lib/constants";
import type { TmsMeterReading, TmsRoom, TmsUnit } from "@/lib/types";

import { RecordFormSheet } from "./RecordFormSheet";

export function TmsReadingForm({
  open,
  onClose,
  reading,
  units,
  rooms,
}: {
  open: boolean;
  onClose: () => void;
  reading?: TmsMeterReading | null;
  units: TmsUnit[];
  rooms: TmsRoom[];
}) {
  const [state, action] = useActionState<FormState, FormData>(
    saveTmsReading,
    {},
  );

  return (
    <RecordFormSheet
      open={open}
      onClose={onClose}
      title={reading ? "Edit reading" : "Add meter reading"}
      subtitle="Enter what the meter says, not what was used. Usage and the amount are worked out from the two readings and cannot be typed."
      action={action}
      state={state}
    >
      {reading ? <input type="hidden" name="id" value={reading.id} /> : null}

      <SelectField
        label="Unit"
        name="unit_id"
        defaultValue={reading?.unitId ?? units[0]?.id}
        options={units.map((u) => ({
          value: u.id,
          label: `${u.propertyName} ${u.unitNumber}`.trim(),
        }))}
      />

      <SelectField
        label="Room"
        name="room_id"
        defaultValue={reading?.roomId ?? ""}
        options={[
          { value: "", label: "— the whole unit —" },
          ...rooms.map((r) => ({
            value: r.id,
            label: r.roomCode || `${r.unitNumber} ${r.roomLabel}`.trim(),
          })),
        ]}
        hint="Most meters cover the unit. Choose a room only where that room is separately metered."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Utility"
          name="utility"
          defaultValue={reading?.utility ?? "electricity"}
          options={TMS_UTILITIES.map((u) => ({
            value: u.key,
            label: u.label,
          }))}
        />
        <TextField
          label="Month"
          name="period_month"
          type="date"
          defaultValue={reading?.periodMonth}
          hint="Any day in the month; it is stored as the first."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Previous reading"
          name="previous_reading"
          type="number"
          defaultValue={String(reading?.previousReading ?? 0)}
          hint="Enter 0 if the meter was replaced."
        />
        <TextField
          label="Current reading"
          name="current_reading"
          type="number"
          defaultValue={String(reading?.currentReading ?? 0)}
        />
        <TextField
          label="Rate per unit (RM)"
          name="rate_per_unit"
          type="number"
          defaultValue={String(reading?.ratePerUnit ?? 0)}
        />
      </div>

      <TextAreaField label="Notes" name="notes" defaultValue={reading?.notes} />
    </RecordFormSheet>
  );
}
