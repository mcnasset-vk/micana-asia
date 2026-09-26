# Micasa Asia — Tenant Management

The tenant-facing address for Micasa Asia. A tenant sees what they owe and
pays it; a landlord sees their own units. That is the whole of it.

## Its relationship to mcn-asset-hq

This is the TMS module of `mcnasset-vk/mcn-asset-hq`, extracted so Micasa Asia
has a deployment of its own without the five other divisions that repository
carries — MDNA, MEC, Micana, Factory and Nasdaq.

**Two addresses onto one set of data.** `mcn-asset-hq` is the internal
dashboard: staff sign in there and get the agent screens — the portfolio, the
records behind it, expenses, meters — plus user administration. This repository
is the external one, and publishes two personas and no others. Nothing is
duplicated or synced between them; they are two front doors to the same
Postgres.

A tenant may still sign in to the internal address, and will land on their own
page there: it is the *purpose* of each deployment that differs, not the
permissions. Staff who sign in here get a notice pointing them at the internal
dashboard, because the screens they want are not published at this URL. Set
`NEXT_PUBLIC_INTERNAL_DASHBOARD_URL` and that notice carries a link.

This is not a security boundary and is not offered as one. Row level security
decides what every account can read and answers the same on both addresses. The
point is narrower and still worth having: the public address has no management
surface on it to find.

**The two share one Supabase database, and the schema belongs to mcn-asset-hq.**
That is why this repository has no `supabase/` directory: no migrations, no
tests. Two repositories owning the same tables would drift, and the one that
ran last would win. Schema changes are made there and are live here the moment
they are applied.

What that means in practice:

- A column this app needs is added in `mcn-asset-hq` first.
- Row level security is the boundary between what each person sees, exactly as
  it is in the group dashboard. Nothing here re-implements it.
- A user's profile — their role, their business line, whether they may issue
  invoices — is one row in one `profiles` table. It is edited on the internal
  dashboard, which is the only place the admin screen is published, and the
  change is live here immediately.

## What was kept, and what was not

Kept: the tenant's page, the landlord's page, the two payment screens, the
payment gateway behind them, the shared shell (sign-in, account) and the parts
of `lib/` those depend on.

Dropped: every other division, of course — but also, since this became the
external address, everything built for an agent. The four management screens
and user administration are gone, with the eleven record forms, the filter bar,
the room sheet, the verification queue, the drilldowns, the tenancy agreement
PDF and the eighteen server actions that wrote records. Also the reminder cron
and the aircon ingest, which belong to divisions that are not here.

Removing the actions matters more than it looks. Next.js strips an unused
Server Function at build time so it never gets a public endpoint — `next build`
would have done that on its own. But a reader who finds `saveUserAccess` in the
tenant app has to work out for themselves that it is unreachable, and the next
person to import something innocently is the one who publishes it. They are
better gone than merely unused.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in Supabase and, if paying online, Payex
npm run dev
```

`npm run build` runs the typechecker; `npx eslint .` runs the linter. Both are
clean, and both should stay that way.

A note if you render pages in a sandbox: a dev server whose hot-reload socket
is blocked never hydrates, so nothing is clickable and every toggle silently
shows its default. That is the environment, not the page. Use
`npm run build && npx next start` to check anything interactive.

## Payments

Online payment goes through Payex. It is off unless `PAYEX_USERNAME` and
`PAYEX_SECRET` are set, and the tenant screens then offer bank transfer alone —
so the app is safe to deploy before the merchant account is ready.

`PAYEX_PAID_STATUSES` must be set before any payment can settle, and must hold
a value that has been observed rather than guessed. A wrong entry marks rent
paid for money that never arrived, and nothing downstream contradicts it.

What a tenant can do without asking anybody: sign in, see what they owe on
**Your Tenancy**, pay a month's rent on **Room Rental**, and buy meter credit
on **Smartmeter Topup**. Each of the two payment screens offers the gateway and
bank transfer side by side, with the instructions for both spelled out; a bank
transfer still waits on someone verifying the slip, while a gateway payment
settles itself.

The gateway is told where to send the tenant back, and where to call back,
from the host the request arrived on rather than from configuration. So this
deployment returns to this deployment, and a preview returns to itself —
nothing to set per environment, and no way for one deployment to hijack
another's return. Both apps may point at the same Payex account: an attempt is
matched by the reference stored against it in the database, not by origin.
