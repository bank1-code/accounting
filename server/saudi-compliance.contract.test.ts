import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  companyProfiles,
  customers,
  salesInvoiceLines,
  salesInvoices,
  taxCodes,
  zatcaConnections,
  zatcaSubmissionAttempts,
} from "../drizzle/schema";
import { getZatcaReadinessIssues, getZatcaSubmissionType } from "./zatca-submission";
import { buildZatcaPhaseOneQrPayload, normalizeTaxCodeRate } from "./db";

function expectColumns(table: object, columns: string[]) {
  for (const column of columns) expect(table).toHaveProperty(column);
}

describe("عقود الامتثال السعودي والفوترة", () => {
  it("يحفظ بيانات المنشأة المطلوبة للضريبة والفوترة الإلكترونية", () => {
    expectColumns(companyProfiles, [
      "legalName", "vatNumber", "commercialRegistrationNumber", "countryCode",
      "currencyCode", "isVatRegistered", "eInvoicingMode",
    ]);
  });

  it("يدعم رموز الضريبة والعملاء للأفراد والمنشآت", () => {
    expectColumns(taxCodes, ["code", "category", "rate", "isActive"]);
    expectColumns(customers, ["customerType", "vatNumber", "commercialRegistrationNumber", "countryCode"]);
  });

  it("يفرض معدل VAT متسقاً مع فئة الرمز الضريبي", () => {
    expect(normalizeTaxCodeRate("standard", "15")).toBe("15.00");
    expect(normalizeTaxCodeRate("zero_rated", "0")).toBe("0.00");
    expect(normalizeTaxCodeRate("exempt", "0")).toBe("0.00");
    expect(() => normalizeTaxCodeRate("standard", "0")).toThrow("Standard tax code must have a positive rate");
    expect(() => normalizeTaxCodeRate("zero_rated", "15")).toThrow("must have a zero rate");
    expect(() => normalizeTaxCodeRate("out_of_scope", "101")).toThrow("Tax code rate must be between 0 and 100");
  });

  it("يحافظ على بيانات الفاتورة وبنودها اللازمة للتتبع والتكامل", () => {
    expectColumns(salesInvoices, [
      "invoiceUuid", "invoiceNumber", "invoiceType", "issueDate", "currencyCode",
      "subtotalAmount", "taxAmount", "totalAmount", "invoiceHash", "qrPayload", "complianceStatus",
    ]);
    expectColumns(salesInvoiceLines, [
      "invoiceId", "productId", "quantity", "unitPrice", "taxRate", "taxAmount", "lineTotal",
    ]);
  });

  it("يوثق حالة اتصال زاتكا ومحاولات الإرسال دون تخزين الأسرار", () => {
    expectColumns(zatcaConnections, ["companyProfileId", "environment", "status", "credentialReference", "csidReference", "lastVerifiedAt", "lastError"]);
    expectColumns(zatcaSubmissionAttempts, ["salesInvoiceId", "submissionType", "status", "attemptNumber", "requestId", "responseSummary"]);
  });

  it("يوجه الفواتير المبسطة إلى Reporting والقياسية إلى Clearance", () => {
    expect(getZatcaSubmissionType("simplified")).toBe("reporting");
    expect(getZatcaSubmissionType("tax")).toBe("clearance");
    expect(getZatcaSubmissionType("credit_note")).toBe("clearance");
  });

  it("لا يعد الربط جاهزاً قبل اكتمال بيانات المنشأة والاتصال", () => {
    expect(getZatcaReadinessIssues({ legalName: "دكتره", isVatRegistered: true, eInvoicingMode: "sandbox", connectionStatus: "ready" })).toContain("vat_number_missing");
    expect(getZatcaReadinessIssues({ legalName: "دكتره", vatNumber: "300000000000003", isVatRegistered: true, eInvoicingMode: "sandbox", connectionStatus: "ready" })).toEqual([]);
  });

  it("يبني QR TLV بالحقول الخمسة الأساسية لزاتكا دون كشف أي بيانات اعتماد", () => {
    const issueDate = new Date("2026-08-16T12:30:00.000Z");
    const bytes = Buffer.from(buildZatcaPhaseOneQrPayload({ sellerName: "دكتره", vatNumber: "300000000000003", issueDate, totalAmount: "115.00", taxAmount: "15.00" }), "base64");
    const fields: Array<[number, string]> = [];
    for (let offset = 0; offset < bytes.length;) {
      const tag = bytes[offset++]; const length = bytes[offset++];
      fields.push([tag, bytes.subarray(offset, offset + length).toString("utf8")]); offset += length;
    }
    expect(fields).toEqual([[1, "دكتره"], [2, "300000000000003"], [3, issueDate.toISOString()], [4, "115.00"], [5, "15.00"]]);
  });

  it("يعرض واجهة QR المحفوظ للمرحلة الأولى مع توضيح شرط الشهادة الرسمية", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/admin/SaudiCompliance.tsx"), "utf8");
    expect(page).toContain('import QRCode from "qrcode"');
    expect(page).toContain("عرض QR");
    expect(page).toContain("حمولة TLV للمرحلة الأولى من زاتكا");
    expect(page).toContain("التوقيع الرسمي فيستلزم شهادة بيئة زاتكا");
  });
});
