export type StockFlow = {
  produced: number;
  restorableReturns: number;
  directSales: number;
  allocated: number;
};

export function isQuickSale(breadType: string) {
  return breadType.trim().toLowerCase() === "quick sale";
}

export function calculateInStoreStock(flow: StockFlow) {
  return Math.max(0, flow.produced + flow.restorableReturns - flow.directSales - flow.allocated);
}

export function calculateSupplierStock(allocated: number, supplierSales: number, approvedReturns: number) {
  return Math.max(0, allocated - supplierSales - approvedReturns);
}

export function countBreadUnits(breadType: string, quantity: number) {
  return isQuickSale(breadType) ? 0 : quantity;
}