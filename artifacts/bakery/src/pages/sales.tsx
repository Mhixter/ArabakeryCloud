import { useState, useEffect } from "react";
import {
  useListSales, useCreateSale, useGetDailySalesSummary, useListBranches,
  getListSalesQueryKey, getGetDailySalesSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getStoredUser, getStoredCompany } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Printer, ShoppingCart, TrendingUp, Download, Receipt, FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";

const BREAD_TYPES = ["Standard White Loaf", "Whole Wheat Loaf", "Sweet Bread", "Agege Bread", "Coconut Bread", "Other"];
const SLIPS_KEY = "nmb_slips";

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
  branchName: string;
  saleDate: string;
  savedAt?: string;
}

/* ── localStorage helpers ── */
function loadSlips(): ReceiptData[] {
  try {
    const raw = localStorage.getItem(SLIPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSlip(receipt: ReceiptData) {
  const slips = loadSlips();
  const exists = slips.some(s => s.receiptNumber === receipt.receiptNumber);
  if (!exists) {
    slips.unshift({ ...receipt, savedAt: new Date().toISOString() });
    localStorage.setItem(SLIPS_KEY, JSON.stringify(slips.slice(0, 200)));
  }
}

function deleteSlip(receiptNumber: string) {
  const slips = loadSlips().filter(s => s.receiptNumber !== receiptNumber);
  localStorage.setItem(SLIPS_KEY, JSON.stringify(slips));
}

/* ── Generate printable HTML for download ── */
function generateReceiptHtml(sale: ReceiptData, companyName: string, companyPhone?: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Receipt ${sale.receiptNumber}</title>
  <style>
    body { font-family: 'Courier New', monospace; max-width: 320px; margin: 40px auto; padding: 0 16px; background:#fff; color:#111; }
    .center { text-align:center; }
    .bold { font-weight:bold; }
    .divider { border:none; border-top:1px dashed #999; margin:10px 0; }
    .row { display:flex; justify-content:space-between; margin:4px 0; font-size:13px; }
    .label { color:#666; }
    .total { font-size:16px; font-weight:bold; }
    .footer { text-align:center; font-size:11px; color:#999; margin-top:12px; }
    @media print { body { margin:0; } }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:18px;margin-bottom:2px;">${companyName}</div>
  ${companyPhone ? `<div class="center" style="font-size:12px;color:#666;">${companyPhone}</div>` : ""}
  <div class="center" style="font-size:12px;color:#666;">${sale.branchName}</div>
  <hr class="divider"/>
  <div class="row"><span class="label">Receipt No.</span><span class="bold">${sale.receiptNumber}</span></div>
  <div class="row"><span class="label">Date</span><span>${format(new Date(sale.saleDate), "dd/MM/yyyy HH:mm")}</span></div>
  <div class="row"><span class="label">Cashier</span><span>${sale.cashierName}</span></div>
  <hr class="divider"/>
  <div class="row"><span class="label">Item</span><span>${sale.breadType}</span></div>
  <div class="row"><span class="label">Qty × Price</span><span>${sale.quantity} × ${formatCurrency(sale.pricePerUnit)}</span></div>
  <hr class="divider"/>
  <div class="row total"><span>TOTAL</span><span>${formatCurrency(sale.totalAmount)}</span></div>
  <div class="row"><span class="label">Payment</span><span style="text-transform:capitalize;">${sale.paymentMethod}</span></div>
  <hr class="divider"/>
  <div class="footer">Thank you for your purchase!<br/>Powered by Ara Bakery Cloud</div>
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt size={16} />
            Sale Receipt
          </DialogTitle>
        </DialogHeader>

        <div className="border border-border rounded-xl p-5 space-y-3 text-sm font-mono bg-slate-50" id="receipt-print-area">
          <div className="text-center border-b border-border pb-3">
            {company?.logoUrl && (
              <img src={company.logoUrl} alt="Logo" className="w-12 h-12 object-contain mx-auto mb-2" />
            )}
            <p className="font-bold text-base">{companyName}</p>
            {company?.phone && <p className="text-muted-foreground text-xs">{company.phone}</p>}
            <p className="text-muted-foreground text-xs">{sale.branchName}</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receipt No.</span>
              <span className="font-bold">{sale.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span>{format(new Date(sale.saleDate), "dd/MM/yyyy HH:mm")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cashier</span>
              <span>{sale.cashierName}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-border pt-3 space-y-1.5">
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

          <p className="text-center text-xs text-muted-foreground border-t border-dashed border-border pt-3">
            Thank you for your purchase!
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
          <Button variant="outline" onClick={() => window.print()} className="flex-1" data-testid="button-print-receipt">
            <Printer size={14} className="mr-2" />
            Print
          </Button>
          <Button onClick={() => downloadReceipt(sale, companyName, company?.phone)} className="flex-1" data-testid="button-download-receipt">
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

  const handleDelete = (receiptNumber: string) => {
    deleteSlip(receiptNumber);
    setSlips(loadSlips());
  };

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
                  onClick={() => downloadReceipt(slip, company?.name ?? "Ara Bakery Cloud", company?.phone)}>
                  <Download size={13} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(slip.receiptNumber)}>
                  <Trash2 size={13} />
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
export default function SalesPage() {
  const user = getStoredUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showNewSale, setShowNewSale] = useState(false);
  const [receiptSale, setReceiptSale] = useState<ReceiptData | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<ReceiptData | null>(null);

  const [form, setForm] = useState({
    breadType: "",
    quantity: "",
    pricePerUnit: "",
    paymentMethod: "cash" as "cash" | "transfer",
    branchId: user?.branchId?.toString() ?? "",
    notes: "",
  });

  const { data: sales, isLoading } = useListSales({});
  const { data: dailySummary } = useGetDailySalesSummary({});
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
            branchName:    sale.branchName,
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

  /* Build receipt data from a sale list item */
  const toReceipt = (sale: NonNullable<typeof sales>[0]): ReceiptData => ({
    receiptNumber: sale.receiptNumber,
    breadType:     sale.breadType,
    quantity:      sale.quantity,
    pricePerUnit:  sale.pricePerUnit,
    totalAmount:   sale.totalAmount,
    paymentMethod: sale.paymentMethod,
    cashierName:   sale.cashierName,
    branchName:    sale.branchName,
    saleDate:      sale.saleDate,
  });

  return (
    <div className="space-y-6" data-testid="page-sales">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Record and manage bread sales</p>
        </div>
        <Button onClick={() => setShowNewSale(true)} data-testid="button-new-sale">
          <Plus size={16} className="mr-2" />
          New Sale
        </Button>
      </div>

      {/* Daily Summary */}
      {dailySummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Today's Sales",    value: `${dailySummary.totalSales} orders`,        icon: ShoppingCart },
            { label: "Total Revenue",    value: formatCurrency(dailySummary.totalRevenue),   icon: TrendingUp },
            { label: "Cash",             value: formatCurrency(dailySummary.cashSales),      icon: TrendingUp },
            { label: "Transfer",         value: formatCurrency(dailySummary.transferSales),  icon: TrendingUp },
          ].map(item => (
            <Card key={item.label}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Sales Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Sales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !sales?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart size={36} className="mx-auto mb-2 opacity-40" />
              <p>No sales recorded yet. Start by recording your first sale.</p>
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
                    <TableHead>Cashier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...(sales ?? [])].reverse().map((sale) => (
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
                      <TableCell className="text-muted-foreground text-sm">{sale.cashierName}</TableCell>
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
                  ))}
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
              <Select value={form.breadType} onValueChange={(v) => setForm({ ...form, breadType: v })}>
                <SelectTrigger data-testid="select-bread-type">
                  <SelectValue placeholder="Select bread type" />
                </SelectTrigger>
                <SelectContent>
                  {BREAD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
            {branches && branches.length > 1 && (
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
