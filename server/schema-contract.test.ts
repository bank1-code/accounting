import { describe, expect, it } from "vitest";
import {
  backups,
  documents,
  kitchenOrders,
  inventoryBatches,
  orderPayments,
  orders,
  purchaseInvoiceLines,
  purchaseInvoices,
  purchaseOrderLines,
  purchaseOrders,
  users,
  vouchers,
  voucherLines,
  wasteVouchers,
  wasteVoucherLines,
} from "../drizzle/schema";

function expectColumns(table: object, columns: string[]) {
  for (const column of columns) {
    expect(table).toHaveProperty(column);
  }
}

describe("عقود المخطط الأساسية", () => {
  it("يحافظ على حقول المصادقة المحلية في المستخدمين", () => {
    expectColumns(users, ["id", "username", "passwordHash", "role", "loginMethod"]);
  });

  it("يدعم مستندات المشتريات بدورة كاملة من الطلب إلى الفاتورة", () => {
    expectColumns(purchaseOrders, ["orderNumber", "supplierId", "warehouseId", "taxAmount"]);
    expectColumns(purchaseOrderLines, ["purchaseOrderId", "productId", "receivedQuantity", "totalPrice"]);
    expectColumns(purchaseInvoices, ["invoiceNumber", "poId", "warehouseId", "itemsApprovedBy", "accountsApprovedBy"]);
    expectColumns(purchaseInvoiceLines, ["invoiceId", "productId", "batchNumber", "expiryDate"]);
  });

  it("يدعم تشغيل نقطة البيع والمطبخ دون حقول متعارضة", () => {
    expectColumns(orders, ["branchId", "costCenterId", "cashierId", "subtotal", "taxAmount", "paymentMethod", "paidAmount"]);
    expectColumns(orderPayments, ["orderId", "paymentMethod", "amount", "reference"]);
    expectColumns(kitchenOrders, ["orderId", "orderLineId", "branchId", "startedAt", "completedAt"]);
  });

  it("يحفظ أرصدة الدفعات الحالية لفحص الصلاحية بدقة", () => {
    expectColumns(inventoryBatches, ["productId", "warehouseId", "batchNumber", "expiryDate", "quantity", "unitCost"]);
  });

  it("يدعم السندات والمستندات والنسخ الاحتياطية بالحقول المتفق عليها", () => {
    expectColumns(vouchers, ["voucherNumber", "voucherType", "journalEntryId", "status"]);
    expectColumns(voucherLines, ["voucherId", "accountId", "costCenterId", "amount"]);
    expectColumns(documents, ["name", "fileUrl", "fileKey", "mimeType", "fileSize"]);
    expectColumns(backups, ["name", "fileKey", "fileSize", "tablesCount", "recordsCount", "status"]);
  });

  it("يدعم إذن توالف متعدد البنود بحالات اعتماد مستقلة", () => {
    expectColumns(wasteVouchers, ["voucherNumber", "warehouseId", "status", "reason", "createdBy", "approvedBy", "approvedAt", "cancelledAt"]);
    expectColumns(wasteVoucherLines, ["voucherId", "productId", "quantity", "unitCost", "notes"]);
  });
});
