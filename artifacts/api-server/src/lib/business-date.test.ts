import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_TIMEZONE,
  businessDateFor,
  businessDateRange,
  queryDateRange,
} from "./business-date";

const BUSINESS_DATE = "2026-08-21";

test("business day boundaries are the exact inclusive Africa/Lagos range", () => {
  const { start, end } = businessDateRange(BUSINESS_DATE);

  assert.equal(BUSINESS_TIMEZONE, "Africa/Lagos");
  assert.equal(start.toISOString(), "2026-08-20T23:00:00.000Z");
  assert.equal(end.toISOString(), "2026-08-21T22:59:59.999Z");

  assert.equal(businessDateFor(new Date(start.getTime() - 1)), "2026-08-20");
  assert.equal(businessDateFor(start), BUSINESS_DATE);
  assert.equal(businessDateFor(end), BUSINESS_DATE);
  assert.equal(businessDateFor(new Date(end.getTime() + 1)), "2026-08-22");
});

test("date-only API filters include both boundary instants", () => {
  const startRange = queryDateRange(BUSINESS_DATE);
  const endRange = queryDateRange(BUSINESS_DATE);
  const justBeforeStart = new Date("2026-08-20T22:59:59.999Z");
  const exactStart = new Date("2026-08-20T23:00:00.000Z");
  const exactEnd = new Date("2026-08-21T22:59:59.999Z");
  const justAfterEnd = new Date("2026-08-21T23:00:00.000Z");

  assert.equal(exactStart >= startRange.start && exactStart <= endRange.end, true);
  assert.equal(exactEnd >= startRange.start && exactEnd <= endRange.end, true);
  assert.equal(justBeforeStart >= startRange.start, false);
  assert.equal(justAfterEnd <= endRange.end, false);
});

test("records around UTC midnight keep the same Lagos business date across reports", () => {
  const nearMidnightRecords = [
    { kind: "sale", recordedAt: new Date("2026-08-20T23:59:59.999Z") },
    { kind: "production", recordedAt: new Date("2026-08-21T00:00:00.001Z") },
  ];

  assert.deepEqual(
    nearMidnightRecords.map(record => businessDateFor(record.recordedAt)),
    [BUSINESS_DATE, BUSINESS_DATE],
  );

  const { start, end } = businessDateRange(BUSINESS_DATE);
  for (const record of nearMidnightRecords) {
    assert.equal(record.recordedAt >= start && record.recordedAt <= end, true);
  }
});

test("timestamp query values preserve their instant instead of becoming calendar ranges", () => {
  const timestamp = "2026-08-21T00:00:00.001Z";
  const range = queryDateRange(timestamp);

  assert.equal(range.start.toISOString(), timestamp);
  assert.equal(range.end.toISOString(), timestamp);
});