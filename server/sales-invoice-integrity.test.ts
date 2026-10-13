import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildZatcaPhaseOneQrPayload, calculateSalesInvoiceSourceTotals, issueSalesInvoiceFromOrder } from "./db";

describe("نزاهة الفاتورة الضريبية", () => {
  const source = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

  it("لا يصدر الفاتورة إلا لطلب مدفوع ومن الفرع نفسه", () => {
    expect(source).toContain("A sales invoice can only be issued for a paid order");
    expect(source).toContain("Invoice branch must match the order branch");
  });

  it("يمنع إصدار فاتورتين لنفس الطلب ويحفظ الرأس والبنود ذرياً قبل وضعها في طابور زاتكا", () => {
    expect(source).toContain("A sales invoice already exists for this order");
    expect(source).toContain('const invoiceNumber = `INV-${String(order.id).padStart(8, "0")}`');
    expect(source).toContain("await tx.insert(salesInvoiceLines).values");
    expect(source).toContain("await queueZatcaSubmission(issued.id)");
  });

  it("ينقل رمز ومعدل ومبلغ ضريبة بند POS المحفوظ ويمنع اختلاف إجمالي المصدر", () => {
    expect(source).toContain("const taxRate = Number(line.taxRate)");
    expect(source).toContain("const taxAmount = Number(line.taxAmount)");
    expect(source).toContain("taxCodeId: line.taxCodeId");
    expect(source).toContain("Order tax totals do not match stored invoice source data");
    expect(source).not.toContain("const taxRate = Number(product?.taxRate ?? 15)");
  });

  it("يتحقق حسابياً من إجمالي طلب POS وضريبته قبل إصدار الفاتورة ورمز QR", () => {
    const totals = calculateSalesInvoiceSourceTotals([
      { quantity: "2", unitPrice: "50.00", discountAmount: "10.00", taxRate: "15.00", taxAmount: "13.50" },
      { quantity: "1", unitPrice: "20.00", discountAmount: "0.00", taxRate: "0.00", taxAmount: "0.00" },
    ]);
    expect(totals).toEqual({ subtotalAmount: 120, discountAmount: 10, taxAmount: 13.5, totalAmount: 123.5 });
    const qr = buildZatcaPhaseOneQrPayload({ sellerName: "دكتره", vatNumber: "300000000000003", issueDate: new Date("2026-08-19T00:00:00.000Z"), totalAmount: totals.totalAmount.toFixed(2), taxAmount: totals.taxAmount.toFixed(2) });
    expect(Buffer.from(qr, "base64").toString("utf8")).toContain("123.50");
    expect(() => calculateSalesInvoiceSourceTotals([{ quantity: "1", unitPrice: "20", discountAmount: "25", taxRate: "15", taxAmount: "0" }])).toThrow("discount exceeds");
  });

  it("يصدر فاتورة ضريبية من طلب POS مدفوع وينقل الضريبة إلى البند والـQR وطابور زاتكا دون بيانات تشغيلية", async () => {
    let header: Record<string, unknown> | undefined;
    let invoiceLines: Array<Record<string, unknown>> = [];
    const queued: number[] = [];
    const issued = await issueSalesInvoiceFromOrder({ orderId: 801, branchId: 7, invoiceType: "simplified", createdBy: 9 }, {
      getCompanyProfile: async () => ({ legalName: "دكتره", vatNumber: "300000000000003", currencyCode: "SAR" }),
      getOrder: async () => ({ id: 801, status: "paid", branchId: 7, taxAmount: "15.00", totalAmount: "115.00" }),
      hasExistingInvoice: async () => false,
      listOrderLines: async () => [{ productId: 31, quantity: "1", unitPrice: "100.00", discountAmount: "0.00", taxCodeId: 6, taxRate: "15.00", taxAmount: "15.00" }],
      getProducts: async () => [{ id: 31, name: "صنف ضريبي" }],
      createInvoice: async (invoice) => { header = invoice; return 91; },
      createInvoiceLines: async (lines) => { invoiceLines = lines; },
      queueZatcaSubmission: async (id) => { queued.push(id); },
    });
    expect(issued).toMatchObject({ id: 91, invoiceNumber: "INV-00000801", totalAmount: "115.00" });
    expect(header).toMatchObject({ status: "issued", subtotalAmount: "100.00", taxAmount: "15.00", totalAmount: "115.00", currencyCode: "SAR" });
    expect(Buffer.from(String(header?.qrPayload), "base64").toString("utf8")).toContain("115.00");
    expect(invoiceLines).toEqual([expect.objectContaining({ invoiceId: 91, productId: 31, taxCodeId: 6, taxRate: "15.00", taxAmount: "15.00", lineTotal: "115.00" })]);
    expect(queued).toEqual([91]);
  });
});
