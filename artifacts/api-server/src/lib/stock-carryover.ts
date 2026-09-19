import { db, dailyClosingLinesTable, dailyClosingsTable } from "@workspace/db";
import { and, desc, eq, or, sql } from "drizzle-orm";

export function closingProductKey(productId: number | null | undefined, productName: string) {
  return productId != null
    ? `product:${productId}`
    : `legacy:${productName.trim().toLowerCase()}`;
}

/**
 * Returns the most recent submitted/approved physical closing per product
 * before the selected business date. These closing counts are the opening
 * stock carried into that date.
 */
export async function latestPriorClosingStock(
  companyId: number,
  branchId: number,
  businessDate: string,
) {
  const rows = await db
    .select({ line: dailyClosingLinesTable, closing: dailyClosingsTable })
    .from(dailyClosingLinesTable)
    .innerJoin(dailyClosingsTable, eq(dailyClosingLinesTable.closingId, dailyClosingsTable.id))
    .where(and(
      eq(dailyClosingsTable.companyId, companyId),
      eq(dailyClosingsTable.branchId, branchId),
      sql`${dailyClosingsTable.businessDate} < ${businessDate}`,
      or(eq(dailyClosingsTable.status, "submitted"), eq(dailyClosingsTable.status, "approved")),
    ))
    .orderBy(desc(dailyClosingsTable.businessDate), desc(dailyClosingLinesTable.id));

  const result = new Map<string, number>();
  for (const { line } of rows) {
    const key = closingProductKey(line.productId, line.productName);
    if (!result.has(key)) result.set(key, Math.max(0, line.closingStock));
  }
  return result;
}