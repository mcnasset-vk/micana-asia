# Micasa Asia — Tenant Management

Rooms, tenancies, rent and prepaid meters for Micasa Asia. One division, three
people who use it: the agent who runs the portfolio, the landlord who owns
units in it, and the tenant who lives in a room.

## Its relationship to mcn-asset-hq

This is the TMS module of `mcnasset-vk/mcn-asset-hq`, extracted so Micasa Asia
has a deployment of its own without the five other divisions that repository
carries — MDNA, MEC, Micana, Factory and Nasdaq.

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
  invoices — is one row in one `profiles` table. Granting access in this app's
  admin screen grants it in the group dashboard too, and the reverse.

## What was kept, and what was not

Kept: the TMS pages, the forms behind them, the payment gateway, the shared
shell (sign-in, account, user administration) and the parts of `lib/` those
depend on.

Dropped: every other division's routes, views, panels, forms, types, constants,
metrics and drilldowns; the invoice generator; the reminder cron and the aircon
ingest, both of which belong to divisions that are not here.

One piece moved rather than left behind. `ringgitInWords` started life in the
invoice generator, which this repository does not carry, and the tenancy
agreement needs it for the same reason an invoice does — a figure that governs
a contract is written in numerals and in words. It now lives in `lib/words.ts`.

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
