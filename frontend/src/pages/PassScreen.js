import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "../components/ui/button";
import { Calendar, ArrowLeft } from "lucide-react";

export default function PassScreen() {
  const { code } = useParams();
  const [pass, setPass] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get("/passes");
        const found = data.find((p) => p.code === code.toUpperCase());
        if (found) setPass(found);
        else setError("Pass not found");
      } catch {
        setError("You must be signed in to view this pass");
      }
    }
    load();
  }, [code]);

  return (
    <div className="min-h-screen bg-background grain flex items-center justify-center p-6">
      <div className="max-w-md w-full card-stroke p-6 fade-up" style={{
        backgroundImage: "repeating-linear-gradient(45deg, transparent 0 6px, hsl(var(--muted)/0.4) 6px 7px)"
      }}>
        <div className="bg-card rounded-md p-6 border border-dashed border-border" data-testid="pass-card">
          <div className="flex justify-between items-center mb-4">
            <Link to="/resident" className="text-xs underline inline-flex items-center"><ArrowLeft size={12} className="mr-1"/>Back</Link>
            <span className="label-tiny">FastVi · Visitor pass</span>
          </div>
          {error && <div className="text-destructive text-sm" data-testid="pass-error">{error}</div>}
          {pass && (
            <>
              <div className="text-center">
                <div className="bg-white p-4 inline-block rounded-md">
                  <QRCodeCanvas value={pass.code} size={220} />
                </div>
                <div className="font-mono text-xl tracking-widest mt-4" data-testid="pass-code">{pass.code}</div>
                <div className="font-display text-3xl mt-3">{pass.visitor_name}</div>
                <div className="text-xs label-tiny mt-1">Unit · {pass.unit_id}</div>
              </div>
              <div className="border-t border-dashed border-border my-6"></div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="label-tiny mb-1">Issued</div>
                  <div className="font-mono">{new Date(pass.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="label-tiny mb-1">Expires</div>
                  <div className="font-mono">{new Date(pass.valid_until).toLocaleString()}</div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span className={`text-xs uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${
                  pass.status === "active" ? "bg-accent text-accent-foreground" :
                  pass.status === "used" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}>{pass.status}</span>
                <Button variant="outline" size="sm" onClick={() => window.print()}><Calendar size={14} className="mr-2"/>Print</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
