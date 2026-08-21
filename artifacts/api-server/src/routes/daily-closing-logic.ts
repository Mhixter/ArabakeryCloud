export type ClosingStatus = "draft" | "submitted" | "approved";

export interface ClosingLineInput {
  productName: string;
  openingStock: number;
  produced: number;
  returned: number;
  allocated: number;
  recordedSales: number;
  closingStock: number;
  varianceReason?: string | null;
}

export interface ClosingLineCalculation {
  closingStock: number;
  calculatedSales: number;
  variance: number;
  varianceReason: string | null;
}

export interface SaleForClosing {
  breadType: string;
  quantity: number;
}

export function isDirectStoreSale(sale: SaleForClosing, cashierRole?: string | null): boolean {
  return cashierRole !== "supplier" && sale.breadType.trim().toLowerCase() !== "quick sale";
}

export function calculateClosingLine(line: ClosingLineInput): ClosingLineCalculation {
  const closingStock = Math.max(0, Number.parseInt(String(line.closingStock), 10) || 0);
  const calculatedSales = line.openingStock + line.produced + line.returned - line.allocated - closingStock;
  return {
    closingStock,
    calculatedSales,
    variance: calculatedSales - line.recordedSales,
    varianceReason: line.varianceReason && String(line.varianceReason).trim()
      ? String(line.varianceReason).trim()
      : null,
  };
}

export function validateSubmission(lines: Array<ClosingLineInput & { id?: number }>): string | null {
  for (const line of lines) {
    const calculation = calculateClosingLine(line);
    if (calculation.variance !== 0 && !calculation.varianceReason) {
      return `A reason is required for the ${line.productName} variance`;
    }
  }
  return null;
}

export function canEditClosing(status: ClosingStatus): boolean {
  return status === "draft";
}

export function nextClosingStatus(currentStatus: ClosingStatus, submit: boolean): ClosingStatus {
  if (!canEditClosing(currentStatus)) {
    throw new Error("Only draft closings can be edited");
  }
  return submit ? "submitted" : "draft";
}

export function canApproveClosing(status: ClosingStatus): boolean {
  return status === "submitted";
}

export function hasClosingForDate(
  closings: Array<{ companyId: number; branchId: number; businessDate: string }>,
  companyId: number,
  branchId: number,
  businessDate: string,
): boolean {
  return closings.some(closing =>
    closing.companyId === companyId &&
    closing.branchId === branchId &&
    closing.businessDate === businessDate,
  );
}

export function latestPriorClosingLine<T extends {
  companyId: number;
  branchId: number;
  businessDate: string;
  status: ClosingStatus;
  line: { productName: string; closingStock: number };
}>(
  rows: T[],
  companyId: number,
  branchId: number,
  productName: string,
  businessDate: string,
): T["line"] | undefined {
  return rows
    .filter(row =>
      row.companyId === companyId &&
      row.branchId === branchId &&
      row.businessDate < businessDate &&
      (row.status === "submitted" || row.status === "approved") &&
      row.line.productName.trim().toLowerCase() === productName.trim().toLowerCase(),
    )
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))[0]?.line;
}