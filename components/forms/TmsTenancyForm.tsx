"use client";

import { useActionState } from "react";

import { saveTmsTenancy, type FormState } from "@/app/(dashboard)/actions";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { TMS_TENANCY_STATUSES } from "@/lib/constants";
import type { TmsRoom, TmsTenancy } from "@/lib/types";

import { RecordFormSheet } from "./RecordFormSheet";

export function TmsTenancyForm({
  open,
  onClose,
  tenancy,
  rooms,
}: {
  open: boolean;
  onClose: () => void;
  tenancy?: TmsTenancy | null;
  rooms: TmsRoom[];
}) {
  const [state, action] = useActionState<FormState, FormData>(
    saveTmsTenancy,
    {},
  );

  return (
    <RecordFormSheet
      open={open}
      onClose={onClose}
      title={tenancy ? "Edit tenancy" : "Add tenancy"}
      subtitle="One tenant, one room, one term. A room takes only one live tenancy at a time — reserved counts as live, so a booking holds the room."
      action={action}
      state={state}
    >
      {tenancy ? <input type="hidden" name="id" value={tenancy.id} /> : null}

      <SelectField
        label="Room"
        name="room_id"
        defaultValue={tenancy?.roomId ?? rooms[0]?.id}
        options={rooms.map((r) => ({
          value: r.id,
          label: r.roomCode || `${r.unitNumber} ${r.roomLabel}`.trim(),
        }))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Tenant name"
          name="tenant_name"
          required
          defaultValue={tenancy?.tenantName}
        />
        <TextField
          label="Telephone"
          name="phone"
          type="tel"
          defaultValue={tenancy?.phone}
          placeholder="012-345 6789"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Email"
          name="email"
          type="email"
          defaultValue={tenancy?.email}
        />
        <TextField
          label="NRIC or passport"
          name="id_number"
          defaultValue={tenancy?.idNumber}
        />
      </div>

      <SelectField
        label="Status"
        name="status"
        defaultValue={tenancy?.status ?? "enquiry"}
        options={TMS_TENANCY_STATUSES.map((s) => ({
          value: s.key,
          label: `${s.label} — ${s.hint}`,
        }))}
        hint="Only active and under-notice tenancies are billed. A reservation holds the room without being charged for it."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Monthly rent (RM)"
          name="monthly_rent"
          type="number"
          defaultValue={String(tenancy?.monthlyRent ?? 0)}
        />
        <TextField
          label="Deposit (RM)"
          name="deposit"
          type="number"
          defaultValue={String(tenancy?.deposit ?? 0)}
        />
        <TextField
          label="Advance rent (RM)"
          name="advance_rent"
          type="number"
          defaultValue={String(tenancy?.advanceRent ?? 0)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Moved in"
          name="moved_in_at"
          type="date"
          defaultValue={tenancy?.movedInAt}
        />
        <TextField
          label="Moves out"
          name="moved_out_at"
          type="date"
          defaultValue={tenancy?.movedOutAt}
          hint="A date in the future is a notice period, not an ended tenancy."
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
        placeholder="tenant@example.com"
        hint="Links this tenancy to an account so the tenant can see what they owe. The account must already exist under Authentication. Leave blank if nobody signs in."
      />

      <TextAreaField label="Notes" name="notes" defaultValue={tenancy?.notes} />
    </RecordFormSheet>
  );
}
