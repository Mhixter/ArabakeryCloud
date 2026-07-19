/**
 * local-db.ts
 * Dexie (IndexedDB) local database for offline-first data persistence.
 * Mirrors key server tables so the app can function without network access.
 */
import Dexie, { type Table } from "dexie";

/* ── Table shapes ── */
export interface LocalProduct {
  id: number;
  name: string;
  description: string | null;
  pricePerUnit: number;
  unit: string;
  isActive: boolean;
  branchId?: number | null;
  _savedAt: number;
}

export interface LocalInventoryItem {
  id: number;
  name: string;
  category: string;
  unit: string;
  currentQuantity: number;
  minimumQuantity: number;
  costPerUnit: number;
  branchId: number;
  branchName: string;
  isLowStock: boolean;
  _savedAt: number;
}

export interface LocalSale {
  id: number;
  breadType: string;
  quantity: number;
  totalAmount: number;
  paymentMethod: string;
  saleDate: string;
  receiptNumber: string;
  branchId?: number | null;
  _savedAt: number;
}

export interface LocalExpense {
  id: number;
  note: string;
  amount: string;
  expenseDate: string;
  categoryName: string | null;
  workerName: string | null;
  branchId: number | null;
  branchName: string | null;
  _savedAt: number;
}

export interface LocalAllocation {
  id: number;
  breadType: string;
  quantity: number;
  issuedByName: string;
  allocationDate: string;
  branchId?: number | null;
  _savedAt: number;
}

export interface LocalBranch {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  companyId: number;
  _savedAt: number;
}

export interface LocalUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  branchId: number | null;
  branchName?: string;
  companyId: number;
  _savedAt: number;
}

export interface LocalProduction {
  id: number;
  breadType: string;
  quantityProduced: number;
  wasteQuantity: number;
  productionDate: string;
  staffName?: string;
  branchName?: string;
  notes?: string | null;
  branchId?: number | null;
  _savedAt: number;
}

export interface LocalReturn {
  id: number;
  breadType: string;
  quantity: number;
  reason: string;
  reasonLabel: string;
  returnDate: string;
  status: string;
  branchId?: number | null;
  _savedAt: number;
}

export interface OfflineSession {
  id?: number;
  username: string;
  passwordHash: string;
  salt: string;
  userData: string; // JSON stringified user + company + token info
  savedAt: number;
}

export interface SyncMeta {
  key: string;
  value: string | number;
}

/** Generic blob cache for arbitrary API responses */
export interface ApiCache {
  cacheKey: string;
  data: string; // JSON stringified response
  savedAt: number;
}

/* ── Database class ── */
class LocalDatabase extends Dexie {
  products!: Table<LocalProduct, number>;
  inventory!: Table<LocalInventoryItem, number>;
  sales!: Table<LocalSale, number>;
  expenses!: Table<LocalExpense, number>;
  allocations!: Table<LocalAllocation, number>;
  branches!: Table<LocalBranch, number>;
  users!: Table<LocalUser, number>;
  production!: Table<LocalProduction, number>;
  returns!: Table<LocalReturn, number>;
  offlineSessions!: Table<OfflineSession, number>;
  syncMeta!: Table<SyncMeta, string>;
  apiCache!: Table<ApiCache, string>;

  constructor() {
    super("nmb-local-db");

    this.version(1).stores({
      products:        "id, name, isActive, branchId, _savedAt",
      inventory:       "id, name, category, branchId, isLowStock, _savedAt",
      sales:           "id, saleDate, branchId, paymentMethod, _savedAt",
      expenses:        "id, expenseDate, branchId, _savedAt",
      allocations:     "id, allocationDate, branchId, _savedAt",
      branches:        "id, companyId, _savedAt",
      users:           "id, username, role, companyId, _savedAt",
      production:      "id, productionDate, branchId, _savedAt",
      returns:         "id, returnDate, status, branchId, _savedAt",
      offlineSessions: "++id, username, savedAt",
      syncMeta:        "key",
      apiCache:        "cacheKey, savedAt",
    });
  }
}

export const localDb = new LocalDatabase();

/* ── Sync metadata helpers ── */
export async function getLastSyncTime(): Promise<number | null> {
  try {
    const row = await localDb.syncMeta.get("lastSyncAt");
    return row ? Number(row.value) : null;
  } catch {
    return null;
  }
}

export async function setLastSyncTime(ts: number = Date.now()): Promise<void> {
  try {
    await localDb.syncMeta.put({ key: "lastSyncAt", value: ts });
  } catch {
    // ignore
  }
}

/* ── Generic API cache helpers ── */
export async function getCachedApiResponse<T>(cacheKey: string): Promise<T | null> {
  try {
    const row = await localDb.apiCache.get(cacheKey);
    if (!row) return null;
    return JSON.parse(row.data) as T;
  } catch {
    return null;
  }
}

export async function setCachedApiResponse(cacheKey: string, data: unknown): Promise<void> {
  try {
    await localDb.apiCache.put({ cacheKey, data: JSON.stringify(data), savedAt: Date.now() });
  } catch {
    // ignore
  }
}

/* ── Bulk upsert helpers ── */
const now = () => Date.now();

export async function saveProducts(items: Omit<LocalProduct, "_savedAt">[]): Promise<void> {
  if (!items.length) return;
  try {
    await localDb.products.bulkPut(items.map(i => ({ ...i, _savedAt: now() })));
  } catch { /* ignore */ }
}

export async function saveInventory(items: Omit<LocalInventoryItem, "_savedAt">[]): Promise<void> {
  if (!items.length) return;
  try {
    await localDb.inventory.bulkPut(items.map(i => ({ ...i, _savedAt: now() })));
  } catch { /* ignore */ }
}

export async function saveSales(items: Omit<LocalSale, "_savedAt">[]): Promise<void> {
  if (!items.length) return;
  try {
    await localDb.sales.bulkPut(items.map(i => ({ ...i, _savedAt: now() })));
  } catch { /* ignore */ }
}

export async function saveExpenses(items: Omit<LocalExpense, "_savedAt">[]): Promise<void> {
  if (!items.length) return;
  try {
    await localDb.expenses.bulkPut(items.map(i => ({ ...i, _savedAt: now() })));
  } catch { /* ignore */ }
}

export async function saveAllocations(items: Omit<LocalAllocation, "_savedAt">[]): Promise<void> {
  if (!items.length) return;
  try {
    await localDb.allocations.bulkPut(items.map(i => ({ ...i, _savedAt: now() })));
  } catch { /* ignore */ }
}

export async function saveBranches(items: Omit<LocalBranch, "_savedAt">[]): Promise<void> {
  if (!items.length) return;
  try {
    await localDb.branches.bulkPut(items.map(i => ({ ...i, _savedAt: now() })));
  } catch { /* ignore */ }
}

export async function saveUsers(items: Omit<LocalUser, "_savedAt">[]): Promise<void> {
  if (!items.length) return;
  try {
    await localDb.users.bulkPut(items.map(i => ({ ...i, _savedAt: now() })));
  } catch { /* ignore */ }
}

export async function saveProduction(items: Omit<LocalProduction, "_savedAt">[]): Promise<void> {
  if (!items.length) return;
  try {
    await localDb.production.bulkPut(items.map(i => ({ ...i, _savedAt: now() })));
  } catch { /* ignore */ }
}

export async function saveReturns(items: Omit<LocalReturn, "_savedAt">[]): Promise<void> {
  if (!items.length) return;
  try {
    await localDb.returns.bulkPut(items.map(i => ({ ...i, _savedAt: now() })));
  } catch { /* ignore */ }
}
