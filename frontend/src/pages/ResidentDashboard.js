import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { PhoneCall, QrCode, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function ResidentDashboard() {
  const { user } = useAuth();
  const [calls, setCalls] = useState([]);
  const [passes, setPasses] = useState([]);
  const [visitorName, setVisitorName] = useState("");
  const [validHours, setValidHours] = useState(24);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const [c, p] = await Promise.all([api.get("/calls"), api.get("/passes")]);
      setCalls(c.data);
      setPasses(p.data);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => { load(); }, []);

  async function createPass(e) {
    e.preventDefault();
    if (!visitorName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post("/passes", {
        visitor_name: visitorName,
        valid_hours: Number(validHours) || 24,
      });
      setPasses((prev) => [data, ...prev]);
      setVisitorName("");
      toast.success(`Pass created for ${data.visitor_name}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create pass");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Layout>
      <header className="mb-8 fade-up">
        <div className="label-tiny">Resident dashboard</div>
        <h1 className="font-display text-4xl">Hello, {user?.name?.split(" ")[0]}</h1>
        <p className="text-muted-foreground mt-1">Unit <span className="font-mono">{user?.unit_id ? "assigned" : "not assigned"}</span> · Building <span className="font-mono">{user?.building_id ? "linked" : "—"}</span></p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 card-stroke p-6 fade-up">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-tiny">Call History</div>
              <div className="font-display text-2xl">Recent visitors</div>
            </div>
            <Link to="/resident/history"><Button variant="ghost" size="sm" data-testid="link-history">View all</Button></Link>
          </div>
          {calls.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center" data-testid="no-calls">No calls yet. When someone rings your unit, it will show up here.</div>
          ) : (
            <ul className="divide-y divide-border" data-testid="call-history-list">
              {calls.slice(0, 6).map((c) => (
                <li key={c.id} className="py-3 flex items-center gap-4">
                  <div className="size-10 rounded-full bg-muted grid place-items-center">
                    <PhoneCall size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.visitor_name}</div>
                    <div className="text-xs font-mono text-muted-foreground">{new Date(c.created_at).toLocaleString()} · {c.status}</div>
                  </div>
                  <span className={`text-xs uppercase tracking-widest font-bold px-2 py-1 rounded-full ${
                    c.status === "accepted" ? "bg-primary text-primary-foreground" :
                    c.status === "rejected" ? "bg-destructive text-destructive-foreground" :
                    "bg-secondary text-secondary-foreground"
                  }`}>{c.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-stroke p-6 fade-up">
          <div className="label-tiny mb-2">Quick pass</div>
          <div className="font-display text-2xl mb-4">Pre-approve a visitor</div>
          <form onSubmit={createPass} className="space-y-3" data-testid="create-pass-form">
            <div>
              <Label className="label-tiny">Visitor name</Label>
              <Input value={visitorName} onChange={(e) => setVisitorName(e.target.value)} required className="mt-2" placeholder="Alex Delivery" data-testid="pass-name" />
            </div>
            <div>
              <Label className="label-tiny">Valid for (hours)</Label>
              <Input type="number" min="1" max="168" value={validHours} onChange={(e) => setValidHours(e.target.value)} className="mt-2 font-mono" data-testid="pass-hours" />
            </div>
            <Button type="submit" className="w-full" disabled={creating} data-testid="create-pass-submit">
              <Sparkles size={14} className="mr-2" /> {creating ? "Creating…" : "Generate pass"}
            </Button>
          </form>
        </section>
      </div>

      <section className="mt-8 fade-up">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label-tiny">Active QR passes</div>
            <div className="font-display text-2xl">Your visitor passes</div>
          </div>
        </div>
        {passes.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center card-stroke" data-testid="no-passes">No passes yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="passes-list">
            {passes.map((p) => (
              <div key={p.id} className="card-stroke p-5 flex gap-4 items-center">
                <div className="bg-white p-2 rounded-md border border-border">
                  <QRCodeCanvas value={p.code} size={84} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{p.visitor_name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{p.code}</div>
                  <div className="text-xs mt-1">
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${
                      p.status === "active" ? "bg-accent text-accent-foreground" :
                      p.status === "used" ? "bg-primary text-primary-foreground" :
                      "bg-secondary text-secondary-foreground"
                    }`}>{p.status}</span>
                  </div>
                  <Link to={`/pass/${p.code}`} className="text-xs underline text-muted-foreground inline-flex items-center mt-2"><QrCode size={12} className="mr-1" />Open pass</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
