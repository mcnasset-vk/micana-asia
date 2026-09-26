"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDashboard } from "@/components/providers/DashboardProvider";
import { TMS_UNIT_STATUSES } from "@/lib/constants";
import { daysBetween, formatDate, formatPercent, formatRMExact } from "@/lib/format";
import {
  getTmsExpenseSummary,
  getTmsMeterSummary,
  getTmsRoomVacancy,
  TMS_NO_FILTER,
} from "@/lib/metrics";

/** A lease inside this many days of its end is worth flagging to the owner. */
const RENEWAL_WINDOW_DAYS = 120;

/**
 * What a TMS landlord sees. Deliberately not the agent dashboard with the
 * other rows filtered away: an owner and an operator are asking different
 * questions of the same portfolio.
 *
 * The landlord's are: what am I paid each month, which of my leases are coming
 * up for renewal, is my property being kept full, and what is being spent on
 * it. The operator's — collection rate, outstanding rent, gross margin — are
 * about running the business that sits between the landlord and the tenants,
 * and belong on the agent's screen.
 *
 * Row level security has already narrowed `data` to units where
 * `tms_units.landlord_id` resolves to this profile, so every metric below is
 * computed over their own units without a filter being passed. The unfiltered
 * call is the point: there is nothing else in scope to filter out.
 *
 * One editorial decision worth stating. A landlord CAN read the room rents the
 * operator collects — private.tms_landlord_tenancies() returns them and the
 * policies allow it. They are not headlined here. Showing an owner the rent
 * roll next to their master rent invites reading the difference as profit,
 * when the expenses, voids and management sitting between the two are exactly
 * what the master lease transferred to the operator.
 */
export function TmsLandlordView() {
  const { data, now } = useDashboard();

  const units = data.units;
  const live = units.filter((u) => u.status !== "ended");
  const masterRent = live.reduce((sum, u) => sum + u.masterRent, 0);

  const rooms = getTmsRoomVacancy(data, TMS_NO_FILTER, now);
  const expenses = getTmsExpenseSummary(data, TMS_NO_FILTER);
  const meters = getTmsMeterSummary(data, TMS_NO_FILTER);

  // A lease with no end date never enters the renewal queue rather than
  // sorting to the top of it as though it expired in 1970.
  const renewals = live
    .filter((u) => u.leaseEndAt)
    .map((u) => ({ unit: u, days: daysBetween(now, u.leaseEndAt!) }))
    .filter((row) => row.days <= RENEWAL_WINDOW_DAYS)
    .sort((a, b) => a.days - b.days);

  if (units.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Tenant Management System"
          title="Your properties"
          description="This account is not linked to any units yet."
        />
        <Card>
          <div className="px-5 py-8 text-sm text-ink-muted">
            <p className="mb-2 font-medium text-ink">Nothing to show yet.</p>
            <p className="max-w-prose">
              Your sign-in works, but it has not been connected to a landlord
              record. The office can link it — until then there is nothing here
              to report on.
            </p>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Tenant Management System"
        title="Your properties"
        description={`${units.length} ${units.length === 1 ? "unit" : "units"} held under master lease${
          data.properties.length > 0
            ? ` across ${data.properties.length} ${data.properties.length === 1 ? "building" : "buildings"}`
            : ""
        }.`}
      />

      {/* The headline is the master rent, because that is what a landlord is
          owed regardless of how the rooms below are performing. */}
      <Card className="mt-4">
        <CardHeader
          title="Your monthly income"
          hint="Contracted under the master leases, payable whether or not the rooms are let"
        />
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <Figure label="Master rent" value={formatRMExact(masterRent)} emphasis note="per month" />
          <Figure
            label="Units on lease"
            value={String(live.length)}
            note={
              units.length > live.length
                ? `${units.length - live.length} handed back`
                : "all currently active"
            }
          />
          <Figure
            label="Annualised"
            value={formatRMExact(masterRent * 12)}
            note="at the current lease terms"
          />
        </div>
      </Card>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="How your rooms are doing"
            hint="Occupancy is the operator's responsibility — this is how your property is being used"
          />
          <div className="grid gap-px bg-line sm:grid-cols-2">
            <Figure
              label="Occupancy"
              value={
                rooms.totalRooms === 0 ? "—" : formatPercent(rooms.rentedPct, 0)
              }
              note={
                rooms.totalRooms === 0
                  ? "no lettable rooms recorded"
                  : `${rooms.rentedRooms} of ${rooms.totalRooms} rooms`
              }
              emphasis
            />
            <Figure
              label="Vacant rooms"
              value={String(rooms.vacantRooms)}
              note={
                rooms.vacantRooms === 0
                  ? "every room is let"
                  : "currently unoccupied"
              }
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Spent on your property"
            hint={
              expenses.monthsCovered > 0
                ? `Across ${expenses.monthsCovered} ${expenses.monthsCovered === 1 ? "month" : "months"} of records`
                : "Nothing recorded yet"
            }
          />
          <div className="grid gap-px bg-line sm:grid-cols-2">
            <Figure label="Total spend" value={formatRMExact(expenses.total)} emphasis />
            <Figure
              label="Utilities metered"
              value={formatRMExact(meters.totalAmount)}
              note={
                meters.monthLabel
                  ? `${meters.monthLabel} · ${meters.readingCount} ${meters.readingCount === 1 ? "reading" : "readings"}`
                  : "no readings yet"
              }
            />
          </div>
          {expenses.byCategory.filter((c) => c.amount > 0).length > 0 ? (
            <ul className="divide-y divide-line border-t border-line">
              {expenses.byCategory
                .filter((c) => c.amount > 0)
                .map((category) => (
                  <li
                    key={category.key}
                    className="flex items-baseline justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate text-ink-muted">
                      {category.label}
                    </span>
                    <span className="tnum shrink-0 font-medium text-ink">
                      {formatRMExact(category.amount)}
                    </span>
                  </li>
                ))}
            </ul>
          ) : null}
        </Card>
      </div>

      {renewals.length > 0 ? (
        <Card className="mt-4">
          <CardHeader
            title="Leases coming up"
            hint={`Ending within ${RENEWAL_WINDOW_DAYS} days — worth a conversation before they lapse`}
          />
          <ul className="divide-y divide-line">
            {renewals.map(({ unit, days }) => (
              <li
                key={unit.id}
                className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {unit.propertyName} {unit.unitNumber}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Ends {formatDate(unit.leaseEndAt)}
                  </p>
                </div>
                <Badge tone={days <= 30 ? "stalled" : "risk"}>
                  {days <= 0
                    ? "Expired"
                    : `${days} ${days === 1 ? "day" : "days"}`}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader
          title="Your units"
          hint="Every unit let to the business under a master lease"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-ink-subtle">
                <th className="px-5 py-2 font-medium">Unit</th>
                <th className="px-5 py-2 font-medium">Building</th>
                <th className="px-5 py-2 text-right font-medium">Master rent</th>
                <th className="px-5 py-2 font-medium">Lease</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {units.map((unit) => {
                const status = TMS_UNIT_STATUSES.find(
                  (s) => s.key === unit.status,
                )!;
                return (
                  <tr
                    key={unit.id}
                    className="border-b border-line last:border-0"
                  >
                    <td className="whitespace-nowrap px-5 py-2.5 font-medium text-ink">
                      {unit.unitNumber}
                      {unit.floorLabel ? (
                        <span className="ml-1.5 text-xs font-normal text-ink-subtle">
                          {unit.floorLabel}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-2.5 text-ink-muted">
                      {unit.propertyName}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right">
                      {formatRMExact(unit.masterRent)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">
                      {unit.leaseStartAt || unit.leaseEndAt
                        ? `${formatDate(unit.leaseStartAt)} — ${formatDate(unit.leaseEndAt)}`
                        : "—"}
                    </td>
                    <td className="px-5 py-2.5">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Figure({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="bg-surface px-5 py-4">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p
        className={
          emphasis
            ? "tnum mt-1 font-display text-2xl font-bold text-ink"
            : "tnum mt-1 font-display text-xl font-semibold text-ink"
        }
      >
        {value}
      </p>
      {note ? (
        <p className="mt-0.5 text-[0.6875rem] text-ink-subtle">{note}</p>
      ) : null}
    </div>
  );
}
