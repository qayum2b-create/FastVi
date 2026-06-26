import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Building2, Users, Activity as ActivityIcon, ShieldCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

function Stat({ label, value, icon: Icon, testId }) {
  return (
    <div className="card-stroke p-5 flex items-center justify-between" data-testid={testId}>
      <div>
        <div className="label-tiny">{label}</div>
        <div className="font-display text-3xl font-mono">{value}</div>
      </div>
      <div className="size-10 rounded-md bg-secondary text-secondary-foreground grid place-items-center">
        <Icon size={18} />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [units, setUnits] = useState([]);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);

  // create building form state
  const [bName, setBName] = useState("");
  const [bAddr, setBAddr] = useState("");
  const [bCode, setBCode] = useState("");
  const [creatingB, setCreatingB] = useState(false);

  // create unit
  const [uBuilding, setUBuilding] = useState("");
  const [uNumber, setUNumber] = useState("");
  const [creatingU, setCreatingU] = useState(false);

  // assign resident
  const [aUser, setAUser] = useState("");
  const [aUnit, setAUnit] = useState("");

  async function loadAll() {
    try {
      const [s, b, u, peep, act] = await Promise.all([
        api.get("/stats/admin"),
        api.get("/buildings"),
        api.get("/units"),
        api.get("/users"),
        api.get("/activity"),
      ]);
      setStats(s.data); setBuildings(b.data); setUnits(u.data);
      setUsers(peep.data); setActivity(act.data);
    } catch (e) {
      toast.error("Failed to load admin data");
    }
  }
  useEffect(() => { loadAll(); }, []);

  async function createBuilding(e) {
    e.preventDefault();
    setCreatingB(true);
    try {
      const { data } = await api.post("/buildings", { name: bName, address: bAddr, code: bCode });
      setBuildings((prev) => [...prev, data]);
      setBName(""); setBAddr(""); setBCode("");
      toast.success("Building created");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Create failed");
    } finally { setCreatingB(false); }
  }

  async function createUnit(e) {
    e.preventDefault();
    setCreatingU(true);
    try {
      const { data } = await api.post("/units", { building_id: uBuilding, number: uNumber });
      setUnits((prev) => [...prev, data]);
      setUNumber("");
      toast.success("Unit created");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Create failed");
    } finally { setCreatingU(false); }
  }

  async function assign() {
    if (!aUser || !aUnit) return;
    try {
      await api.post("/units/assign", { user_id: aUser, unit_id: aUnit });
      toast.success("Resident assigned");
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Assign failed");
    }
  }

  return (
    <Layout>
      <header className="mb-8 fade-up">
        <div className="label-tiny">Control Room</div>
        <h1 className="font-display text-4xl">Admin overview</h1>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <Stat label="Buildings" value={stats?.buildings ?? "—"} icon={Building2} testId="stat-buildings" />
        <Stat label="Units" value={stats?.units ?? "—"} icon={Building2} testId="stat-units" />
        <Stat label="Residents" value={stats?.residents ?? "—"} icon={Users} testId="stat-residents" />
        <Stat label="Guards" value={stats?.guards ?? "—"} icon={ShieldCheck} testId="stat-guards" />
        <Stat label="Today's Activity" value={stats?.daily_activity ?? "—"} icon={ActivityIcon} testId="stat-activity" />
      </div>

      <Tabs defaultValue="buildings">
        <TabsList data-testid="admin-tabs">
          <TabsTrigger value="buildings" data-testid="tab-buildings">Buildings &amp; Units</TabsTrigger>
          <TabsTrigger value="people" data-testid="tab-people">People</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="buildings" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={createBuilding} className="card-stroke p-6 space-y-3" data-testid="form-create-building">
              <div className="font-display text-xl mb-2 flex items-center gap-2"><Plus size={16}/> New building</div>
              <div><Label className="label-tiny">Name</Label><Input value={bName} onChange={(e)=>setBName(e.target.value)} required className="mt-2" data-testid="building-name" /></div>
              <div><Label className="label-tiny">Address</Label><Input value={bAddr} onChange={(e)=>setBAddr(e.target.value)} required className="mt-2" data-testid="building-address" /></div>
              <div><Label className="label-tiny">Code (short, uppercase)</Label><Input value={bCode} onChange={(e)=>setBCode(e.target.value.toUpperCase())} required className="mt-2 font-mono" data-testid="building-code" /></div>
              <Button type="submit" disabled={creatingB} className="w-full" data-testid="create-building-submit">{creatingB?"Creating…":"Create building"}</Button>
            </form>

            <form onSubmit={createUnit} className="card-stroke p-6 space-y-3" data-testid="form-create-unit">
              <div className="font-display text-xl mb-2 flex items-center gap-2"><Plus size={16}/> New unit</div>
              <div>
                <Label className="label-tiny">Building</Label>
                <Select value={uBuilding} onValueChange={setUBuilding}>
                  <SelectTrigger className="mt-2" data-testid="unit-building"><SelectValue placeholder="Choose building" /></SelectTrigger>
                  <SelectContent>
                    {buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="label-tiny">Unit number</Label><Input value={uNumber} onChange={(e)=>setUNumber(e.target.value)} required className="mt-2 font-mono" data-testid="unit-number" /></div>
              <Button type="submit" disabled={creatingU || !uBuilding} className="w-full" data-testid="create-unit-submit">{creatingU?"Creating…":"Create unit"}</Button>
            </form>
          </div>

          <div className="card-stroke p-6 mt-6">
            <div className="font-display text-xl mb-4">Units</div>
            {units.length === 0 ? <div className="text-sm text-muted-foreground">No units yet.</div> : (
              <table className="w-full text-sm" data-testid="units-table">
                <thead>
                  <tr className="label-tiny text-left">
                    <th className="py-2">Unit</th><th>Building</th><th>Residents</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => {
                    const b = buildings.find((x) => x.id === u.building_id);
                    return (
                      <tr key={u.id} className="border-t border-border">
                        <td className="py-2 font-mono">{u.number}</td>
                        <td>{b?.name || u.building_id}</td>
                        <td className="font-mono">{u.resident_ids?.length || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="people" className="mt-6">
          <div className="card-stroke p-6 mb-6">
            <div className="font-display text-xl mb-4">Assign resident → unit</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <Label className="label-tiny">Resident</Label>
                <Select value={aUser} onValueChange={setAUser}>
                  <SelectTrigger className="mt-2" data-testid="assign-user"><SelectValue placeholder="Pick a resident" /></SelectTrigger>
                  <SelectContent>
                    {users.filter(u=>u.role==="resident").map((u)=>(<SelectItem key={u.id} value={u.id}>{u.name} · {u.email}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="label-tiny">Unit</Label>
                <Select value={aUnit} onValueChange={setAUnit}>
                  <SelectTrigger className="mt-2" data-testid="assign-unit"><SelectValue placeholder="Pick a unit" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u)=>(<SelectItem key={u.id} value={u.id}>{u.number} · {buildings.find(b=>b.id===u.building_id)?.code||""}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={assign} disabled={!aUser || !aUnit} data-testid="assign-submit">Assign</Button>
            </div>
          </div>

          <div className="card-stroke p-6">
            <div className="font-display text-xl mb-4">People</div>
            <table className="w-full text-sm" data-testid="users-table">
              <thead><tr className="label-tiny text-left"><th className="py-2">Name</th><th>Email</th><th>Role</th><th>Unit</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="py-2">{u.name}</td>
                    <td className="font-mono text-xs">{u.email}</td>
                    <td><span className="text-xs uppercase font-bold tracking-widest">{u.role}</span></td>
                    <td className="font-mono text-xs">{units.find((un)=>un.id===u.unit_id)?.number || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <div className="card-stroke p-6">
            <div className="font-display text-xl mb-4">Activity log</div>
            {activity.length === 0 ? <div className="text-sm text-muted-foreground">No activity yet.</div> : (
              <ul className="divide-y divide-border" data-testid="activity-list">
                {activity.slice(0, 50).map((a) => (
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
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
