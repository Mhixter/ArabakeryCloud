import assert from "node:assert/strict";
import test from "node:test";
import {
  isIdentityReviewType,
  isSelectableIdentityProduct,
  isUnresolvedIdentityReviewRow,
  isValidIdentityCandidate,
} from "./reports";

const candidate = (overrides: Partial<{
  id: number;
  name: string;
  branchId: number | null;
  companyId: number;
  isActive: boolean;
}> = {}) => ({
  id: 1,
  name: "Standard White Loaf",
  branchId: 7,
  companyId: 10,
  isActive: true,
  ...overrides,
});

test("the review API recognizes every historical transaction type", () => {
  for (const type of ["production", "sale", "allocation", "return"]) {
    assert.equal(isIdentityReviewType(type), true);
  }
  assert.equal(isIdentityReviewType("expense"), false);
});

test("identity candidates require the same company, active status, name, and branch", () => {
  const valid = candidate();
  assert.equal(isValidIdentityCandidate(valid, " standard white loaf ", 7, 10), true);

  assert.equal(isValidIdentityCandidate(candidate({ companyId: 11 }), "Standard White Loaf", 7, 10), false);
  assert.equal(isValidIdentityCandidate(candidate({ isActive: false }), "Standard White Loaf", 7, 10), false);
  assert.equal(isValidIdentityCandidate(candidate({ name: "Agege Bread" }), "Standard White Loaf", 7, 10), false);
  assert.equal(isValidIdentityCandidate(candidate({ branchId: 8 }), "Standard White Loaf", 7, 10), false);
});

test("company-wide products are valid for a branch transaction, while branchless rows stay branchless", () => {
  assert.equal(
    isValidIdentityCandidate(candidate({ branchId: null }), "Standard White Loaf", 7, 10),
    true,
  );
  assert.equal(
    isValidIdentityCandidate(candidate({ branchId: null }), "Standard White Loaf", null, 10),
    true,
  );
  assert.equal(
    isValidIdentityCandidate(candidate({ branchId: 7 }), "Standard White Loaf", null, 10),
    false,
  );
});

test("listing omits resolved rows and resolution accepts only an offered product", () => {
  assert.equal(isUnresolvedIdentityReviewRow(null), true);
  assert.equal(isUnresolvedIdentityReviewRow(42), false);

  const selectedId = 9;
  const candidates = [candidate({ id: selectedId })];

  assert.equal(candidates.some(item => item.id === selectedId), true);
  assert.equal(candidates.some(item => item.id === 99), false);
  assert.equal(isSelectableIdentityProduct(selectedId, candidates.map(item => item.id)), true);
  assert.equal(isSelectableIdentityProduct(99, candidates.map(item => item.id)), false);
});

test("all four review types use the same unresolved-row contract", () => {
  for (const type of ["production", "sale", "allocation", "return"]) {
    assert.equal(isIdentityReviewType(type), true);
    assert.equal(isUnresolvedIdentityReviewRow(null), true);
    assert.equal(isUnresolvedIdentityReviewRow(123), false);
  }
});