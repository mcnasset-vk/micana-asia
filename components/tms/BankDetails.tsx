import { Card, CardHeader } from "@/components/ui/Card";
import {
  CFG_PAY_ACCOUNT,
  CFG_PAY_BANK,
  CFG_PAY_CONTACT,
  CFG_PAY_TO_NAME,
} from "@/lib/config";

/**
 * Where to send the money. Shared by Room Rental and Smartmeter Topup, which
 * is the whole reason it is a component: two screens quoting two different
 * account numbers is a support problem waiting to happen.
 *
 * The figures come from the environment like every other commercial value in
 * this codebase — see the docstring on lib/config.ts. They are NEXT_PUBLIC_,
 * so they reach the browser bundle, which is the right trade for an account
 * number you would print on an invoice and hand to a tenant anyway.
 *
 * With nothing configured this says so plainly rather than rendering an empty
 * card that reads like a page that failed to load.
 */
export function BankDetails({ reference }: { reference?: string }) {
  const configured = Boolean(CFG_PAY_TO_NAME || CFG_PAY_BANK || CFG_PAY_ACCOUNT);

  return (
    <Card>
      <CardHeader
        title="Bank in details"
        hint="Transfer the total, then attach the slip beside this"
      />
      <div className="px-5 py-4 text-sm">
        {configured ? (
          <dl className="space-y-3">
            {CFG_PAY_BANK ? <Line term="Bank name" value={CFG_PAY_BANK} /> : null}
            {CFG_PAY_ACCOUNT ? (
              <Line term="Bank account" value={CFG_PAY_ACCOUNT} mono />
            ) : null}
            {CFG_PAY_TO_NAME ? (
              <Line term="Company name" value={CFG_PAY_TO_NAME} />
            ) : null}
            {reference ? <Line term="Reference" value={reference} mono /> : null}
          </dl>
        ) : (
          <p className="max-w-prose text-ink-muted">
            Payment details have not been published yet. Contact the office for
            where to send this.
          </p>
        )}

        <p className="mt-4 max-w-prose text-xs leading-relaxed text-ink-subtle">
          If you pay by bank transfer, take a screenshot of the payslip and
          attach it as the payment slip. Keep it until the amount shows as
          confirmed.
        </p>

        {CFG_PAY_CONTACT ? (
          <p className="mt-3 text-xs text-ink-subtle">
            Questions: {CFG_PAY_CONTACT}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function Line({
  term,
  value,
  mono,
}: {
  term: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-ink-muted">{term}</dt>
      <dd className={mono ? "font-mono text-ink" : "font-medium text-ink"}>
        {value}
      </dd>
    </div>
  );
}
