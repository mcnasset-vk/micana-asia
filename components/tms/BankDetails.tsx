import { Card, CardHeader } from "@/components/ui/Card";
import {
  CFG_PAY_ACCOUNT,
  CFG_PAY_BANK,
  CFG_PAY_CONTACT,
  CFG_PAY_EMAIL,
  CFG_PAY_PHONE,
  CFG_PAY_TO_NAME,
  telHref,
} from "@/lib/config";

/**
 * Where to send the money. Shared by Room Rental and Smartmeter Topup, which
 * is the whole reason it is a component: two screens quoting two different
 * account numbers is a support problem waiting to happen.
 *
 * The bank, the account number and the payee are one block at the top rather
 * than three rows of a definition list, because they are read together and
 * acted on together — a tenant copies the number into their banking app and
 * then checks the name their app shows back against the one here. Getting that
 * comparison wrong is the expensive mistake, so the name is labelled "Pay to"
 * and sits directly under the number it belongs to.
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
        title="Transfer to this account"
        hint="Check the name matches before you send anything"
      />
      <div className="px-5 py-4 text-sm">
        {configured ? (
          <>
            {/* The number a tenant is about to type into their banking app,
                set out to be read and checked rather than skimmed: bank and
                account together, big, before anything else on the card. */}
            {CFG_PAY_ACCOUNT ? (
              <div className="mb-4 rounded-lg border border-line bg-surface-3 px-4 py-3">
                {CFG_PAY_BANK ? (
                  <p className="text-[0.6875rem] font-medium uppercase tracking-[0.09em] text-ink-subtle">
                    {CFG_PAY_BANK}
                  </p>
                ) : null}
                <p className="mt-0.5 font-mono text-lg font-semibold tracking-wide text-ink">
                  {CFG_PAY_ACCOUNT}
                </p>
                {CFG_PAY_TO_NAME ? (
                  <p className="mt-1 text-ink">
                    <span className="text-ink-muted">Pay to</span>{" "}
                    <span className="font-semibold">{CFG_PAY_TO_NAME}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
          <dl className="space-y-3">
            {CFG_PAY_ACCOUNT ? null : CFG_PAY_BANK ? (
              <Line term="Bank name" value={CFG_PAY_BANK} />
            ) : null}
            {CFG_PAY_ACCOUNT ? null : CFG_PAY_TO_NAME ? (
              <Line term="Account name" value={CFG_PAY_TO_NAME} />
            ) : null}
            {reference ? <Line term="Reference" value={reference} mono /> : null}
          </dl>
          </>
        ) : (
          <p className="max-w-prose text-ink-muted">
            Payment details have not been published yet. Contact the office for
            where to send this.
          </p>
        )}

        {CFG_PAY_PHONE || CFG_PAY_EMAIL ? (
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-ink-subtle">
            <span>Questions:</span>
            {CFG_PAY_PHONE ? (
              <a
                href={telHref(CFG_PAY_PHONE)}
                className="font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
              >
                {CFG_PAY_PHONE}
              </a>
            ) : null}
            {CFG_PAY_EMAIL ? (
              <a
                href={`mailto:${CFG_PAY_EMAIL}`}
                className="font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
              >
                {CFG_PAY_EMAIL}
              </a>
            ) : null}
          </p>
        ) : CFG_PAY_CONTACT ? (
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
