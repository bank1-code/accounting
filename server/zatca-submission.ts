export type ZatcaInvoiceType = "simplified" | "tax" | "credit_note" | "debit_note";
export type ZatcaSubmissionType = "reporting" | "clearance";

export function getZatcaSubmissionType(invoiceType: ZatcaInvoiceType): ZatcaSubmissionType {
  return invoiceType === "simplified" ? "reporting" : "clearance";
}

export function getZatcaReadinessIssues(input: {
  legalName?: string | null;
  vatNumber?: string | null;
  isVatRegistered: boolean;
  eInvoicingMode: "disabled" | "sandbox" | "production";
  connectionStatus?: "not_configured" | "ready" | "testing" | "active" | "error" | "suspended" | null;
}) {
  const issues: string[] = [];
  if (!input.legalName?.trim()) issues.push("company_legal_name_missing");
  if (input.isVatRegistered && !input.vatNumber?.trim()) issues.push("vat_number_missing");
  if (input.eInvoicingMode === "disabled") issues.push("e_invoicing_disabled");
  if (!input.connectionStatus || ["not_configured", "error", "suspended"].includes(input.connectionStatus)) issues.push("zatca_connection_not_ready");
  return issues;
}
