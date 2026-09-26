"use client";

import { useActionState } from "react";

import { saveTmsLandlord, type FormState } from "@/app/(dashboard)/actions";
import { TextAreaField, TextField } from "@/components/ui/Field";
import type { TmsLandlord } from "@/lib/types";

import { RecordFormSheet } from "./RecordFormSheet";

export function TmsLandlordForm({
  open,
  onClose,
  landlord,
}: {
  open: boolean;
  onClose: () => void;
  landlord?: TmsLandlord | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    saveTmsLandlord,
    {},
  );

  return (
    <RecordFormSheet
      open={open}
      onClose={onClose}
      title={landlord ? "Edit landlord" : "Add landlord"}
      subtitle="The counterparty on a master lease. Units are attached to a landlord, not to the building — one address routinely has a different owner behind every unit."
      action={action}
      state={state}
    >
      {landlord ? (
        <input type="hidden" name="id" value={landlord.id} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Landlord name"
          name="landlord_name"
          required
          defaultValue={landlord?.landlordName}
        />
        <TextField
          label="Company (if any)"
          name="company_name"
          defaultValue={landlord?.companyName}
          hint="Leave blank when the lease is with an individual."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Telephone"
          name="phone"
          type="tel"
          defaultValue={landlord?.phone}
          placeholder="012-345 6789"
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          defaultValue={landlord?.email}
        />
      </div>

      <TextField
        label="NRIC or company registration number"
        name="id_number"
        defaultValue={landlord?.idNumber}
        hint="Whichever the lease was signed under."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Bank"
          name="bank_name"
          defaultValue={landlord?.bankName}
        />
        <TextField
          label="Account number"
          name="bank_account"
          defaultValue={landlord?.bankAccount}
        />
      </div>

      <TextField
        label="Landlord sign-in (email)"
        name="login_email"
        type="email"
        defaultValue={landlord?.loginEmail}
        placeholder="landlord@example.com"
        hint="Links these units to an account so the landlord can see their own position and nobody else's. The account must already exist under Authentication. Leave blank if nobody signs in."
      />

      <TextAreaField
        label="Notes"
        name="notes"
        defaultValue={landlord?.notes}
      />
    </RecordFormSheet>
  );
}
