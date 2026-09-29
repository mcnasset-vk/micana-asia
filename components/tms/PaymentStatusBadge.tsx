import { Badge } from "@/components/ui/Badge";
import type {
  TmsGatewayKind,
  TmsPayMethod,
  TmsSubmissionStatus,
  Tone,
} from "@/lib/types";

/**
 * One vocabulary for a submission's status, wherever it is shown.
 *
 * The words are the tenant's, not the table's. 'verified' reads "Confirmed"
 * for a slip an agent checked and "Paid online" for a gateway result; a
 * topup that is 'verified' reads "Credited", because that is the thing the
 * tenant was waiting for. 'expired' and 'cancelled' are idle rather than
 * stalled — nothing went wrong, nothing was paid.
 */
export function paymentStatusLabel(
  status: TmsSubmissionStatus,
  method: TmsPayMethod,
  kind: TmsGatewayKind,
): string {
  switch (status) {
    case "verified":
      if (kind === "topup") return "Credited";
      return method === "gateway" ? "Paid online" : "Confirmed";
    case "rejected":
      return "Not accepted";
    case "expired":
      return "Link expired";
    case "cancelled":
      return "Withdrawn";
    default:
      // Every gateway status that is neither paid nor finished lands here —
      // processing, in_progress, INIT, pending, submitted, retrying, and
      // anything new Payex adds that nothing recognises yet. "In process" is
      // the one thing true of all of them, and truer than "Awaiting payment",
      // which read as though the tenant had not paid when often they had and
      // the gateway simply had not said so yet.
      return method === "gateway" ? "In process" : "With the office";
  }
}

export function paymentStatusTone(status: TmsSubmissionStatus): Tone {
  switch (status) {
    case "verified":
      return "received";
    case "rejected":
      return "stalled";
    case "expired":
    case "cancelled":
      return "idle";
    default:
      return "committed";
  }
}

export function PaymentStatusBadge({
  status,
  method,
  kind,
}: {
  status: TmsSubmissionStatus;
  method: TmsPayMethod;
  kind: TmsGatewayKind;
}) {
  return (
    <Badge tone={paymentStatusTone(status)}>
      {paymentStatusLabel(status, method, kind)}
    </Badge>
  );
}
