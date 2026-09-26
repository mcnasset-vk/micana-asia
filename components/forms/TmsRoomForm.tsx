"use client";

import { useActionState } from "react";

import { saveTmsRoom, type FormState } from "@/app/(dashboard)/actions";
import {
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Field";
import { TMS_ROOM_TYPES } from "@/lib/constants";
import type { TmsRoom, TmsUnit } from "@/lib/types";

import { RecordFormSheet } from "./RecordFormSheet";

export function TmsRoomForm({
  open,
  onClose,
  room,
  units,
}: {
  open: boolean;
  onClose: () => void;
  room?: TmsRoom | null;
  units: TmsUnit[];
}) {
  const [state, action] = useActionState<FormState, FormData>(saveTmsRoom, {});

  return (
    <RecordFormSheet
      open={open}
      onClose={onClose}
      title={room ? "Edit room" : "Add room"}
      subtitle="A room exists whether or not anyone is in it — that is what makes vacancy countable rather than just an absence of tenants."
      action={action}
      state={state}
    >
      {room ? <input type="hidden" name="id" value={room.id} /> : null}

      <SelectField
        label="Unit"
        name="unit_id"
        defaultValue={room?.unitId ?? units[0]?.id}
        options={units.map((u) => ({
          value: u.id,
          label: `${u.propertyName} ${u.unitNumber}`.trim(),
        }))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Room label"
          name="room_label"
          required
          defaultValue={room?.roomLabel}
          placeholder="Room N"
          hint={
            room?.roomCode
              ? `Currently reads as "${room.roomCode}".`
              : "The full code is built from the property, unit and this label."
          }
        />
        <SelectField
          label="Room type"
          name="room_type"
          defaultValue={room?.roomType ?? "single"}
          options={TMS_ROOM_TYPES.map((t) => ({
            value: t.key,
            label: t.label,
          }))}
        />
      </div>

      <TextField
        label="Asking rent (RM/month)"
        name="market_rent"
        type="number"
        defaultValue={String(room?.marketRent ?? 0)}
        hint="What the room is advertised at. A live tenancy carries its own agreed rent, which is what the rent roll counts."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <CheckboxField
          label="Air conditioning"
          name="has_aircon"
          defaultChecked={room?.hasAircon ?? true}
        />
        <CheckboxField
          label="Private bathroom"
          name="has_bathroom"
          defaultChecked={room?.hasBathroom ?? false}
        />
      </div>

      <CheckboxField
        label="Available to let"
        name="active"
        defaultChecked={room?.active ?? true}
        hint="Clear this while a room is out of action. It leaves the vacancy count entirely rather than sitting in it as permanently empty."
      />

      <TextAreaField label="Notes" name="notes" defaultValue={room?.notes} />
    </RecordFormSheet>
  );
}
