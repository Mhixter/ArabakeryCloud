import { useState } from "react";
import {
  useListSales,
  useCreateSale,
  useGetDailySalesSummary,
  useListBranches,
  getListSalesQueryKey,
  getGetDailySalesSummaryQueryKey,
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
import { Plus, Printer, ShoppingCart, TrendingUp } from "lucide-react";
import { format } from "date-fns";

const BREAD_TYPES = ["Standard White Loaf", "Whole Wheat Loaf", "Sweet Bread", "Agege Bread", "Coconut Bread", "Other"];

function formatCurrency(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface ReceiptData {
  receiptNumber: string;
  breadType: string;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  paymentMethod: string;
  cashierName: string;
  branchName: string;
  saleDate: string;
}

function ReceiptModal({ sale, onClose }: { sale: ReceiptData; onClose: () => void }) {
  const company = getStoredCompany();
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Sale Receipt</DialogTitle>
        </DialogHeader>

        {/* Printable receipt */}
        <div className="border border-border rounded-lg p-5 space-y-3 text-sm" id="receipt-print-area">
          <div className="text-center border-b border-border pb-3">
            {company?.logoUrl && (
              <img src={company.logoUrl} alt="Logo" className="w-12 h-12 object-contain mx-auto mb-2" />
            )}
            <p className="font-serif font-bold text-lg">{company?.name ?? "Ara Bakery Cloud"}</p>
            {company?.phone && <p className="text-muted-foreground text-xs">{company.phone}</p>}
            <p className="text-muted-foreground text-xs">{sale.branchName}</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receipt No.</span>
              <span className="font-mono font-medium">{sale.receiptNumber}</span>
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
          <div className="border-t border-border pt-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item</span>
              <span>{sale.breadType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Qty x Price</span>
              <span>{sale.quantity} x {formatCurrency(sale.pricePerUnit)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-border pt-2 mt-2">
              <span>Total</span>
              <span>{formatCurrency(sale.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment</span>
              <Badge variant="outline" className="capitalize">{sale.paymentMethod}</Badge>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground border-t border-border pt-3">
            Thank you for your purchase!
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()} data-testid="button-print-receipt">
            <Printer size={14} className="mr-2" />
            Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SalesPage() {
  const user = getStoredUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showNewSale, setShowNewSale] = useState(false);
  const [receiptSale, setReceiptSale] = useState<ReceiptData | null>(null);

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
          setReceiptSale({
            receiptNumber: sale.receiptNumber,
            breadType: sale.breadType,
            quantity: sale.quantity,
            pricePerUnit: sale.pricePerUnit,
            totalAmount: sale.totalAmount,
            paymentMethod: sale.paymentMethod,
            cashierName: sale.cashierName,
            branchName: sale.branchName,
            saleDate: sale.saleDate,
          });
          setForm({ breadType: "", quantity: "", pricePerUnit: "", paymentMethod: "cash", branchId: user?.branchId?.toString() ?? "", notes: "" });
        },
        onError: (err) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to record sale";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6" data-testid="page-sales">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Sales</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Record and manage bread sales</p>
        </div>
        <Button onClick={() => setShowNewSale(true)} data-testid="button-new-sale">
          <Plus size={16} className="mr-2" />
          New Sale
        </Button>
      </div>

      {/* Daily Summary */}
      {dailySummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Today's Sales", value: `${dailySummary.totalSales} orders`, icon: ShoppingCart },
            { label: "Revenue", value: formatCurrency(dailySummary.totalRevenue), icon: TrendingUp },
            { label: "Cash", value: formatCurrency(dailySummary.cashSales), icon: TrendingUp },
            { label: "Transfer", value: formatCurrency(dailySummary.transferSales), icon: TrendingUp },
          ].map((item) => (
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
                  type="number"
                  min="1"
                  placeholder="0"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  data-testid="input-quantity"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Price per Unit (₦)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.pricePerUnit}
                  onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
                  data-testid="input-price"
                />
              </div>
            </div>
            {form.quantity && form.pricePerUnit && (
              <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-bold text-foreground">{formatCurrency(parseFloat(form.quantity) * parseFloat(form.pricePerUnit))}</span>
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
    </div>
  );
}
