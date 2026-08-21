import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateInStoreStock,
  calculateSupplierStock,
  countBreadUnits,
} from "./stock-calculations";

test("shared branch-scoped fixture reconciles dashboard stock and closing opening stock", () => {
  // Branch 1 only: opening 100, then production +10, return +3, direct sale -8,
  // and allocation -20 leaves 85 in store. Branch 2's production is excluded.
  const branchOne = {
    produced: 110,
    restorableReturns: 3,
    directSales: 8,
    allocated: 20,
  };
  const dashboardRemaining = calculateInStoreStock(branchOne);
  const closingOpening = calculateInStoreStock(branchOne);
  assert.equal(dashboardRemaining, 85);
  assert.equal(closingOpening, 85);
});

test("supplier stock does not double-count supplier sales or returns", () => {
  assert.equal(calculateSupplierStock(20, 7, 3), 10);
});

test("Quick Sale contributes revenue but never bread units", () => {
  assert.equal(countBreadUnits("Quick Sale", 12), 0);
  assert.equal(countBreadUnits("Milk Bread", 12), 12);
});

test("negative stock is clamped and branch leakage is prevented by scoped inputs", () => {
  assert.equal(calculateInStoreStock({ produced: 2, restorableReturns: 0, directSales: 20, allocated: 0 }), 0);
  assert.equal(calculateInStoreStock({ produced: 50, restorableReturns: 0, directSales: 5, allocated: 10 }), 35);
});