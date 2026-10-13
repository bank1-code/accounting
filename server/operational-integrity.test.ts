import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as db from "./db";

const source = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

describe("النزاهة التشغيلية للمخزون والمشتريات", () => {
  it("يستخدم محرك حركة المخزون معاملة ذرية ويمنع الرصيد السالب ويحدث التكلفة المرجحة", () => {
    expect(source).toContain("async function applyStockMovement");
    expect(source).toContain("Insufficient stock for this movement");
    expect(source).toContain("currentQuantity * currentCost");
    expect(source).toContain("await db.transaction(async (tx) => applyStockMovement(tx, data))");
  });

  it("لا يستلم فاتورة الشراء إلا مرة واحدة، ويسجل بنودها كمصدر حركة المخزون", () => {
    expect(source).toContain("Purchase invoice cannot be received in its current status");
    expect(source).toContain('referenceType: "purchase_invoice"');
    expect(source).toContain('eq(purchaseInvoices.status, "draft")');
    expect(source).toContain("Supplier invoice number already exists");
  });

  it("يثبت رقم الدفعة وتاريخ الصلاحية من الفاتورة في حركة الاستلام ورصيد الدفعات", () => {
    const expiryDate = new Date("2026-12-31T00:00:00.000Z");
    expect(db.buildPurchaseReceiptStockMovement({
      invoiceId: 71,
      invoiceNumber: "PI-71",
      warehouseId: 8,
      approvedBy: 3,
      line: { productId: 22, quantity: "5", unitPrice: "12.50", batchNumber: "LOT-71", expiryDate },
    })).toMatchObject({
      productId: 22,
      warehouseId: 8,
      type: "purchase",
      referenceType: "purchase_invoice",
      referenceId: 71,
      batchNumber: "LOT-71",
      expiryDate,
    });
    expect(source).toContain("buildPurchaseReceiptStockMovement({ invoiceId: invoice.id");
    expect(source).toContain("batchNumber: line.batchNumber, expiryDate: line.expiryDate");
    expect(source).toContain("type: \"purchase\"");
    expect(source).toContain("applyStockMovement: async (movement) => applyStockMovement(tx, movement)");
    expect(source).toContain("runPurchaseInvoiceItemsApproval(id, approvedBy, notes");
    expect(source).toContain("await applyInventoryBatchBalance(tx, data, isIncoming, signedQuantity, unitCost, product.trackBatch)");
    expect(source).toContain("await tx.insert(inventoryBatches).values({ productId: data.productId");
  });

  it("يعتمد بند فاتورة شراء بدفعة وتاريخ صلاحية ويحوّله إلى حركة استلام ورصيد دفعة في مسار الاعتماد نفسه", async () => {
    const expiryDate = new Date("2026-12-31T00:00:00.000Z");
    const movements: Array<ReturnType<typeof db.buildPurchaseReceiptStockMovement>> = [];
    const batchBalances = new Map<string, number>();
    const invoice = { id: 701, invoiceNumber: "VERIFY-PI-701", warehouseId: 17, status: "draft" };
    const result = await db.approvePurchaseInvoiceItems(701, 9, "verified", {
      getInvoice: async () => invoice,
      listLines: async () => [{ productId: 91, quantity: "5.0000", unitPrice: "12.50", batchNumber: "VERIFY-LOT-701", expiryDate }],
      applyStockMovement: async (movement) => {
        movements.push(movement);
        const key = `${movement.productId}:${movement.warehouseId}:${movement.batchNumber}`;
        batchBalances.set(key, db.calculateBatchBalanceNext(batchBalances.get(key) || 0, movement.quantity, "incoming"));
      },
      markItemsApproved: async () => { invoice.status = "items_approved"; return 1; },
    });
    expect(result).toEqual({ id: 701, receivedLines: 1 });
    expect(movements).toEqual([expect.objectContaining({ type: "purchase", productId: 91, warehouseId: 17, batchNumber: "VERIFY-LOT-701", expiryDate })]);
    expect(batchBalances.get("91:17:VERIFY-LOT-701")).toBe(5);
  });

  it("ينشئ الفاتورة ثم يعتمد البند نفسه ويحافظ على الدفعة وتاريخ الصلاحية في حركة الشراء", async () => {
    const expiryDate = new Date("2026-12-31T00:00:00.000Z");
    let createdInvoice: { id: number; invoiceNumber: string; warehouseId: number; status: string } | undefined;
    let createdLines: Array<{ productId: number; quantity: string; unitPrice: string; batchNumber?: string; expiryDate?: Date }> = [];
    const created = await db.createPurchaseInvoice({
      invoiceNumber: "VERIFY-PI-CREATE-1", supplierId: 41, warehouseId: 17, invoiceDate: new Date("2026-08-20T00:00:00Z"),
      lines: [{ productId: 91, quantity: "5", unitPrice: "12.50", batchNumber: "VERIFY-LOT-CREATE", expiryDate }],
    }, {
      getProducts: async () => [{ id: 91, isActive: true, taxRate: "15.00", taxCodeId: 6 }],
      hasDuplicateInvoice: async () => false,
      createInvoice: async (invoice) => { createdInvoice = { id: 702, invoiceNumber: invoice.invoiceNumber, warehouseId: invoice.warehouseId, status: "draft" }; return 702; },
      createLines: async (lines) => { createdLines = lines; },
    });
    const movements: Array<ReturnType<typeof db.buildPurchaseReceiptStockMovement>> = [];
    await db.approvePurchaseInvoiceItems(created.id, 9, undefined, {
      getInvoice: async () => createdInvoice,
      listLines: async () => createdLines,
      applyStockMovement: async (movement) => { movements.push(movement); },
      markItemsApproved: async () => { if (createdInvoice) createdInvoice.status = "items_approved"; return 1; },
    });
    expect(movements).toEqual([expect.objectContaining({ type: "purchase", batchNumber: "VERIFY-LOT-CREATE", expiryDate, referenceId: 702 })]);
  });

  it("يحدّث سجل inventory_batches الفعلي في محرك الرصيد عند اعتماد استلام فاتورة شراء", async () => {
    const expiryDate = new Date("2026-12-31T00:00:00.000Z");
    const batchRows: Array<Record<string, unknown>> = [];
    let selectCount = 0;
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => {
        selectCount += 1;
        if (selectCount === 1) return []; // رصيد المخزون
        if (selectCount === 2) return [{ id: 92, name: "Product 92", reorderLevel: "0", trackBatch: true }]; // الصنف
        return batchRows; // رصيد الدفعة
      } }) }) }),
      insert: () => ({ values: async (row: Record<string, unknown>) => { if ("batchNumber" in row && !("type" in row)) batchRows.push(row); } }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    };
    const invoice = { id: 703, invoiceNumber: "VERIFY-PI-BATCH", warehouseId: 17, status: "draft" };
    await db.approvePurchaseInvoiceItems(703, 9, undefined, {
      getInvoice: async () => invoice,
      listLines: async () => [{ productId: 92, quantity: "5.0000", unitPrice: "12.50", batchNumber: "VERIFY-LOT-BALANCE", expiryDate }],
      applyStockMovement: async (movement) => db.applyStockMovement(tx, movement),
      markItemsApproved: async () => 1,
    });
    expect(batchRows).toEqual([expect.objectContaining({ productId: 92, warehouseId: 17, batchNumber: "VERIFY-LOT-BALANCE", expiryDate, quantity: "5.0000", unitCost: "12.5000" })]);
  });

  it("يتحقق من الكميات والأسعار ويأخذ رمز ومعدل الضريبة من الصنف قبل إنشاء فاتورة شراء", () => {
    expect(source).toContain("Invalid purchase quantity");
    expect(source).toContain('toCents(l.unitPrice, `purchase price at line ${index + 1}`)');
    expect(source).toContain("Purchase invoice contains an invalid or inactive product");
    expect(source).toContain("Product ${line.productId} has an invalid tax rate");
    expect(source).toContain("taxCodeId: product.taxCodeId");
    expect(source).not.toContain('Number(l.taxRate || "15")');
    expect(source).toContain("Purchase invoice requires at least one line");
  });

  it("يوحد معدل ضريبة الصنف من رمز ضريبي نشط ولا يقبل معدلاً خارج النطاق", () => {
    expect(db.normalizeProductTaxRate("15")).toBe("15.00");
    expect(db.normalizeProductTaxRate("0")).toBe("0.00");
    expect(() => db.normalizeProductTaxRate("100.01")).toThrow("Product tax rate is invalid");
    expect(source).toContain("Product tax code is invalid or inactive");
    expect(source).toContain("await resolveProductTaxCode(tx, data.taxCodeId, data.taxRate)");
  });

  it("يحافظ على معدل الرمز الضريبي الحالي عند تعديل المنتج ويوفر تدقيقاً ومزامنة للسجلات القديمة", () => {
    expect(source).toContain("const effectiveTaxCodeId = taxCodeIsChanging ? data.taxCodeId : current.taxCodeId");
    expect(source).toContain("getProductTaxCodeConsistency");
    expect(source).toContain("synchronizeProductTaxCodeRates");
    expect(source).toContain("Cannot synchronize products with invalid or inactive tax codes");
  });

  it("لا يعتمد حسابات فاتورة الشراء إلا من مرحلة الاستلام وينشئ قيد ضريبة المدخلات المتزن", () => {
    expect(source).toContain('if (!invoice || invoice.status !== "items_approved")');
    expect(source).toContain("POS posting account map must be configured before approving purchase invoice accounts");
    expect(source).toContain('referenceType: "purchase_invoice", referenceId: invoice.id');
    expect(source).toContain("postingMap.inputVatAccountId");
    expect(source).toContain("postingMap.accountsPayableAccountId");
    expect(source).toContain("createPostedOperationalJournalEntry(tx");
  });
});
