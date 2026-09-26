"use client";

import { useActionState } from "react";

import { saveTmsProperty, type FormState } from "@/app/(dashboard)/actions";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import type { TmsProperty } from "@/lib/types";

import { RecordFormSheet } from "./RecordFormSheet";

const TYPES = [
  { value: "condominium", label: "Condominium" },
  { value: "apartment", label: "Apartment" },
  { value: "landed", label: "Landed" },
  { value: "commercial", label: "Commercial" },
];

export function TmsPropertyForm({
  open,
  onClose,
  property,
}: {
  open: boolean;
  onClose: () => void;
  property?: TmsProperty | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    saveTmsProperty,
    {},
  );

  return (
    <RecordFormSheet
      open={open}
      onClose={onClose}
      title={property ? "Edit property" : "Add property"}
      subtitle="The building. Units go inside it, and rooms inside those."
      action={action}
      state={state}
    >
      {property ? <input type="hidden" name="id" value={property.id} /> : null}

      <TextField
        label="Property name"
        name="property_name"
        required
        defaultValue={property?.propertyName}
        placeholder="Enesta residence"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Short code"
          name="property_code"
          defaultValue={property?.propertyCode}
          placeholder="ENESTA"
          hint="Room codes are built from this — ENESTA 25-06 Room N. Leave blank and the first word of the name is used."
        />
        <SelectField
          label="Type"
          name="property_type"
          defaultValue={property?.propertyType ?? "condominium"}
          options={TYPES}
        />
      </div>

      <TextField
        label="Address"
        name="address"
        defaultValue={property?.address}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="City" name="city" defaultValue={property?.city} />
        <TextField label="State" name="state" defaultValue={property?.state} />
      </div>

      <TextAreaField
        label="Notes"
        name="notes"
        defaultValue={property?.notes}
      />
    </RecordFormSheet>
  );
}
