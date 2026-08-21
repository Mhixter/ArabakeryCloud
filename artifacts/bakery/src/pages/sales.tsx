import { useState, useEffect } from "react";
import {
  useListSales, useCreateSale, useListBranches,
  getListSalesQueryKey, getGetDailySalesSummaryQueryKey,
} from "@workspace/api-client-react";
import { useActiveBranch } from "@/lib/branch-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getStoredUser, getStoredCompany, getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Printer, ShoppingCart, TrendingUp, Download, Receipt, FileText, Clock } from "lucide-react";
import { generatePdf, fmtCurrency as pdfFmt } from "@/lib/pdf";
import { useSubscription } from "@/components/subscription-guard";
import { format } from "date-fns";
import { API_BASE } from "@/lib/api";

/** Per-user, per-branch receipt storage — prevents receipts leaking between users or branches */
function getSlipsKey(branchId?: number | null): string {
  try {
    const raw = localStorage.getItem("nmb_user");
    const user = raw ? JSON.parse(raw) : null;
    const branchSuffix = branchId ? `_b${branchId}` : "";
    if (user?.companyId && user?.id) return `nmb_slips_${user.companyId}_${user.id}${branchSuffix}`;
    if (user?.companyId) return `nmb_slips_${user.companyId}${branchSuffix}`;
    return "nmb_slips";
  } catch { return "nmb_slips"; }
}

const ROLE_LABELS: Record<string, string> = {
  supplier: "Supplier",
  receptionist: "Receptionist",
  manager: "Manager",
  managing_director: "Director",
  production_staff: "Production",
};

function formatCurrency(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface ReceiptData {
  id?: number;
  receiptNumber: string;
  breadType: string;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  paymentMethod: string;
  cashierName: string;
  cashierRole?: string | null;
  branchName: string;
  branchPhone?: string | null;
  branchAddress?: string | null;
  saleDate: string;
  savedAt?: string;
}

/* ── localStorage helpers ── */
function loadSlips(branchId?: number | null): ReceiptData[] {
  try {
    const raw = localStorage.getItem(getSlipsKey(branchId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSlip(receipt: ReceiptData, branchId?: number | null) {
  const slips = loadSlips(branchId);
  const exists = slips.some(s => s.receiptNumber === receipt.receiptNumber);
  if (!exists) {
    slips.unshift({ ...receipt, savedAt: new Date().toISOString() });
    localStorage.setItem(getSlipsKey(branchId), JSON.stringify(slips.slice(0, 200)));
  }
}

/* ── Generate printable HTML for download ── */
function generateReceiptHtml(sale: ReceiptData, companyName: string, companyPhone?: string) {
  const roleLabel = sale.cashierRole ? ROLE_LABELS[sale.cashierRole] ?? sale.cashierRole : "";
  const watermarkText = sale.branchName.toUpperCase();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Receipt ${sale.receiptNumber}</title>
  <style>
    body { font-family: 'Courier New', monospace; max-width: 320px; margin: 40px auto; padding: 0 16px; background:#fff; color:#111; position:relative; }
    .center { text-align:center; }
    .bold { font-weight:bold; }
    .divider { border:none; border-top:1px dashed #999; margin:10px 0; }
    .row { display:flex; justify-content:space-between; margin:4px 0; font-size:13px; }
    .label { color:#666; }
    .total { font-size:16px; font-weight:bold; }
    .footer { text-align:center; font-size:11px; color:#999; margin-top:12px; }
    .watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-35deg); font-size:36px; font-weight:900; color:rgba(0,0,0,0.04); white-space:nowrap; pointer-events:none; letter-spacing:4px; z-index:0; }
    @media print { body { margin:0; } }
  </style>
</head>
<body>
  <div class="watermark">${watermarkText}</div>
  <div class="center bold" style="font-size:20px;margin-bottom:2px;letter-spacing:0.5px;">${sale.branchName.toUpperCase()}</div>
  ${sale.branchPhone ? `<div class="center" style="font-size:12px;color:#666;">${sale.branchPhone}</div>` : ""}
  ${sale.branchAddress ? `<div class="center" style="font-size:12px;color:#666;">${sale.branchAddress}</div>` : ""}
  <div class="center" style="font-size:11px;color:#999;margin-top:3px;">${companyName}${companyPhone ? ` · ${companyPhone}` : ""}</div>
  <hr class="divider"/>
  <div class="row"><span class="label">Receipt No.</span><span class="bold">${sale.receiptNumber}</span></div>
  <div class="row"><span class="label">Date</span><span>${format(new Date(sale.saleDate), "dd/MM/yyyy HH:mm")}</span></div>
  <hr class="divider"/>
  <div class="row"><span class="label">Item</span><span>${sale.breadType}</span></div>
  <div class="row"><span class="label">Qty × Price</span><span>${sale.quantity} × ${formatCurrency(sale.pricePerUnit)}</span></div>
  <hr class="divider"/>
  <div class="row total"><span>TOTAL</span><span>${formatCurrency(sale.totalAmount)}</span></div>
  <div class="row"><span class="label">Payment</span><span style="text-transform:capitalize;">${sale.paymentMethod}</span></div>
  <hr class="divider"/>
  ${sale.cashierName ? `<div class="row"><span class="label">Served by</span><span>${sale.cashierName}${roleLabel ? ` (${roleLabel})` : ""}</span></div><hr class="divider"/>` : ""}
  <div class="footer">Thank you for your purchase!<br/>Powered by Ara Tech</div>
  <script>window.onload=()=>window.print();</script>
</body>
</html>`;
}

function downloadReceipt(sale: ReceiptData, companyName: string, companyPhone?: string) {
  const html = generateReceiptHtml(sale, companyName, companyPhone);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt-${sale.receiptNumber}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Receipt Modal ── */
function ReceiptModal({ sale, onClose }: { sale: ReceiptData; onClose: () => void }) {
  const company = getStoredCompany();
  const companyName = company?.name ?? "Ara Bakery Cloud";
  const roleLabel = sale.cashierRole ? ROLE_LABELS[sale.cashierRole] ?? sale.cashierRole : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt size={16} />
            Sale Receipt
          </DialogTitle>
        </DialogHeader>

        <div className="border border-border rounded-xl p-5 space-y-3 text-sm font-mono bg-slate-50 relative overflow-hidden" id="receipt-print-area">
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden>
            <span className="text-[40px] font-black text-black/[0.04] rotate-[-35deg] whitespace-nowrap tracking-widest uppercase leading-none">
              {sale.branchName}
            </span>
          </div>

          {/* Header — branch name is the primary identity */}
          <div className="text-center border-b border-border pb-3 relative z-10">
            {company?.logoUrl && (
              <img src={company.logoUrl} alt="Logo" className="w-12 h-12 object-contain mx-auto mb-2" />
            )}
            <p className="font-black text-base tracking-wide uppercase">{sale.branchName}</p>
            {sale.branchPhone && <p className="text-muted-foreground text-xs">Tel: {sale.branchPhone}</p>}
            {sale.branchAddress && <p className="text-muted-foreground text-xs">{sale.branchAddress}</p>}
            <p className="text-muted-foreground text-[10px] mt-1">{companyName}{company?.phone ? ` · ${company.phone}` : ""}</p>
          </div>

          <div className="space-y-1.5 relative z-10">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receipt No.</span>
              <span className="font-bold">{sale.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span>{format(new Date(sale.saleDate), "dd/MM/yyyy HH:mm")}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-border pt-3 space-y-1.5 relative z-10">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item</span>
              <span>{sale.breadType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Qty × Price</span>
              <span>{sale.quantity} × {formatCurrency(sale.pricePerUnit)}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-border pt-2 mt-1 text-base">
              <span>TOTAL</span>
              <span>{formatCurrency(sale.totalAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Payment</span>
              <Badge variant="outline" className="capitalize">{sale.paymentMethod}</Badge>
            </div>
          </div>

          {sale.cashierName && (
            <div className="border-t border-dashed border-border pt-3 relative z-10">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Served by</span>
                <span className="font-medium">{sale.cashierName}{roleLabel ? ` (${roleLabel})` : ""}</span>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground border-t border-dashed border-border pt-3 relative z-10">
            Thank you for your purchase!<br />
            <span className="text-[10px] opacity-60">Powered by Ara Tech</span>
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
          <Button variant="outline" onClick={() => window.print()} className="flex-1" data-testid="button-print-receipt">
            <Printer size={14} className="mr-2" />
            Print
          </Button>
          <Button onClick={() => downloadReceipt(sale, companyName, company?.phone ?? undefined)} className="flex-1" data-testid="button-download-receipt">
            <Download size={14} className="mr-2" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Saved Slips Section ── */
function SavedSlipsSection() {
  const { activeBranch } = useActiveBranch();
  const branchId = activeBranch?.id ?? null;
  const [slips, setSlips] = useState<ReceiptData[]>([]);
  const [viewing, setViewing] = useState<ReceiptData | null>(null);
  const company = getStoredCompany();

  useEffect(() => { setSlips(loadSlips(branchId)); }, [branchId]);

  if (slips.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText size={16} />
            Saved Receipts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No saved receipts yet.</p>
            <p className="text-xs mt-1">Receipts are automatically saved when you record a sale.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText size={16} />
            Saved Receipts
          </CardTitle>
          <Badge variant="secondary">{slips.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {slips.map(slip => (
            <div key={slip.receiptNumber} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Receipt size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs font-semibold text-foreground">{slip.receiptNumber}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {slip.breadType} · {slip.quantity} units · {formatCurrency(slip.totalAmount)}
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  {format(new Date(slip.saleDate), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewing(slip)}>
                  <Receipt size={13} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => downloadReceipt(slip, company?.name ?? "Ara Bakery Cloud", company?.phone ?? undefined)}>
                  <Download size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      {viewing && <ReceiptModal sale={viewing} onClose={() => setViewing(null)} />}
    </Card>
  );
}

/* ══════════════════════════════════════════════
   MAIN SALES PAGE
   ══════════════════════════════════════════════ */
function useProducts(branchId?: number | null) {
  const token = getToken();
  return useQuery<{ id: number; name: string; pricePerUnit: number; isActive: boolean }[]>({
    queryKey: ["products", branchId ?? null],
    queryFn: async () => {
      const url = branchId
        ? `${API_BASE}/api/products?branchId=${branchId}`
        : `${API_BASE}/api/products`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
  });
}

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

export default function SalesPage() {
  const user = getStoredUser();
  const role = user?.role ?? "";
  const isLimitedRole = role === "supplier" || role === "receptionist";

  const { isExpired } = useSubscription();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { activeBranch } = useActiveBranch();
  const branchParam = activeBranch?.id ?? null;

  const { data: products } = useProducts(branchParam);
  const activeProducts = products?.filter(p => p.isActive) ?? [];

  const isManager = role === "manager" || role === "managing_director";

  const [showNewSale, setShowNewSale] = useState(false);
  const [showBulkSale, setShowBulkSale] = useState(false);
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [quickStock, setQuickStock] = useState<{ name: string; remaining: number; allocated: number }[]>([]);
  const [quickStockLoading, setQuickStockLoading] = useState(false);

  const openQuickSaleModal = async () => {
    setShowQuickSale(true);
    setQuickStockLoading(true);
    const token = getToken();
    const h: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const qs = branchParam ? `?branchId=${branchParam}` : "";
      const dash = await fetch(`${API_BASE}/api/reports/product-dashboard${qs}`, { headers: h, credentials: "include" })
        .then(r => r.ok ? r.json() : null);
      if (dash?.remaining) {
        setQuickStock(dash.remaining);
      }
    } catch {
      setQuickStock([]);
    } finally {
      setQuickStockLoading(false);
    }
  };
  const [receiptSale, setReceiptSale] = useState<ReceiptData | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<ReceiptData | null>(null);
  const [quickForm, setQuickForm] = useState({
    amount: "",
    paymentMethod: "cash" as "cash" | "transfer",
    branchId: user?.branchId?.toString() ?? "",
    notes: "",
  });
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  // Bulk sale: one row per active product
  // `allocatedQty` = units currently out with suppliers; `remaining` = what's left (manager inputs this)
  // Auto-calculated: soldQty = allocatedQty - remaining
  const [bulkLines, setBulkLines] = useState<{
    breadType: string;
    allocatedQty: number;   // from dashboard — units currently allocated to suppliers
    inStoreQty: number;     // from dashboard — units currently in store
    remaining: string;      // manager types this: total still in stock (in store + unsold with suppliers)
    pricePerUnit: string;
  }[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkStockLoading, setBulkStockLoading] = useState(false);

  const openBulkSale = async () => {
    setBulkStockLoading(true);
    setShowBulkSale(true);
    const token = getToken();
    const h: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const qs = branchParam ? `?branchId=${branchParam}` : "";
      const dash = await fetch(`${API_BASE}/api/reports/product-dashboard${qs}`, { headers: h, credentials: "include" })
        .then(r => r.ok ? r.json() : null);
      const stockMap = new Map<string, { allocated: number; remaining: number }>();
      for (const item of (dash?.remaining ?? [])) {
        stockMap.set(item.name, { allocated: item.allocated ?? 0, remaining: item.remaining ?? 0 });
      }
      setBulkLines(
        activeProducts.map(p => ({
          breadType: p.name,
          allocatedQty: stockMap.get(p.name)?.allocated ?? 0,
          inStoreQty:   stockMap.get(p.name)?.remaining ?? 0,
          remaining: "",
          pricePerUnit: p.pricePerUnit.toString(),
        }))
      );
    } catch {
      setBulkLines(
        activeProducts.map(p => ({ breadType: p.name, allocatedQty: 0, inStoreQty: 0, remaining: "", pricePerUnit: p.pricePerUnit.toString() }))
      );
    } finally { setBulkStockLoading(false); }
  };

  const handleBulkCreate = async () => {
    // Daily Entry records direct store sales only. Supplier stock is settled/sold
    // separately and must never be included in a manager's direct-sale quantity.
    const lines = bulkLines.map(l => {
      const totalStock = l.inStoreQty;
      const remainingQty = l.remaining !== "" ? Math.max(0, parseInt(l.remaining) || 0) : null;
      const soldQty = remainingQty !== null ? Math.max(0, totalStock - remainingQty) : 0;
      return { ...l, soldQty };
    }).filter(l => l.soldQty > 0 && parseFloat(l.pricePerUnit) > 0);

    if (lines.length === 0) {
      toast({ title: "No sales to record — enter the remaining stock for at least one product", variant: "destructive" });
      return;
    }
    const token = getToken();
    setBulkSubmitting(true);
    let succeeded = 0;
    let failed = 0;
    const failureReasons: string[] = [];
    for (const line of lines) {
      try {
        const res = await fetch(`${API_BASE}/api/sales`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: "include",
          body: JSON.stringify({
            breadType: line.breadType,
            quantity: line.soldQty,
            pricePerUnit: parseFloat(line.pricePerUnit),
            paymentMethod: form.paymentMethod,
            branchId: parseInt(form.branchId) || user?.branchId,
          }),
        });
        if (res.ok) {
          const sale = await res.json();
          saveSlip({
            receiptNumber: sale.receiptNumber,
            breadType: sale.breadType,
            quantity: sale.quantity,
            pricePerUnit: sale.pricePerUnit,
            totalAmount: sale.totalAmount,
            paymentMethod: sale.paymentMethod,
            cashierName: sale.cashierName,
            cashierRole: sale.cashierRole ?? null,
            branchName: sale.branchName,
            branchPhone: sale.branchPhone ?? null,
            branchAddress: sale.branchAddress ?? null,
            saleDate: sale.saleDate,
          }, branchParam);
          succeeded++;
        } else {
          failed++;
          const error = await res.json().catch(() => ({}));
          failureReasons.push(`${line.breadType}: ${error.error ?? `server rejected (${res.status})`}`);
        }
      } catch {
        failed++;
        failureReasons.push(`${line.breadType}: network error`);
      }
    }
    setBulkSubmitting(false);
    queryClient.invalidateQueries({ queryKey: getListSalesQueryKey({}) });
    queryClient.invalidateQueries({ queryKey: getGetDailySalesSummaryQueryKey({}) });
    if (succeeded > 0) {
      toast({ title: `${succeeded} product${succeeded > 1 ? "s" : ""} recorded`, description: failed > 0 ? `${failed} failed — check stock` : undefined });
    } else {
      toast({ title: "No sales were recorded", description: failureReasons[0] ?? "Check the selected branch and stock count", variant: "destructive" });
    }
    setShowBulkSale(false);
  };

  /* Date filter — supplier/receptionist default to today, others default to "all" */
  const [filterDate, setFilterDate] = useState(isLimitedRole ? todayStr() : "");

  const [form, setForm] = useState({
    breadType: "",
    quantity: "",
    pricePerUnit: "",
    paymentMethod: "cash" as "cash" | "transfer",
    branchId: user?.branchId?.toString() ?? "",
    notes: "",
  });

  useEffect(() => {
    if (activeBranch) {
      setForm(f => ({ ...f, branchId: activeBranch.id.toString() }));
      setQuickForm(f => ({ ...f, branchId: activeBranch.id.toString() }));
    }
  }, [activeBranch]);

  /* Build API params — convert local midnight → UTC ISO so the server query is timezone-correct */
  const listParams: Record<string, string | number | null> = { branchId: branchParam };
  if (filterDate) {
    listParams.startDate = new Date(`${filterDate}T00:00:00`).toISOString();
    listParams.endDate   = new Date(`${filterDate}T23:59:59`).toISOString();
  }

  const { data: sales, isLoading } = useListSales(listParams as any);
  const { data: branches } = useListBranches();

  /* Stats computed from the already-fetched sales array — always in sync with the date filter */
  const isToday       = filterDate === todayStr();
  const statsSales    = sales ?? [];
  const statsOrders   = statsSales.length;
  const statsRevenue  = statsSales.reduce((s, x) => s + x.totalAmount, 0);
  const statsCash     = statsSales.filter(x => x.paymentMethod === "cash").reduce((s, x) => s + x.totalAmount, 0);
  const statsTransfer = statsSales.filter(x => x.paymentMethod === "transfer").reduce((s, x) => s + x.totalAmount, 0);
  const statsLabel    = filterDate
    ? (isToday ? "Today's" : format(new Date(filterDate + "T12:00:00"), "d MMM yyyy"))
    : "All-Time";
  const createSale = useCreateSale();

  const handleCreate = () => {
    if (!form.breadType || !form.quantity || !form.pricePerUnit || !form.branchId) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createSale.mutate(
      {
        data: {
          breadType: form.breadType,
          quantity: parseInt(form.quantity),
          pricePerUnit: parseFloat(form.pricePerUnit),
          paymentMethod: form.paymentMethod,
          branchId: parseInt(form.branchId),
          notes: form.notes || null,
        },
      },
      {
        onSuccess: (sale) => {
          toast({ title: "Sale recorded successfully" });
          queryClient.invalidateQueries({ queryKey: getListSalesQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetDailySalesSummaryQueryKey({}) });
          setShowNewSale(false);
          const receipt: ReceiptData = {
            receiptNumber: sale.receiptNumber,
            breadType:     sale.breadType,
            quantity:      sale.quantity,
            pricePerUnit:  sale.pricePerUnit,
            totalAmount:   sale.totalAmount,
            paymentMethod: sale.paymentMethod,
            cashierName:   sale.cashierName,
            cashierRole:   (sale as any).cashierRole ?? null,
            branchName:    sale.branchName,
            branchPhone:   (sale as any).branchPhone ?? null,
            branchAddress: (sale as any).branchAddress ?? null,
            saleDate:      sale.saleDate,
          };
          saveSlip(receipt, branchParam);
          setReceiptSale(receipt);
          setForm({ breadType: "", quantity: "", pricePerUnit: "", paymentMethod: "cash", branchId: user?.branchId?.toString() ?? "", notes: "" });
        },
        onError: (err) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to record sale";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleQuickSale = async () => {
    const amount = parseFloat(quickForm.amount);
    if (!quickForm.amount || isNaN(amount) || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!quickForm.branchId) {
      toast({ title: "Branch is required", variant: "destructive" });
      return;
    }
    const token = getToken();
    setQuickSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/sales/quick`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          amount,
          paymentMethod: quickForm.paymentMethod,
          branchId: parseInt(quickForm.branchId),
          notes: quickForm.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Error", description: err?.error ?? "Failed to record sale", variant: "destructive" });
        return;
      }
      const sale = await res.json();
      toast({ title: "Quick sale recorded" });
      queryClient.invalidateQueries({ queryKey: getListSalesQueryKey({}) });
      queryClient.invalidateQueries({ queryKey: getGetDailySalesSummaryQueryKey({}) });
      const receipt: ReceiptData = {
        receiptNumber: sale.receiptNumber,
        breadType:     sale.breadType,
        quantity:      sale.quantity,
        pricePerUnit:  sale.pricePerUnit,
        totalAmount:   sale.totalAmount,
        paymentMethod: sale.paymentMethod,
        cashierName:   sale.cashierName,
        cashierRole:   sale.cashierRole ?? null,
        branchName:    sale.branchName,
        branchPhone:   sale.branchPhone ?? null,
        branchAddress: sale.branchAddress ?? null,
        saleDate:      sale.saleDate,
      };
      saveSlip(receipt, branchParam);
      setReceiptSale(receipt);
      setShowQuickSale(false);
      setQuickForm({ amount: "", paymentMethod: "cash", branchId: activeBranch?.id.toString() ?? user?.branchId?.toString() ?? "", notes: "" });
    } finally {
      setQuickSubmitting(false);
    }
  };

  const toReceipt = (sale: NonNullable<typeof sales>[0]): ReceiptData => ({
    receiptNumber: sale.receiptNumber,
    breadType:     sale.breadType,
    quantity:      sale.quantity,
    pricePerUnit:  sale.pricePerUnit,
    totalAmount:   sale.totalAmount,
    paymentMethod: sale.paymentMethod,
    cashierName:   sale.cashierName,
    cashierRole:   (sale as any).cashierRole ?? null,
    branchName:    sale.branchName,
    branchPhone:   (sale as any).branchPhone ?? null,
    branchAddress: (sale as any).branchAddress ?? null,
    saleDate:      sale.saleDate,
  });

  const dateLabel = filterDate
    ? isToday ? "Today" : format(new Date(filterDate + "T12:00:00"), "dd MMM yyyy")
    : "All Time";

  return (
    <div className="space-y-6" data-testid="page-sales">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLimitedRole ? "Your daily sales" : "Record and manage bread sales"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Button variant="outline" onClick={openQuickSaleModal} disabled={isExpired} data-testid="button-quick-sale">
              <Plus size={16} className="mr-2" />
              Quick Sale
            </Button>
          )}
          {!isLimitedRole && (
            <Button variant="outline" onClick={openBulkSale} disabled={isExpired || activeProducts.length === 0} data-testid="button-bulk-sale">
              <Plus size={16} className="mr-2" />
              Daily Entry
            </Button>
          )}
          <Button onClick={() => setShowNewSale(true)} disabled={isExpired} data-testid="button-new-sale">
            <Plus size={16} className="mr-2" />
            New Sale
          </Button>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Date:</Label>
          <Input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="w-40 h-8 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={isToday && filterDate ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setFilterDate(todayStr())}
          >
            Today
          </Button>
          {!isLimitedRole && (
            <Button
              variant={!filterDate ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setFilterDate("")}
            >
              All Time
            </Button>
          )}
        </div>
        <Badge variant="secondary" className="text-xs">{dateLabel}</Badge>
      </div>

      {/* Summary cards — always in sync with the active date filter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: `${statsLabel} Sales`,   value: `${statsOrders} orders`,         icon: ShoppingCart, show: true },
          { label: `${statsLabel} Revenue`, value: formatCurrency(statsRevenue),     icon: TrendingUp,   show: !isLimitedRole },
          { label: "Cash",                  value: formatCurrency(statsCash),         icon: TrendingUp,   show: true },
          { label: "Transfer",              value: formatCurrency(statsTransfer),     icon: TrendingUp,   show: true },
        ].filter(i => i.show).map(item => (
          <Card key={item.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{isLoading ? "…" : item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              {filterDate ? `Sales — ${dateLabel}` : "All Sales"}
            </CardTitle>
            <div className="flex items-center gap-2">
              {sales && sales.length > 0 && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                  onClick={() => {
                    const company = getStoredCompany();
                    const sortedRows = [...sales].reverse();
                    const totalRev  = sortedRows.reduce((s, x) => s + x.totalAmount, 0);
                    generatePdf({
                      title: "Sales Report",
                      subtitle: filterDate ? `${statsLabel} · ${dateLabel}` : "All-Time Sales",
                      companyName: company?.name ?? "Bakery",
                      companyPhone: company?.phone ?? undefined,
                      branchName: activeBranch?.name ?? undefined,
                      dateRange: filterDate
                        ? `${format(new Date(filterDate + "T12:00:00"), "d MMM yyyy")}`
                        : `All time · ${sortedRows.length} records`,
                      sections: [{
                        title: `Sales (${sortedRows.length} records)`,
                        headers: ["Date", "Receipt", "Bread Type", "Qty", "Price/Unit", "Total", "Payment", "Served By"],
                        rows: sortedRows.map(s => [
                          format(new Date(s.saleDate), "dd/MM/yyyy HH:mm"),
                          s.receiptNumber ?? "",
                          s.breadType,
                          s.quantity,
                          pdfFmt(s.pricePerUnit),
                          pdfFmt(s.totalAmount),
                          s.paymentMethod,
                          s.cashierName ?? "",
                        ]),
                        totals: ["", "", "", sortedRows.reduce((s, x) => s + x.quantity, 0).toString(), "", pdfFmt(totalRev), "", ""],
                      }],
                      filename: `sales-${filterDate ?? format(new Date(), "yyyy-MM-dd")}.pdf`,
                    });
                  }}>
                  <Download size={12} /> Download PDF
                </Button>
              )}
              <Badge variant="secondary" className="text-xs">{sales?.length ?? 0} records</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !sales?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart size={36} className="mx-auto mb-2 opacity-40" />
              <p>{filterDate ? `No sales on ${dateLabel}.` : "No sales recorded yet."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Bread Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Served By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...(sales ?? [])].reverse().map((sale) => {
                    const cashierRole = (sale as any).cashierRole as string | null;
                    const roleLabel = cashierRole ? ROLE_LABELS[cashierRole] ?? cashierRole : null;
                    return (
                      <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                        <TableCell className="font-mono text-xs">
                          {sale.receiptNumber}
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(sale as any).syncStatus === "pending" && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-700 rounded px-1 border border-amber-200 align-middle">
                              <Clock className="h-2.5 w-2.5" />pending
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{sale.breadType}</TableCell>
                        <TableCell>{sale.quantity}</TableCell>
                        <TableCell>{formatCurrency(sale.pricePerUnit)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(sale.totalAmount)}</TableCell>
                        <TableCell>
                          <Badge variant={sale.paymentMethod === "cash" ? "secondary" : "outline"} className="capitalize">
                            {sale.paymentMethod}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>
                            <p className="font-medium text-foreground">{sale.cashierName}</p>
                            {roleLabel && (
                              <p className="text-xs text-muted-foreground">{roleLabel}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{format(new Date(sale.saleDate), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="View Receipt"
                            onClick={() => setViewingReceipt(toReceipt(sale))}
                            data-testid={`button-receipt-${sale.id}`}>
                            <Receipt size={13} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved Slips */}
      <SavedSlipsSection />

      {/* New Sale Dialog */}
      <Dialog open={showNewSale} onOpenChange={setShowNewSale}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record New Sale</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Bread Type</Label>
              <Select
                value={form.breadType}
                onValueChange={(v) => {
                  const product = activeProducts.find(p => p.name === v);
                  setForm({
                    ...form,
                    breadType: v,
                    pricePerUnit: product?.pricePerUnit ? product.pricePerUnit.toString() : form.pricePerUnit,
                  });
                }}
              >
                <SelectTrigger data-testid="select-bread-type">
                  <SelectValue placeholder="Select bread type" />
                </SelectTrigger>
                <SelectContent>
                  {activeProducts.length > 0
                    ? activeProducts.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)
                    : <SelectItem value="none" disabled>No products — add from Products page</SelectItem>
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input
                  type="number" min="1" placeholder="0"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  data-testid="input-quantity"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Price per Unit (₦)</Label>
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.pricePerUnit}
                  onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
                  data-testid="input-price"
                />
              </div>
            </div>
            {form.quantity && form.pricePerUnit && (
              <div className="bg-muted rounded-lg px-3 py-2.5 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">Total amount:</span>
                <span className="font-bold text-foreground text-base">
                  {formatCurrency(parseFloat(form.quantity) * parseFloat(form.pricePerUnit))}
                </span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={(v: "cash" | "transfer") => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger data-testid="select-payment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {branches && branches.length > 1 && !isLimitedRole && (
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                  <SelectTrigger data-testid="select-branch">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSale(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createSale.isPending} data-testid="button-confirm-sale">
              {createSale.isPending ? "Recording..." : "Record Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {receiptSale && <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />}
      {viewingReceipt && <ReceiptModal sale={viewingReceipt} onClose={() => setViewingReceipt(null)} />}

      {/* Quick Sale Dialog — manager / managing_director only */}
      {isManager && (
        <Dialog open={showQuickSale} onOpenChange={setShowQuickSale}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart size={16} />
                Quick Sale
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground -mt-1">
              Record a sale by amount only — no product selection required.
            </p>

            {/* Stock Overview Banner */}
            {quickStockLoading ? (
              <div className="h-16 bg-muted animate-pulse rounded-xl" />
            ) : quickStock.length > 0 && (
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-semibold text-amber-900">
                  <span>Current Stock Status</span>
                  <span className="text-[10px] bg-amber-200/60 text-amber-800 rounded px-1.5 py-0.5 font-normal">
                    Allocated + Remaining
                  </span>
                </div>
                <div className="space-y-1 text-slate-700">
                  {quickStock.map(s => (
                    <div key={s.name} className="flex justify-between items-center text-[11px]">
                      <span className="font-medium truncate max-w-[130px]">{s.name}</span>
                      <span className="text-muted-foreground">
                        <span className="font-semibold text-amber-800">{s.allocated ?? 0}</span> with suppliers · <span className="font-semibold text-emerald-800">{s.remaining ?? 0}</span> in store
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Amount (₦)</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="e.g. 5000"
                  value={quickForm.amount}
                  onChange={e => setQuickForm(f => ({ ...f, amount: e.target.value }))}
                  data-testid="input-quick-amount"
                  autoFocus
                />
                {quickForm.amount && parseFloat(quickForm.amount) > 0 && (
                  <p className="text-sm font-semibold text-foreground pt-0.5">
                    {formatCurrency(parseFloat(quickForm.amount))}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select
                  value={quickForm.paymentMethod}
                  onValueChange={(v: "cash" | "transfer") => setQuickForm(f => ({ ...f, paymentMethod: v }))}
                >
                  <SelectTrigger data-testid="select-quick-payment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {branches && branches.length > 1 && (
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Select value={quickForm.branchId} onValueChange={v => setQuickForm(f => ({ ...f, branchId: v }))}>
                    <SelectTrigger data-testid="select-quick-branch">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="e.g. Roadside sale, custom order…"
                  value={quickForm.notes}
                  onChange={e => setQuickForm(f => ({ ...f, notes: e.target.value }))}
                  data-testid="input-quick-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowQuickSale(false)}>Cancel</Button>
              <Button onClick={handleQuickSale} disabled={quickSubmitting} data-testid="button-confirm-quick-sale">
                {quickSubmitting ? "Recording…" : "Record Sale"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Bulk Daily Entry Dialog ── */}
      <Dialog open={showBulkSale} onOpenChange={setShowBulkSale}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base font-bold mb-1">
              <ShoppingCart size={16} />
              Daily Sales Entry
            </DialogTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enter what is left in the store. Supplier stock is not included here.
            </p>
          </div>

          {/* Payment method */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-muted/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Payment:</span>
            <div className="flex gap-2">
              {(["cash", "transfer"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setForm(f => ({ ...f, paymentMethod: m }))}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    form.paymentMethod === m
                      ? "bg-amber-400 text-slate-950"
                      : "bg-background text-muted-foreground border border-border hover:bg-muted"
                  }`}
                >
                  {m === "cash" ? "Cash" : "Bank Transfer"}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-6 py-2 border-b border-border/50 bg-muted/20">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Product</p>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-right w-20">With suppliers</p>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-right w-24">Remaining</p>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-right w-24">Sold / Total</p>
          </div>

          {/* Product rows — scrollable */}
          <div className="flex-1 overflow-y-auto">
            {bulkStockLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {bulkLines.map((line, idx) => {
                  const totalStock = line.inStoreQty;
                  const remainingQty = line.remaining !== "" ? Math.max(0, parseInt(line.remaining) || 0) : null;
                  const soldQty = remainingQty !== null ? Math.max(0, totalStock - remainingQty) : null;
                  const price = parseFloat(line.pricePerUnit) || 0;
                  const lineTotal = soldQty !== null ? soldQty * price : null;
                  const isOverAllocated = remainingQty !== null && remainingQty > totalStock;

                  return (
                    <div key={line.breadType} className={`px-6 py-3 ${soldQty && soldQty > 0 ? "bg-emerald-50/40" : ""}`}>
                      {/* Product name + price row */}
                      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-start">
                        {/* Product */}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{line.breadType}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">
                              ₦{parseFloat(line.pricePerUnit).toLocaleString("en-NG", { minimumFractionDigits: 0 })}/unit
                            </span>
                            {line.inStoreQty > 0 && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-medium">
                                {line.inStoreQty} in store
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Allocated */}
                        <div className="w-20 text-right">
                          <p className="text-sm font-bold text-foreground">{line.allocatedQty}</p>
                          <p className="text-[10px] text-muted-foreground">allocated</p>
                        </div>

                        {/* Remaining input */}
                        <div className="w-24">
                          <Input
                            type="number"
                            min="0"
                            max={totalStock}
                            placeholder={`0–${totalStock}`}
                            value={line.remaining}
                            onChange={e => {
                              const updated = [...bulkLines];
                              updated[idx] = { ...updated[idx], remaining: e.target.value };
                              setBulkLines(updated);
                            }}
                            className={`h-9 text-sm text-right ${isOverAllocated ? "border-red-400 bg-red-50 focus-visible:ring-red-400" : ""}`}
                          />
                          {isOverAllocated && (
                            <p className="text-[10px] text-red-600 mt-0.5 text-right">Max {totalStock}</p>
                          )}
                        </div>

                        {/* Calculated sold + total */}
                        <div className="w-24 text-right">
                          {soldQty !== null && soldQty > 0 ? (
                            <>
                              <p className="text-sm font-bold text-emerald-700">{soldQty} sold</p>
                              <p className="text-xs font-semibold text-emerald-600">
                                {lineTotal !== null ? formatCurrency(lineTotal) : "—"}
                              </p>
                            </>
                          ) : soldQty === 0 && remainingQty !== null ? (
                            <p className="text-xs text-muted-foreground">No sales</p>
                          ) : (
                            <p className="text-xs text-muted-foreground/40">—</p>
                          )}
                        </div>
                      </div>

                      {/* Price per unit editable (collapsed by default, shown when product has a sale) */}
                      {soldQty !== null && soldQty > 0 && (
                        <div className="flex items-center gap-2 mt-2 ml-0">
                          <span className="text-[10px] text-muted-foreground">Price/unit:</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.pricePerUnit}
                            onChange={e => {
                              const updated = [...bulkLines];
                              updated[idx] = { ...updated[idx], pricePerUnit: e.target.value };
                              setBulkLines(updated);
                            }}
                            className="h-7 text-xs w-28"
                          />
                          <span className="text-[10px] text-muted-foreground">₦</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Grand total summary */}
          {(() => {
            const entries = bulkLines.map(l => {
              const totalStock = l.allocatedQty + l.inStoreQty;
              const remainingQty = l.remaining !== "" ? Math.max(0, parseInt(l.remaining) || 0) : null;
              const soldQty = remainingQty !== null ? Math.max(0, totalStock - remainingQty) : 0;
              const price = parseFloat(l.pricePerUnit) || 0;
              return { soldQty, total: soldQty * price };
            });
            const totalSold = entries.reduce((s, e) => s + e.soldQty, 0);
            const grandTotal = entries.reduce((s, e) => s + e.total, 0);
            if (totalSold === 0) return null;
            return (
              <div className="px-6 py-3 border-t border-border bg-slate-950 text-white flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Total Sales Today</p>
                  <p className="text-xs text-slate-400 mt-0.5">{totalSold} units · {form.paymentMethod}</p>
                </div>
                <p className="text-xl font-bold text-amber-400">{formatCurrency(grandTotal)}</p>
              </div>
            );
          })()}

          <div className="px-6 py-4 border-t border-border flex gap-2">
            <Button variant="outline" onClick={() => setShowBulkSale(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleBulkCreate} disabled={bulkSubmitting || bulkStockLoading} className="flex-1">
              {bulkSubmitting ? "Recording…" : "Record Sales"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
