import { useState, useRef, useEffect } from "react";
import { getToken, getStoredCompany, setStoredCompany, StoredCompany } from "@/lib/auth";
import { applyTheme, THEME_COLORS } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Upload, Building2, Palette, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CompanySettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [company, setCompany] = useState<StoredCompany | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", themeColor: "amber", logoUrl: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadCompany = async () => {
      try {
        const token = getToken();
        const res = await fetch("/api/company", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setCompany(data);
          setForm({ name: data.name ?? "", phone: data.phone ?? "", address: data.address ?? "", themeColor: data.themeColor ?? "amber", logoUrl: data.logoUrl ?? "" });
        }
      } finally {
        setFetching(false);
      }
    };
    loadCompany();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) { toast({ title: "Logo must be under 200KB", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setForm(f => ({ ...f, logoUrl: ev.target?.result as string })); };
    reader.readAsDataURL(file);
  };

  const handleThemeChange = (color: string) => {
    setForm(f => ({ ...f, themeColor: color }));
    applyTheme(color);
  };

  const handleSave = async () => {
    if (!form.name) { toast({ title: "Company name is required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.name, phone: form.phone || null, address: form.address || null, themeColor: form.themeColor, logoUrl: form.logoUrl || null }),
      });
      if (!res.ok) { const d = await res.json(); toast({ title: d.error ?? "Failed to save", variant: "destructive" }); return; }
      const updated = await res.json();
      setCompany(updated);
      setStoredCompany(updated);
      applyTheme(updated.themeColor);
      toast({ title: "Company settings saved!" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 max-w-2xl" data-testid="page-company-settings">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Company Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Customize your bakery's branding and information</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 size={18} />Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {company?.loginId && (
            <div className="flex items-center justify-between rounded-lg bg-muted/50 border border-border px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Company Login ID</p>
                <p className="font-mono text-lg font-bold tracking-widest text-foreground mt-0.5">{company.loginId}</p>
              </div>
              <div className="text-xs text-muted-foreground text-right max-w-[180px]">
                Share with staff to log in using your company account
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Company Name <span className="text-destructive">*</span></Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your bakery name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="08012345678" />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Street address" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload size={18} />Logo</CardTitle><CardDescription>Appears on receipts and the dashboard. Max 200KB.</CardDescription></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {form.logoUrl ? (
              <div className="relative w-24 h-24 rounded-lg border border-border overflow-hidden bg-muted flex items-center justify-center">
                <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                <button onClick={() => setForm(f => ({ ...f, logoUrl: "" }))} className="absolute top-1 right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"><X size={10} className="text-white" /></button>
              </div>
            ) : (
              <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                <Upload size={24} className="text-muted-foreground" />
              </div>
            )}
            <div>
              <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload size={14} className="mr-2" />Upload Logo</Button>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, or SVG. Max 200KB.</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Palette size={18} />Theme Color</CardTitle><CardDescription>Changes the UI color scheme across the app.</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-3">
            {THEME_COLORS.map(theme => (
              <button key={theme.value} onClick={() => handleThemeChange(theme.value)} className={cn("relative rounded-xl border-2 p-3 text-center transition-all", form.themeColor === theme.value ? "border-primary shadow-md" : "border-border hover:border-muted-foreground")}>
                <div className="w-8 h-8 rounded-full mx-auto mb-2 shadow-sm" style={{ backgroundColor: theme.hex }} />
                <p className="text-xs font-medium">{theme.label}</p>
                <p className="text-xs text-muted-foreground hidden sm:block">{theme.description}</p>
                {form.themeColor === theme.value && <CheckCircle size={14} className="absolute top-1.5 right-1.5 text-primary" />}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={loading} size="lg">
        {loading ? <><Loader2 size={16} className="mr-2 animate-spin" />Saving...</> : "Save Changes"}
      </Button>
    </div>
  );
}
