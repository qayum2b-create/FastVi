import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { api } from "../lib/api";

export default function ActivityPage() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get("/activity").then((r) => setItems(r.data)).catch(() => {});
  }, []);
  return (
    <Layout>
      <header className="mb-6 fade-up">
        <div className="label-tiny">Audit</div>
        <h1 className="font-display text-4xl">Activity log</h1>
      </header>
      <div className="card-stroke p-6 fade-up">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No activity yet.</div>
        ) : (
          <ul className="divide-y divide-border" data-testid="activity-page-list">
            {items.map((a) => (
              <li key={a.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{a.visitor_name || "—"}</div>
                  <div className="text-xs font-mono text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                </div>
                <span className="text-xs uppercase font-bold tracking-widest px-2 py-1 rounded-full bg-secondary text-secondary-foreground">{a.type}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
