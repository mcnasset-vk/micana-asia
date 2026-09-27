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
 *
 * One word for one thing throughout. What the bank gives you is a "payment
 * slip", which is what the upload field above is labelled, so the steps never
 * call it a receipt or a payslip — three names for one file is how a tenant
 * ends up wondering whether they are being asked for something else.
 *
 * The bank transfer steps say to transfer BEFORE submitting, and that is the
 * real order: the slip field is required, so there is nothing to submit until
 * the money has moved. Which is why the reference appears in step 5 rather
 * than earlier — it is issued on submit and cannot be quoted on a transfer
 * that has already left.
 */

type Method = "gateway" | "bank";
type Kind = "payment" | "topup";

const STEPS: Record<Method, Record<Kind, string[]>> = {
  gateway: {
    payment: [
      "Tick the months you are paying for, above.",
      "Press the blue Pay button. Payex's payment page opens.",
      "Pay there by card, online banking or e-wallet.",
      "You are brought back here automatically.",
      "The months are marked paid when Payex confirms the payment. Coming back to this page is not the confirmation — if it still says unpaid, give it a moment and press Check status.",
    ],
    topup: [
      "Choose or type the amount, above.",
      "Press the blue Pay button. Payex's payment page opens.",
      "Pay there by card, online banking or e-wallet.",
      "You are brought back here automatically.",
      "The meter is credited when Payex confirms the payment. Coming back to this page is not the confirmation — if it still says pending, give it a moment and press Check status.",
    ],
  },
  bank: {
    payment: [
      "Tick the months you are paying for, above, and note the total.",
      "Transfer that total to the account below. Transfer it exactly — a different figure cannot be matched to your months, and the office has to query it before anything is settled.",
      "Save the payment slip your banking app gives you, as a screenshot or a PDF.",
      "Attach it above under Payment slip, then press Submit.",
      "You are given a reference. Keep it, and keep the slip, until the months show as confirmed.",
      "The office checks the slip against the bank. The months are marked settled when it matches — not when you submit.",
    ],
    topup: [
      "Choose or type the amount, above.",
      "Transfer that amount to the account below. Transfer it exactly — a different figure cannot be matched to your top-up, and the office has to query it before the meter is credited.",
      "Save the payment slip your banking app gives you, as a screenshot or a PDF.",
      "Attach it above under Payment slip, then press Top up.",
      "You are given a reference. Keep it, and keep the slip, until the credit shows on the meter.",
      "The office checks the slip against the bank. The meter is credited when it matches — not when you submit. Leave enough credit on it to last until then.",
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
