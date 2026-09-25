import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { api } from "../lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Building2, Users, ShieldCheck, Activity as ActivityIcon, Crown, QrCode, PhoneCall, Globe2 } from "lucide-react";

function Stat({ label, value, icon: Icon, testId, accent }) {
  return (
    <div className="card-stroke p-5 flex items-center justify-between" data-testid={testId}>
      <div>
        <div className="label-tiny">{label}</div>
        <div className="font-display text-3xl font-mono">{value ?? "—"}</div>
      </div>
      <div className={`size-10 rounded-md grid place-items-center ${accent ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
        <Icon size={18} />
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [s, u, b, a] = await Promise.all([
          api.get("/stats/platform"),
          api.get("/platform/users"),
          api.get("/buildings"),
          api.get("/platform/activity"),
        ]);
        setStats(s.data); setUsers(u.data); setBuildings(b.data); setActivity(a.data);
      } catch { /* ignore */ }
    }
    load();
  }, []);

  return (
    <Layout>
      <header className="mb-8 fade-up flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="label-tiny flex items-center gap-2"><Crown size={12} className="text-accent"/> Super admin · Platform control</div>
          <h1 className="font-display text-4xl">FastVi Command Center</h1>
          <p className="text-muted-foreground mt-1">Global visibility across every building, resident, guard and pass on FastVi.</p>
        </div>
        <span className="text-xs font-mono px-3 py-1 rounded-full bg-primary text-primary-foreground">SUPER ADMIN</span>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Stat label="Users" value={stats?.users_total} icon={Users} testId="sa-stat-users" accent />
        <Stat label="Buildings" value={stats?.buildings} icon={Building2} testId="sa-stat-buildings" />
        <Stat label="Units" value={stats?.units} icon={Building2} testId="sa-stat-units" />
        <Stat label="Guards" value={stats?.guards} icon={ShieldCheck} testId="sa-stat-guards" />
        <Stat label="Active passes" value={stats?.passes_active} icon={QrCode} testId="sa-stat-passes" />
        <Stat label="Calls (all-time)" value={stats?.calls_total} icon={PhoneCall} testId="sa-stat-calls" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card-stroke p-5" data-testid="sa-stat-online">
          <div className="label-tiny">Online right now</div>
          <div className="font-display text-3xl font-mono">{stats?.online_users ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Users with a live WebSocket connection</div>
        </div>
        <div className="card-stroke p-5" data-testid="sa-stat-weekly">
          <div className="label-tiny">Activity (7-day)</div>
          <div className="font-display text-3xl font-mono">{stats?.weekly_activity ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Total events across every building</div>
        </div>
        <div className="card-stroke p-5" data-testid="sa-stat-admins">
          <div className="label-tiny">Building admins</div>
          <div className="font-display text-3xl font-mono">{stats?.admins ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Provisioned managers on the platform</div>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList data-testid="sa-tabs">
          <TabsTrigger value="users" data-testid="sa-tab-users">All users</TabsTrigger>
          <TabsTrigger value="buildings" data-testid="sa-tab-buildings">Buildings</TabsTrigger>
          <TabsTrigger value="activity" data-testid="sa-tab-activity"><Globe2 size={14} className="mr-1"/>Global activity</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <div className="card-stroke p-6">
            <div className="font-display text-xl mb-4">Every user on FastVi</div>
            <table className="w-full text-sm" data-testid="sa-users-table">
              <thead><tr className="label-tiny text-left">
                <th className="py-2">Name</th><th>Email</th><th>Role</th><th>Building</th><th>Joined</th>
              </tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="py-2">{u.name}</td>
                    <td className="font-mono text-xs">{u.email}</td>
                    <td>
                      <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full ${
                        u.role === "super_admin" ? "bg-accent text-accent-foreground" :
                        u.role === "admin" ? "bg-primary text-primary-foreground" :
                        "bg-secondary text-secondary-foreground"
                      }`}>{u.role}</span>
                    </td>
                    <td className="font-mono text-xs">{buildings.find(b => b.id === u.building_id)?.code || "—"}</td>
                    <td className="font-mono text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No users yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="buildings" className="mt-6">
          <div className="card-stroke p-6">
            <div className="font-display text-xl mb-4">Buildings</div>
            <table className="w-full text-sm" data-testid="sa-buildings-table">
              <thead><tr className="label-tiny text-left">
                <th className="py-2">Name</th><th>Code</th><th>Address</th><th>Created</th>
              </tr></thead>
              <tbody>
                {buildings.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="py-2">{b.name}</td>
                    <td className="font-mono text-xs">{b.code}</td>
                    <td className="text-muted-foreground">{b.address}</td>
                    <td className="font-mono text-xs">{b.created_at ? new Date(b.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
                {buildings.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No buildings yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <div className="card-stroke p-6">
            <div className="font-display text-xl mb-4">Global activity stream</div>
            <ul className="divide-y divide-border" data-testid="sa-activity">
              {activity.map((a) => (
                <li key={a.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{a.visitor_name || "—"}</div>
                    <div className="text-xs font-mono text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                  <span className="text-xs uppercase font-bold tracking-widest px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                    <ActivityIcon size={12} className="inline mr-1"/>{a.type}
                  </span>
                </li>
              ))}
              {activity.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Nothing has happened yet.</li>}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
