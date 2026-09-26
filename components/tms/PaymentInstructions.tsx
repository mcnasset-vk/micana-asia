import { Card } from "@/components/ui/Card";

/**
 * How to pay, in order, for whichever method is selected.
 *
 * Shared by the rent and topup screens rather than written twice. The two
 * pages ask for the same two things in the same two ways, and a tenant who
 * learns one should not have to relearn the other — which is exactly what
 * happens when each page keeps its own wording and they drift.
 *
 * The steps are numbered because the order matters and getting it wrong
 * costs real money: transferring before reading the amount, or submitting a
 * slip for a sum that does not match, both end with somebody unpicking it by
 * hand. Prose lets a reader skim past that; a numbered list does not.
 */

type Method = "gateway" | "bank";
type Kind = "payment" | "topup";

const STEPS: Record<Method, Record<Kind, string[]>> = {
  gateway: {
    payment: [
      "Tick the months you are paying for, above.",
      "Press the blue Pay button. You will be taken to Payex's payment page.",
      "Pay there by card, online banking or e-wallet.",
      "You are brought back here automatically. The months are marked paid once Payex confirms the payment — nothing is confirmed from this page alone.",
    ],
    topup: [
      "Choose or type the amount, above.",
      "Press the blue Pay button. You will be taken to Payex's payment page.",
      "Pay there by card, online banking or e-wallet.",
      "You are brought back here automatically. The meter is credited once Payex confirms the payment — nothing is credited from this page alone.",
    ],
  },
  bank: {
    payment: [
      "Tick the months you are paying for, above.",
      "Transfer that exact total to the account shown below.",
      "Save the receipt from your banking app, as a screenshot or a PDF.",
      "Attach it above as the payment slip, then press Submit.",
      "The office checks it against the bank. The months are marked settled once it matches — not when you submit.",
    ],
    topup: [
      "Choose or type the amount, above.",
      "Transfer that exact amount to the account shown below.",
      "Save the receipt from your banking app, as a screenshot or a PDF.",
      "Attach it above as the payment slip, then press Top up.",
      "The office checks it against the bank. The meter is credited once it matches — not when you submit.",
    ],
  },
};

const TITLE: Record<Method, string> = {
  gateway: "Pay Online",
  bank: "Bank Transfer",
};

export function PaymentInstructions({
  method,
  kind,
}: {
  method: Method;
  kind: Kind;
}) {
  return (
    <Card>
      <div className="px-5 py-4">
        <h2 className="font-semibold text-ink underline decoration-2 underline-offset-4">
          {TITLE[method]}
        </h2>
        <ol className="mt-3 max-w-prose list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-muted marker:font-semibold marker:text-ink">
          {STEPS[method][kind].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
