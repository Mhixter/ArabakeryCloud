import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateClosingLine,
  canApproveClosing,
  canEditClosing,
  hasClosingForDate,
  isDirectStoreSale,
  latestPriorClosingLine,
  nextClosingStatus,
  validateSubmission,
} from "./daily-closing-logic";

test("stock reconciliation uses opening + production + returns - allocations - closing stock", () => {
  assert.deepEqual(calculateClosingLine({
    productName: "Milk Bread",
    openingStock: 10,
    produced: 30,
    returned: 2,
    allocated: 5,
    recordedSales: 25,
    closingStock: 8,
  }), {
    closingStock: 8,
    calculatedSales: 29,
    variance: 4,
    varianceReason: null,
  });
});

test("closing stock cannot be negative and variance reasons are trimmed", () => {
  const line = calculateClosingLine({
    productName: "Buns",
    openingStock: 4,
    produced: 0,
    returned: 0,
    allocated: 0,
    recordedSales: 4,
    closingStock: -3,
    varianceReason: "  damaged during display  ",
  });
  assert.equal(line.closingStock, 0);
  assert.equal(line.calculatedSales, 4);
  assert.equal(line.varianceReason, "damaged during display");
});

test("submission requires a reason only when a line has a variance", () => {
  const line = {
    productName: "Milk Bread",
    openingStock: 10,
    produced: 30,
    returned: 0,
    allocated: 0,
    recordedSales: 35,
    closingStock: 4,
  };
  assert.equal(validateSubmission([line]), "A reason is required for the Milk Bread variance");
  assert.equal(validateSubmission([{ ...line, varianceReason: "one damaged loaf" }]), null);
  assert.equal(validateSubmission([{ ...line, recordedSales: 35, closingStock: 4, varianceReason: null }]), "A reason is required for the Milk Bread variance");
  assert.equal(validateSubmission([{ ...line, recordedSales: 35, closingStock: 5 }]), null);
});

test("draft save and submission transitions are explicit, approval requires submitted", () => {
  assert.equal(canEditClosing("draft"), true);
  assert.equal(canEditClosing("submitted"), false);
  assert.equal(nextClosingStatus("draft", false), "draft");
  assert.equal(nextClosingStatus("draft", true), "submitted");
  assert.equal(canApproveClosing("submitted"), true);
  assert.equal(canApproveClosing("draft"), false);
  assert.equal(canApproveClosing("approved"), false);
  assert.throws(() => nextClosingStatus("approved", false), /Only draft closings can be edited/);
});

test("duplicate prevention is scoped to company, branch, and business date", () => {
  const closings = [
    { companyId: 1, branchId: 10, businessDate: "2026-08-21" },
    { companyId: 1, branchId: 11, businessDate: "2026-08-21" },
  ];
  assert.equal(hasClosingForDate(closings, 1, 10, "2026-08-21"), true);
  assert.equal(hasClosingForDate(closings, 1, 10, "2026-08-20"), false);
  assert.equal(hasClosingForDate(closings, 1, 11, "2026-08-21"), true);
  assert.equal(hasClosingForDate(closings, 2, 10, "2026-08-21"), false);
});

test("prior stock ignores other branches, future dates, drafts, and other products", () => {
  const rows = [
    { companyId: 1, branchId: 10, businessDate: "2026-08-20", status: "approved" as const, line: { productName: "Milk Bread", closingStock: 7 } },
    { companyId: 1, branchId: 10, businessDate: "2026-08-19", status: "submitted" as const, line: { productName: "Milk Bread", closingStock: 9 } },
    { companyId: 1, branchId: 11, businessDate: "2026-08-20", status: "approved" as const, line: { productName: "Milk Bread", closingStock: 99 } },
    { companyId: 1, branchId: 10, businessDate: "2026-08-22", status: "approved" as const, line: { productName: "Milk Bread", closingStock: 88 } },
    { companyId: 1, branchId: 10, businessDate: "2026-08-20", status: "draft" as const, line: { productName: "Milk Bread", closingStock: 77 } },
    { companyId: 1, branchId: 10, businessDate: "2026-08-20", status: "approved" as const, line: { productName: "Buns", closingStock: 44 } },
  ];
  assert.deepEqual(latestPriorClosingLine(rows, 1, 10, " milk bread ", "2026-08-21"), rows[0].line);
});

test("supplier sales and amount-only quick sales are not direct store product sales", () => {
  assert.equal(isDirectStoreSale({ breadType: "Milk Bread", quantity: 3 }, "supplier"), false);
  assert.equal(isDirectStoreSale({ breadType: "Quick Sale", quantity: 1 }, "manager"), false);
  assert.equal(isDirectStoreSale({ breadType: " quick sale ", quantity: 1 }, "manager"), false);
  assert.equal(isDirectStoreSale({ breadType: "Milk Bread", quantity: 3 }, "manager"), true);
});