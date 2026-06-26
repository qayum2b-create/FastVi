import { useEffect, useState, useRef } from "react";
import { Layout } from "../components/Layout";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { toast } from "sonner";
import { ScanLine, CheckCircle2, XCircle, Camera } from "lucide-react";

export default function GuardDashboard() {
  const [activity, setActivity] = useState([]);
  const [passes, setPasses] = useState([]);
  const [manualCode, setManualCode] = useState("");
  const [validateResult, setValidateResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  async function load() {
    try {
      const [a, p] = await Promise.all([api.get("/activity"), api.get("/passes")]);
      setActivity(a.data);
      setPasses(p.data);
    } catch { /* ignore */ }
  }
  useEffect(() => { load(); }, []);

  async function validate(code) {
    if (!code) return;
    try {
      const { data } = await api.post("/passes/validate", { code });
      setValidateResult(data);
      if (data.valid) toast.success(`Approved · ${data.pass?.visitor_name}`);
      else toast.error(`Denied · ${data.reason}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Validate failed");
      setValidateResult({ valid: false, reason: e.response?.data?.detail || "error" });
    }
  }

  async function startScanner() {
    setScanning(true);
    setValidateResult(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const id = "qr-reader";
      const instance = new Html5Qrcode(id);
      html5QrRef.current = instance;
      await instance.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        async (decoded) => {
          await instance.stop();
          html5QrRef.current = null;
          setScanning(false);
          validate(decoded.trim());
        },
        () => { /* ignore frame errors */ }
      );
    } catch (e) {
      setScanning(false);
      toast.error("Camera not available. Use manual entry.");
    }
  }

  async function stopScanner() {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); } catch { /* noop */ }
      html5QrRef.current = null;
    }
    setScanning(false);
  }

  useEffect(() => () => { stopScanner(); }, []);

  return (
    <Layout>
      <header className="mb-8 fade-up">
        <div className="label-tiny">Guard control</div>
        <h1 className="font-display text-4xl">Live front desk</h1>
        <p className="text-muted-foreground mt-1">Approve QR passes, monitor activity, watch the live visitor queue.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 card-stroke p-6 fade-up">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-tiny">QR Pass scanner</div>
              <div className="font-display text-2xl">Validate a visitor</div>
            </div>
            {!scanning ? (
              <Button onClick={startScanner} data-testid="start-scan"><Camera size={14} className="mr-2"/>Start camera</Button>
            ) : (
              <Button variant="outline" onClick={stopScanner} data-testid="stop-scan">Stop camera</Button>
            )}
          </div>

          <div id="qr-reader" ref={scannerRef} className="w-full max-w-md mx-auto rounded-md overflow-hidden" />

          <div className="mt-6 flex gap-2 items-end">
            <div className="flex-1">
              <div className="label-tiny mb-2">Or enter pass code manually</div>
              <Input value={manualCode} onChange={(e)=>setManualCode(e.target.value.toUpperCase())} className="font-mono" placeholder="A1B2C3D4" data-testid="manual-code" />
            </div>
            <Button onClick={()=>validate(manualCode)} data-testid="validate-submit"><ScanLine size={14} className="mr-2"/>Validate</Button>
          </div>

          {validateResult && (
            <div className={`mt-6 p-4 rounded-md border ${validateResult.valid?"bg-emerald-50 border-emerald-300 text-emerald-900":"bg-red-50 border-red-300 text-red-900"}`} data-testid="validate-result">
              <div className="flex items-center gap-2 font-bold">
                {validateResult.valid ? <CheckCircle2/> : <XCircle/>}
                {validateResult.valid ? "Access granted" : `Denied · ${validateResult.reason}`}
              </div>
              {validateResult.pass && (
                <div className="mt-1 text-sm">
                  <span className="font-medium">{validateResult.pass.visitor_name}</span> · <span className="font-mono">{validateResult.pass.code}</span>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="card-stroke p-6 fade-up">
          <div className="label-tiny">Recent passes</div>
          <div className="font-display text-2xl mb-3">Pass queue</div>
          <ul className="space-y-3 max-h-[480px] overflow-y-auto" data-testid="pass-list">
            {passes.slice(0, 20).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.visitor_name}</div>
                  <div className="text-xs font-mono text-muted-foreground">{p.code}</div>
                </div>
                <span className={`text-xs uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${
                  p.status === "active" ? "bg-accent text-accent-foreground" :
                  p.status === "used" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}>{p.status}</span>
              </li>
            ))}
            {passes.length === 0 && <li className="text-sm text-muted-foreground">No passes yet.</li>}
          </ul>
        </aside>
      </div>

      <section className="mt-8 card-stroke p-6 fade-up">
        <div className="font-display text-2xl mb-4">Activity feed</div>
        <ul className="divide-y divide-border" data-testid="guard-activity">
          {activity.slice(0,30).map((a) => (
            <li key={a.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{a.visitor_name || "—"}</div>
                <div className="text-xs font-mono text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
              </div>
              <span className="text-xs uppercase font-bold tracking-widest px-2 py-1 rounded-full bg-secondary text-secondary-foreground">{a.type}</span>
            </li>
          ))}
          {activity.length === 0 && <li className="py-6 text-sm text-muted-foreground text-center">No activity yet.</li>}
        </ul>
      </section>
    </Layout>
  );
}
