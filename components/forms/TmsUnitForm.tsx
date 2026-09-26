"use client";

import { useActionState } from "react";

import { saveTmsUnit, type FormState } from "@/app/(dashboard)/actions";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { TMS_UNIT_STATUSES } from "@/lib/constants";
import type { TmsLandlord, TmsProperty, TmsUnit } from "@/lib/types";

import { RecordFormSheet } from "./RecordFormSheet";

export function TmsUnitForm({
  open,
  onClose,
  unit,
  properties,
  landlords,
}: {
  open: boolean;
  onClose: () => void;
  unit?: TmsUnit | null;
  properties: TmsProperty[];
  landlords: TmsLandlord[];
}) {
  const [state, action] = useActionState<FormState, FormData>(saveTmsUnit, {});

  return (
    <RecordFormSheet
      open={open}
      onClose={onClose}
      title={unit ? "Edit unit" : "Add unit"}
      subtitle="One apartment held on a master lease. The master rent is what leaves the business each month, whether the rooms are filled or not."
      action={action}
      state={state}
    >
      {unit ? <input type="hidden" name="id" value={unit.id} /> : null}

      <SelectField
        label="Property"
        name="property_id"
        defaultValue={unit?.propertyId ?? properties[0]?.id}
        options={properties.map((p) => ({
          value: p.id,
          label: p.propertyName,
        }))}
      />

      <SelectField
        label="Landlord"
        name="landlord_id"
        defaultValue={unit?.landlordId ?? ""}
        options={[
          { value: "", label: "— none on record yet —" },
          ...landlords.map((l) => ({
            value: l.id,
            label: l.companyName
              ? `${l.landlordName} (${l.companyName})`
              : l.landlordName,
          })),
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Unit number"
          name="unit_number"
          required
          defaultValue={unit?.unitNumber}
          placeholder="25-06"
          hint="Room codes are built from this."
        />
        <TextField
          label="Floor"
          name="floor_label"
          defaultValue={unit?.floorLabel}
          placeholder="25"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Master rent (RM/month)"
          name="master_rent"
          type="number"
          defaultValue={String(unit?.masterRent ?? 0)}
          hint="What the landlord is paid."
        />
        <SelectField
          label="Status"
          name="status"
          defaultValue={unit?.status ?? "active"}
          options={TMS_UNIT_STATUSES.map((s) => ({
            value: s.key,
            label: s.label,
          }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Lease starts"
          name="lease_start_at"
          type="date"
          defaultValue={unit?.leaseStartAt}
        />
        <TextField
          label="Lease ends"
          name="lease_end_at"
          type="date"
          defaultValue={unit?.leaseEndAt}
        />
      </div>

      <TextAreaField label="Notes" name="notes" defaultValue={unit?.notes} />
    </RecordFormSheet>
  );
}
