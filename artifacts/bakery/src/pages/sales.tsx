import { useState, useEffect } from "react";
import {
  useListSales, useCreateSale, useGetDailySalesSummary, useListBranches,
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
import { Plus, Printer, ShoppingCart, TrendingUp, Download, Receipt, FileText } from "lucide-react";
import { useSubscription } from "@/components/subscription-guard";
import { format } from "date-fns";

/** Per-user receipt storage — prevents receipts leaking between suppliers/users in the same company */
function getSlipsKey(): string {
  try {
    const raw = localStorage.getItem("nmb_user");
    const user = raw ? JSON.parse(raw) : null;
    if (user?.companyId && user?.id) return `nmb_slips_${user.companyId}_${user.id}`;
    if (user?.companyId) return `nmb_slips_${user.companyId}`;
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
function loadSlips(): ReceiptData[] {
  try {
    const raw = localStorage.getItem(getSlipsKey());
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSlip(receipt: ReceiptData) {
  const slips = loadSlips();
  const exists = slips.some(s => s.receiptNumber === receipt.receiptNumber);
  if (!exists) {
    slips.unshift({ ...receipt, savedAt: new Date().toISOString() });
    localStorage.setItem(getSlipsKey(), JSON.stringify(slips.slice(0, 200)));
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
  const [slips, setSlips] = useState<ReceiptData[]>([]);
  const [viewing, setViewing] = useState<ReceiptData | null>(null);
  const company = getStoredCompany();

  useEffect(() => { setSlips(loadSlips()); }, []);

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
function useProducts() {
  const token = getToken();
  return useQuery<{ id: number; name: string; pricePerUnit: number; isActive: boolean }[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } });
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
  const { data: products } = useProducts();
  const activeProducts = products?.filter(p => p.isActive) ?? [];

  const [showNewSale, setShowNewSale] = useState(false);
  const [receiptSale, setReceiptSale] = useState<ReceiptData | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<ReceiptData | null>(null);

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

  const { activeBranch } = useActiveBranch();
  const branchParam = activeBranch?.id ?? null;

  useEffect(() => {
    if (activeBranch) {
      setForm(f => ({ ...f, branchId: activeBranch.id.toString() }));
    }
  }, [activeBranch]);

  /* Build API params — convert local midnight → UTC ISO so the server query is timezone-correct */
  const listParams: Record<string, string | number | null> = { branchId: branchParam };
  if (filterDate) {
    listParams.startDate = new Date(`${filterDate}T00:00:00`).toISOString();
    listParams.endDate   = new Date(`${filterDate}T23:59:59`).toISOString();
  }

  const { data: sales, isLoading } = useListSales(listParams as any);
  const { data: dailySummary } = useGetDailySalesSummary({ branchId: branchParam });
  const { data: branches } = useListBranches();
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
          saveSlip(receipt);
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

  const isToday = filterDate === todayStr();
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
        <Button onClick={() => setShowNewSale(true)} disabled={isExpired} data-testid="button-new-sale">
          <Plus size={16} className="mr-2" />
          New Sale
        </Button>
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

      {/* Daily Summary — supplier/receptionist see only today's daily numbers */}
      {dailySummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Today's Sales",    value: `${dailySummary.totalSales} orders`,        icon: ShoppingCart, show: true },
            { label: "Today's Revenue",  value: formatCurrency(dailySummary.totalRevenue),   icon: TrendingUp,   show: !isLimitedRole },
            { label: "Cash",             value: formatCurrency(dailySummary.cashSales),      icon: TrendingUp,   show: true },
            { label: "Transfer",         value: formatCurrency(dailySummary.transferSales),  icon: TrendingUp,   show: true },
          ].filter(i => i.show).map(item => (
            <Card key={item.label}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
                    const rows = [...sales].reverse().map(s => ({
                      Receipt: s.receiptNumber ?? "",
                      Date: format(new Date(s.saleDate), "dd/MM/yyyy HH:mm"),
                      "Bread Type": s.breadType,
                      Quantity: s.quantity,
                      "Price/Unit (₦)": s.pricePerUnit,
                      "Total (₦)": s.totalAmount,
                      Payment: s.paymentMethod,
                      Branch: s.branchName ?? "",
                      "Served By": s.cashierName ?? "",
                    }));
                    const blob = new Blob([
                      [Object.keys(rows[0]).join(","), ...rows.map(r => Object.values(r).map(v => {
                        const sv = String(v ?? "").replace(/"/g, '""');
                        return sv.includes(",") || sv.includes('"') ? `"${sv}"` : sv;
                      }).join(","))].join("\n")
                    ], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url;
                    a.download = `sales-${filterDate ?? format(new Date(), "yyyy-MM-dd")}.csv`;
                    a.click(); URL.revokeObjectURL(url);
                  }}>
                  <Download size={12} /> Download CSV
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
                        <TableCell className="font-mono text-xs">{sale.receiptNumber}</TableCell>
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
    </div>
  );
}
