import { useState } from "react";
import "./_group.css";
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  PackageCheck,
  Users,
} from "lucide-react";

const supplier = "Amina Yusuf";
const branch = "Ikeja Branch";
const days = [
  {
    date: "2025-04-28",
    allocations: [
      { breadType: "Family Loaf", quantity: 18, isCleared: false },
      { breadType: "Coconut Bread", quantity: 8, isCleared: false },
    ],
  },
  {
    date: "2025-04-27",
    allocations: [
      { breadType: "Family Loaf", quantity: 20, isCleared: true },
      { breadType: "Milk Bread", quantity: 10, isCleared: true },
    ],
  },
  {
    date: "2025-04-26",
    allocations: [
      { breadType: "Family Loaf", quantity: 16, isCleared: true },
      { breadType: "Coconut Bread", quantity: 6, isCleared: true },
    ],
  },
];

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function Current() {
  const [expandedDate, setExpandedDate] = useState<string | null>("2025-04-28");
  const allocations = days.flatMap(day => day.allocations);
  const open = allocations.filter(allocation => !allocation.isCleared);
  const totalUnits = allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);

  return (
    <div className="min-h-screen bg-background p-5 text-foreground sm:p-8">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-4 sm:px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Users size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{supplier}</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 size={11} />
              <span>{branch}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold">{totalUnits} units</p>
            <p className="text-xs text-muted-foreground">{open.length} open items</p>
          </div>
        </div>

        <div className="border-t border-border/50 bg-muted/20 px-4 py-4 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide">Allocation history</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Open a date to review products issued that day.</p>
            </div>
            <Calendar size={16} className="shrink-0 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {days.map(day => {
              const openCount = day.allocations.filter(allocation => !allocation.isCleared).length;
              const units = day.allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
              const expanded = expandedDate === day.date;
              const productCount = new Set(day.allocations.map(allocation => allocation.breadType)).size;

              return (
                <div key={day.date} className="overflow-hidden rounded-xl border border-border/70 bg-background">
                  <div
                    className="flex cursor-pointer items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/30"
                    onClick={() => setExpandedDate(expanded ? null : day.date)}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${openCount ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                      <Calendar size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{dateLabel(day.date)}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${openCount ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                          {openCount ? "Outstanding" : "Settled"}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {productCount} products · {openCount ? `${openCount} open items` : "Fully settled"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-muted-foreground">{units} units</p>
                    </div>
                    <ChevronRight size={15} className={`text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
                  </div>
                  {expanded && (
                    <div className="space-y-2 border-t border-border/60 bg-muted/20 px-3 py-3">
                      {day.allocations.map((allocation, index) => (
                        <div key={`${allocation.breadType}-${index}`} className="flex items-center gap-2.5 rounded-lg bg-background px-2.5 py-2">
                          {allocation.isCleared
                            ? <CheckCircle2 size={14} className="text-emerald-600" />
                            : <PackageCheck size={14} className="text-amber-600" />}
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{allocation.breadType}</span>
                          <span className="text-sm font-bold">{allocation.quantity}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${allocation.isCleared ? "border-emerald-200 text-emerald-700" : "border-amber-200 text-amber-700"}`}>
                            {allocation.isCleared ? "Settled" : "Open"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}