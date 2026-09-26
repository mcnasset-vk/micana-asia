import { ringgitInWords } from "@/lib/words";
import { CFG_PAY_ACCOUNT, CFG_PAY_BANK, CFG_PAY_TO_NAME } from "@/lib/config";
import { formatDate, formatRMExact } from "@/lib/format";
import { assemble, Page, PAGE_W, pdfBlob, PT_PER_MM } from "@/lib/pdf";
import type { TmsAccessCard, TmsTenancy } from "@/lib/types";

/**
 * The tenancy agreement, drawn from a registration.
 *
 * What this produces is the PARTICULARS — the parties, the property, the term,
 * every figure with the words that govern it, and the signature blocks. It
 * does not write clauses, and that is deliberate: the operative terms of a
 * tenancy are a legal document, they differ between landlords and they are not
 * something to generate from a form. The last page says the standard terms are
 * appended, which is where yours go.
 *
 * Every figure appears twice, in numerals and in words, because that is what a
 * Malaysian tenancy agreement does and because the words are what governs if
 * the two ever disagree. Both come from ringgitInWords, the same function the
 * invoices use.
 */

const MARGIN = 20 * PT_PER_MM;
const RIGHT = PAGE_W - MARGIN;
const COL = MARGIN + 58 * PT_PER_MM;
const LINE = 5.6 * PT_PER_MM;

/** A label on the left, its value on the right, as the schedule is read. */
function row(page: Page, y: number, label: string, value: string): number {
  page.text(label, MARGIN, y, { size: 10.5 });
  page.text(value || "—", COL, y, { size: 10.5, bold: true });
  return y + LINE;
}

/** The figure and, beneath it, the words that govern. */
function money(page: Page, y: number, label: string, amount: number): number {
  const cursor = row(page, y, label, formatRMExact(amount));
  page.text(ringgitInWords(amount), COL, cursor - LINE + 4.1 * PT_PER_MM, {
    size: 8.5,
  });
  return cursor + 2.2 * PT_PER_MM;
}

function heading(page: Page, y: number, text: string): number {
  page.text(text, MARGIN, y, { size: 11, bold: true });
  page.rule(MARGIN, y + 1.6 * PT_PER_MM, RIGHT, 0.7);
  return y + LINE * 1.1;
}

function signature(page: Page, y: number, x: number, who: string, name: string) {
  page.rule(x, y, x + 62 * PT_PER_MM, 0.6);
  page.text(who, x, y + 4.4 * PT_PER_MM, { size: 9 });
  page.text(name, x, y + 8.6 * PT_PER_MM, { size: 9.5, bold: true });
}

export function agreementFilename(tenancy: TmsTenancy): string {
  const stem = tenancy.serialNo || tenancy.tenantName || "tenancy";
  return `${stem.replace(/[\\/\s]+/g, "-")}-agreement.pdf`;
}

export function agreementPdfBlob(
  tenancy: TmsTenancy,
  cards: TmsAccessCard[] = [],
): Blob {
  const page = new Page();
  const landlord = CFG_PAY_TO_NAME || "The Landlord";
  let y = MARGIN + 4 * PT_PER_MM;

  page.text("TENANCY AGREEMENT", PAGE_W / 2, y, {
    size: 16,
    bold: true,
    align: "center",
  });
  y += LINE;
  page.text(
    `${tenancy.serialNo}${tenancy.registeredAt ? ` · ${formatDate(tenancy.registeredAt)}` : ""}`,
    PAGE_W / 2,
    y,
    { size: 9.5, align: "center" },
  );
  y += LINE * 1.6;

  y = heading(page, y, "PARTIES");
  y = row(page, y, "Landlord", landlord);
  y = row(page, y, "Tenant", tenancy.tenantName);
  y = row(page, y, "NRIC / Passport", tenancy.idNumber);
  y = row(page, y, "Nationality", tenancy.nationality);
  y = row(page, y, "Contact", [tenancy.phone, tenancy.email].filter(Boolean).join("  ·  "));
  y += LINE * 0.5;

  y = heading(page, y, "PREMISES");
  y = row(page, y, "Property", tenancy.propertyName);
  y = row(page, y, "Unit", tenancy.unitNumber);
  y = row(page, y, "Room", tenancy.roomLabel || tenancy.roomCode);
  if (tenancy.smartMeterId) {
    y = row(page, y, "Smart meter", tenancy.smartMeterId);
  }
  y += LINE * 0.5;

  y = heading(page, y, "TERM");
  y = row(page, y, "Commencing", formatDate(tenancy.movedInAt));
  y = row(page, y, "Expiring", formatDate(tenancy.movedOutAt));
  y = row(
    page,
    y,
    "Duration",
    tenancy.tenancyMonths === null
      ? "—"
      : `${tenancy.tenancyMonths} ${tenancy.tenancyMonths === 1 ? "month" : "months"}`,
  );
  y = row(
    page,
    y,
    "Option to renew",
    tenancy.renewalMonths > 0 ? `${tenancy.renewalMonths} months` : "None",
  );
  y += LINE * 0.5;

  y = heading(page, y, "RENT AND DEPOSITS");
  y = money(page, y, "Monthly rental", tenancy.monthlyRent);
  if (tenancy.proRate > 0) {
    // Only when it differs from a whole month — otherwise it reads as a second
    // rent and invites the question of which is owed.
    y = money(page, y, "First month payable", tenancy.proRate);
  }
  y = money(page, y, "Security deposit", tenancy.securityDeposit);
  y = money(page, y, "Utility deposit", tenancy.utilityDeposit);
  y = money(page, y, "Access key deposit", tenancy.accessKeyDeposit);
  y = money(page, y, "Agreement fee", tenancy.agreementFee);
  y = row(page, y, "Rent due", `Day ${tenancy.rentDueDay} of each month`);
  y += LINE * 0.5;

  if (CFG_PAY_TO_NAME || CFG_PAY_BANK || CFG_PAY_ACCOUNT) {
    y = heading(page, y, "PAYMENT");
    if (CFG_PAY_TO_NAME) y = row(page, y, "Payable to", CFG_PAY_TO_NAME);
    if (CFG_PAY_BANK) y = row(page, y, "Bank", CFG_PAY_BANK);
    if (CFG_PAY_ACCOUNT) y = row(page, y, "Account", CFG_PAY_ACCOUNT);
    y += LINE * 0.5;
  }

  const issued = cards.filter((c) => c.cardLabel || c.keyNo);
  if (tenancy.keyIssued || issued.length > 0 || tenancy.accessKeyCount > 0) {
    y = heading(page, y, "KEYS AND ACCESS");
    y = row(page, y, "Keys issued", String(tenancy.accessKeyCount));
    for (const card of issued) {
      y = row(page, y, card.cardLabel || "Card", card.keyNo);
    }
    y = row(page, y, "Parking", tenancy.parkingIncluded ? "Included" : "Not included");
    y += LINE * 0.5;
  }

  if (tenancy.ecName || tenancy.ecPhone) {
    y = heading(page, y, "EMERGENCY CONTACT");
    y = row(page, y, "Name", tenancy.ecName);
    y = row(page, y, "Relationship", tenancy.ecRelationship);
    y = row(page, y, "Contact", tenancy.ecPhone);
    y += LINE * 0.5;
  }

  y = heading(page, y, "TERMS AND CONDITIONS");
  y = page.paragraph(
    "The standard terms and conditions of tenancy are appended to and form " +
      "part of this Agreement. The particulars set out above prevail over any " +
      "conflicting entry elsewhere in it. Where a sum is stated in both " +
      "numerals and words, the words govern.",
    MARGIN,
    y,
    RIGHT - MARGIN,
    { size: 10 },
  );
  y += LINE * 1.4;

  signature(page, y + LINE * 2, MARGIN, "Tenant", tenancy.tenantName);
  signature(
    page,
    y + LINE * 2,
    MARGIN + 74 * PT_PER_MM,
    "For and on behalf of the Landlord",
    tenancy.agentName || landlord,
  );

  const content = page.stream();
  return pdfBlob(
    assemble([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} 841.89] ` +
        `/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>",
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ]),
  );
}
