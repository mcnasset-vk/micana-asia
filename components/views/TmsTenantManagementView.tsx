"use client";

import { useState } from "react";

import { useDrillDown } from "@/components/drilldown/DrillDownProvider";
import { RecordsCard } from "@/components/drilldown/RecordsCard";
import { TmsCarparkForm } from "@/components/forms/TmsCarparkForm";
import { TmsLandlordForm } from "@/components/forms/TmsLandlordForm";
import { TmsPropertyForm } from "@/components/forms/TmsPropertyForm";
import { TmsRoomForm } from "@/components/forms/TmsRoomForm";
import { TmsBookingForm } from "@/components/forms/TmsBookingForm";
import { TmsTenancyForm } from "@/components/forms/TmsTenancyForm";
import { TmsUnitForm } from "@/components/forms/TmsUnitForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { TmsFilterBar } from "@/components/tms/TmsFilterBar";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatRM } from "@/lib/format";
import {
  getTmsPortfolio,
  getTmsTenancyBuckets,
  TMS_NO_FILTER,
  type TmsFilter,
} from "@/lib/metrics";
import {
  tmsCarparkInventoryDrill,
  tmsLandlordDrill,
  tmsRoomInventoryDrill,
  tmsTenancyDrill,
  tmsTenancyStatusDrill,
  tmsUnitDrill,
} from "@/lib/drilldowns";
import type {
  TmsCarpark,
  TmsLandlord,
  TmsProperty,
  TmsRoom,
  TmsTenancy,
  TmsUnit,
  Tone,
} from "@/lib/types";

type Editing<T> = T | null | undefined;

const ADD_BUTTON =
  "rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-muted transition hover:border-accent-line hover:text-accent";

const DOT: Record<Tone, string> = {
  received: "bg-received",
  committed: "bg-committed",
  risk: "bg-risk",
  stalled: "bg-stalled",
  idle: "bg-idle",
  accent: "bg-accent",
};

/**
 * The records the dashboard is drawn from, in the order they have to be
 * created: a landlord, a property, a unit inside it, rooms inside that, and
 * finally a tenancy against a room.
 *
 * Each level is its own card rather than one nested tree, because the daily
 * work is at the bottom of the chain and a tree would bury it.
 */
export function TmsTenantManagementView() {
  const { data, now, isTmsAgent } = useDashboard();
  const { openDrillDown } = useDrillDown();

  const [filter, setFilter] = useState<TmsFilter>(TMS_NO_FILTER);
  const [landlord, setLandlord] = useState<Editing<TmsLandlord>>(undefined);
  const [property, setProperty] = useState<Editing<TmsProperty>>(undefined);
  const [unit, setUnit] = useState<Editing<TmsUnit>>(undefined);
  const [room, setRoom] = useState<Editing<TmsRoom>>(undefined);
  const [carpark, setCarpark] = useState<Editing<TmsCarpark>>(undefined);
  const [tenancy, setTenancy] = useState<Editing<TmsTenancy>>(undefined);
  // The full registration, kept apart from the short tenancy form so that
  // correcting a rent does not mean submitting the whole booking again.
  const [booking, setBooking] = useState<Editing<TmsTenancy>>(undefined);

  const portfolio = getTmsPortfolio(data, filter, now);
  const buckets = getTmsTenancyBuckets(data, filter);

  // A record needs its parent to exist first, and the chain is strict:
  // property -> unit -> room -> tenancy. Offering "Add room" with no units
  // opens a form whose only dropdown has nothing in it and whose Save returns
  // "Choose which unit this room is in" — an error the agent cannot act on
  // from inside the sheet. Disabled with the reason on the button instead.
  const needs = (ready: boolean, what: string) =>
    ready ? undefined : `Add ${what} first`;

  const edit = <T extends { id: string }>(
    list: T[],
    set: (value: T) => void,
  ) =>
    isTmsAgent
      ? {
          label: () => "Edit",
          run: (row: { id: string }) => {
            const found = list.find((x) => x.id === row.id);
            if (found) set(found);
          },
        }
      : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Tenant Management System"
        title="Tenant Management"
        description="Landlords, properties, the units leased from them, the rooms inside those units, and the tenancies against each room. Everything the dashboard counts is entered here."
        action={
          // Landlords and tenants can read this module; only the agent writes
          // to it. The policies enforce that — these buttons would simply fail.
          isTmsAgent ? (
            <div className="flex flex-wrap gap-2">
              <AddButton
                label="Register a tenant"
                primary
                blocked={needs(data.rooms.length > 0, "a room")}
                onClick={() => setBooking(null)}
              />
              <AddButton
                label="Add tenancy"
                blocked={needs(data.rooms.length > 0, "a room")}
                onClick={() => setTenancy(null)}
              />
              <AddButton label="Add landlord" onClick={() => setLandlord(null)} />
              <AddButton label="Add property" onClick={() => setProperty(null)} />
              <AddButton
                label="Add unit"
                blocked={needs(data.properties.length > 0, "a property")}
                onClick={() => setUnit(null)}
              />
              <AddButton
                label="Add room"
                blocked={needs(data.units.length > 0, "a unit")}
                onClick={() => setRoom(null)}
              />
              <AddButton
                label="Add carpark"
                blocked={needs(data.units.length > 0, "a unit")}
                onClick={() => setCarpark(null)}
              />
            </div>
          ) : null
        }
      />

      <div className="mt-4">
        <TmsFilterBar filter={filter} onChange={setFilter} showMonth={false} />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="The portfolio"
          hint="What is under management, level by level"
        />
        <div className="grid gap-px bg-line sm:grid-cols-3 xl:grid-cols-6">
          <Figure label="Landlords" value={String(portfolio.landlords)} />
          <Figure label="Properties" value={String(portfolio.properties)} />
          <Figure
            label="Units"
            value={String(portfolio.units)}
            note={`${portfolio.unitsActive} on an active lease`}
          />
          <Figure
            label="Rooms"
            value={String(portfolio.roomsActive)}
            note={
              portfolio.rooms === portfolio.roomsActive
                ? "all lettable"
                : `${portfolio.rooms - portfolio.roomsActive} out of service`
            }
          />
          <Figure
            label="In residence"
            value={String(portfolio.tenanciesLive)}
            note={
              portfolio.tenanciesUnderNotice > 0
                ? `${portfolio.tenanciesUnderNotice} under notice`
                : "none under notice"
            }
          />
          <Figure
            label="Rent roll"
            value={formatRM(portfolio.rentRoll)}
            note={`less ${formatRM(portfolio.masterRent)} master rent`}
          />
        </div>
      </Card>

      {/* The pipeline, because refilling a room starts well before it empties. */}
      <Card className="mt-4">
        <CardHeader
          title="Tenancy pipeline"
          hint="Where every tenancy stands. A reservation already holds its room; an enquiry does not"
        />
        <ul className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-5">
          {buckets.map((bucket) => (
            <li key={bucket.key}>
              <button
                type="button"
                onClick={() =>
                  openDrillDown(tmsTenancyStatusDrill(data, filter, bucket.key))
                }
                disabled={bucket.count === 0}
                className={cn(
                  "flex w-full flex-col items-start bg-surface px-5 py-4 text-left transition",
                  bucket.count > 0
                    ? "hover:bg-surface-2"
                    : "cursor-default opacity-55",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn("size-2.5 rounded-sm", DOT[bucket.tone])}
                  />
                  <span className="text-xs font-medium text-ink-muted">
                    {bucket.label}
                  </span>
                </span>
                <span className="tnum mt-1 font-display text-xl font-semibold text-ink">
                  {bucket.count}
                </span>
                <span className="mt-0.5 text-[0.6875rem] text-ink-subtle">
                  {formatRM(bucket.rentValue)} of rent
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-4">
        <RecordsCard
          height="h-[34rem]"
          content={{
            ...tmsTenancyDrill(data, filter, now, "all"),
            title: "Tenancies",
            subtitle:
              "Every tenancy on record. Search by tenant, room or phone number.",
            rowAction: edit(data.tenancies, setTenancy),
          }}
        />
      </div>

      {/* Full width rather than two up: RecordsTable carries seven columns,
          and at half of a wide screen the room code and telephone wrap onto
          three lines each. */}
      <div className="mt-4 grid gap-4">
        <RecordsCard
          height="h-[30rem]"
          content={{
            // Inventory, not vacancy: a room withdrawn from letting must stay
            // visible here or there is nowhere left to switch it back on.
            ...tmsRoomInventoryDrill(data, filter, now),
            rowAction: edit(data.rooms, setRoom),
          }}
        />
        <RecordsCard
          height="h-[30rem]"
          content={{
            ...tmsCarparkInventoryDrill(data, filter),
            rowAction: edit(data.carparks, setCarpark),
          }}
        />
        <RecordsCard
          height="h-[30rem]"
          content={{
            ...tmsUnitDrill(data, filter),
            title: "Units",
            subtitle:
              "Apartments held on a master lease, and what each costs per month.",
            rowAction: edit(data.units, setUnit),
          }}
        />
        <RecordsCard
          height="h-[30rem]"
          content={{
            ...tmsLandlordDrill(data),
            title: "Landlords",
            subtitle:
              "The counterparties on the leases. The amount is what their units cost us monthly.",
            rowAction: edit(data.landlords, setLandlord),
          }}
        />
      </div>

      {/* Properties have no drill-down of their own — the amount column would
          be meaningless — so they get a plain list with an edit affordance. */}
      <Card className="mt-4">
        <CardHeader
          title="Properties"
          hint="The buildings. Units live inside them, rooms inside those"
        />
        {data.properties.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-muted">
            No properties yet. Add one to start building the portfolio.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {data.properties.map((p) => {
              const units = data.units.filter((u) => u.propertyId === p.id);
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">
                      {p.propertyName}
                    </span>
                    <span className="block text-xs text-ink-subtle">
                      {[p.propertyCode, p.address, p.city, p.state]
                        .filter(Boolean)
                        .join(" · ") || "No address on record"}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-xs text-ink-muted">
                    {units.length} {units.length === 1 ? "unit" : "units"}
                  </span>
                  {isTmsAgent ? (
                    <button
                      type="button"
                      onClick={() => setProperty(p)}
                      className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-muted transition hover:border-accent-line hover:text-accent"
                    >
                      Edit
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <TmsLandlordForm
        open={landlord !== undefined}
        onClose={() => setLandlord(undefined)}
        landlord={landlord}
      />
      <TmsPropertyForm
        open={property !== undefined}
        onClose={() => setProperty(undefined)}
        property={property}
      />
      <TmsUnitForm
        open={unit !== undefined}
        onClose={() => setUnit(undefined)}
        unit={unit}
        properties={data.properties}
        landlords={data.landlords}
      />
      <TmsRoomForm
        open={room !== undefined}
        onClose={() => setRoom(undefined)}
        room={room}
        units={data.units}
      />
      <TmsCarparkForm
        open={carpark !== undefined}
        onClose={() => setCarpark(undefined)}
        carpark={carpark}
        units={data.units}
        tenancies={data.tenancies}
      />
      <TmsTenancyForm
        open={tenancy !== undefined}
        onClose={() => setTenancy(undefined)}
        tenancy={tenancy}
        rooms={data.rooms}
      />
      <TmsBookingForm
        open={booking !== undefined}
        onClose={() => setBooking(undefined)}
        tenancy={booking}
        rooms={data.rooms}
        accessCards={data.accessCards}
      />
    </>
  );
}

/**
 * An Add button that says why it cannot be pressed yet, rather than opening a
 * form with an empty dropdown behind it.
 */
function AddButton({
  label,
  blocked,
  primary,
  onClick,
}: {
  label: string;
  blocked?: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={Boolean(blocked)}
      title={blocked}
      // A blocked button drops out of the primary style. On an empty install
      // "Add tenancy" is the blocked one, and leaving it as the loudest thing
      // on the page pointed the eye at the one action that cannot be taken
      // while the two that bootstrap the portfolio looked secondary.
      className={cn(
        primary && !blocked
          ? "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
          : ADD_BUTTON,
        blocked ? "cursor-not-allowed opacity-45 hover:border-line" : "",
      )}
    >
      {blocked ?? label}
    </button>
  );
}

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="bg-surface px-5 py-4">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="tnum mt-1 font-display text-xl font-semibold text-ink">
        {value}
      </p>
      {note ? (
        <p className="mt-0.5 text-[0.6875rem] text-ink-subtle">{note}</p>
      ) : null}
    </div>
  );
}
