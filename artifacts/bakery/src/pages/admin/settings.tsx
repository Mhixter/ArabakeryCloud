import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CreditCard, Eye, EyeOff, Save, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminLayout from "@/components/admin-layout";
import { API_BASE } from "@/lib/api";

function getAdminToken() { return localStorage.getItem("nmb_admin_token"); }

interface GatewayConfig {
  id?: number;
  provider: string;
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  mode: string;
  isActive: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

const PROVIDERS = [
  { value: "paystack", label: "Paystack", color: "bg-blue-100 text-blue-700" },
  { value: "flutterwave", label: "Flutterwave", color: "bg-orange-100 text-orange-700" },
  { value: "manual", label: "Manual (Bank Transfer)", color: "bg-slate-100 text-slate-700" },
];

export default function AdminSettingsPage() {
  const [, setLocation] = useLocation();
  const [config, setConfig] = useState<GatewayConfig>({
    provider: "paystack", publicKey: "", secretKey: "", webhookSecret: "", mode: "test", isActive: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) { setLocation("/admin/login"); return; }
    fetch(API_BASE + "/api/admin/gateway", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.status === 401) { setLocation("/admin/login"); throw new Error("Auth"); } return r.json(); })
      .then(data => { if (data) setConfig(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAdminToken();
    if (!token) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(API_BASE + "/api/admin/gateway", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setConfig(updated);
      setMsg({ type: "success", text: "Payment gateway settings saved successfully." });
    } catch {
      setMsg({ type: "error", text: "Failed to save settings. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const selectedProvider = PROVIDERS.find(p => p.value === config.provider);

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Payment Gateway</h2>
          <p className="text-slate-500 text-sm mt-1">Configure how companies process subscription payments on the platform.</p>
        </div>

        {/* Status banner */}
        <div className={`rounded-xl p-4 flex items-center gap-3 ${config.isActive ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.isActive ? "bg-green-100" : "bg-red-100"}`}>
            {config.isActive ? <CheckCircle size={16} className="text-green-600" /> : <AlertCircle size={16} className="text-red-500" />}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${config.isActive ? "text-green-800" : "text-red-700"}`}>
              Gateway is {config.isActive ? "active" : "inactive"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {config.mode === "test" ? "Running in TEST mode — no real payments processed" : "Running in LIVE mode — real payments active"}
              {config.updatedAt && ` · Last updated ${new Date(config.updatedAt).toLocaleDateString()}`}
            </p>
          </div>
          <Badge className={config.mode === "live" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
            {config.mode === "live" ? "Live" : "Test"}
          </Badge>
        </div>

        <form onSubmit={handleSave}>
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                <CreditCard size={16} className="text-blue-500" /> Gateway Configuration
              </CardTitle>
              <CardDescription>These settings apply to all companies on the platform.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Provider */}
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium">Payment Provider</Label>
                <Select value={config.provider} onValueChange={v => setConfig(c => ({ ...c, provider: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.color}`}>{p.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProvider && (
                  <p className="text-xs text-slate-400">Currently using <strong>{selectedProvider.label}</strong> as the payment processor.</p>
                )}
              </div>

              {/* Mode */}
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium">Environment Mode</Label>
                <Select value={config.mode} onValueChange={v => setConfig(c => ({ ...c, mode: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400" />Test Mode</div>
                    </SelectItem>
                    <SelectItem value="live">
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" />Live Mode</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Public Key */}
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium">
                  {config.provider === "paystack" ? "Paystack Public Key" : config.provider === "flutterwave" ? "Flutterwave Public Key" : "Account Number / Reference"}
                </Label>
                <Input
                  value={config.publicKey}
                  onChange={e => setConfig(c => ({ ...c, publicKey: e.target.value }))}
                  placeholder={config.provider === "paystack" ? "pk_test_..." : config.provider === "flutterwave" ? "FLWPUBK_TEST-..." : "Enter bank account or reference"}
                />
              </div>

              {/* Secret Key */}
              {config.provider !== "manual" && (
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium">
                    {config.provider === "paystack" ? "Paystack Secret Key" : "Flutterwave Secret Key"}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showSecret ? "text" : "password"}
                      value={config.secretKey}
                      onChange={e => setConfig(c => ({ ...c, secretKey: e.target.value }))}
                      placeholder={config.provider === "paystack" ? "sk_test_..." : "FLWSECK_TEST-..."}
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">Stored securely. Never shared with companies.</p>
                </div>
              )}

              {/* Webhook Secret */}
              {config.provider !== "manual" && (
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium">Webhook Secret</Label>
                  <div className="relative">
                    <Input
                      type={showWebhook ? "text" : "password"}
                      value={config.webhookSecret}
                      onChange={e => setConfig(c => ({ ...c, webhookSecret: e.target.value }))}
                      placeholder="Webhook signing secret"
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowWebhook(!showWebhook)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showWebhook ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">Used to verify incoming webhook events from {selectedProvider?.label}.</p>
                </div>
              )}

              {/* Active toggle */}
              <div className="flex items-center justify-between py-3 border-t border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">Enable Gateway</p>
                  <p className="text-xs text-slate-400 mt-0.5">Turn off to temporarily disable all subscription payments.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig(c => ({ ...c, isActive: !c.isActive }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${config.isActive ? "bg-blue-600" : "bg-slate-200"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${config.isActive ? "left-5" : "left-0.5"}`} />
                </button>
              </div>

              {/* Save message */}
              {msg && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {msg.type === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                  {msg.text}
                </div>
              )}

              <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <Save size={15} />
                {saving ? "Saving..." : "Save Gateway Settings"}
              </Button>
            </CardContent>
          </Card>
        </form>

        {/* Info box */}
        <Card className="border border-blue-100 bg-blue-50/40">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Zap size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">How payments work</p>
                <ul className="mt-2 space-y-1.5 text-xs text-blue-700 list-disc ml-4">
                  <li>Companies renew their ₦3,000/month subscription through the Subscription page.</li>
                  <li>Each renewal attempt creates a transaction record with a unique reference.</li>
                  <li>The platform uses these keys to process and verify payments via {selectedProvider?.label ?? "the selected gateway"}.</li>
                  <li>All transaction history is visible on the Transactions page.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
