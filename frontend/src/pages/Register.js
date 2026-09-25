import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("resident");
  const [buildingCode, setBuildingCode] = useState("FASTVI");
  const [unitNumber, setUnitNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const payload = { name, email, password, role };
    if (role === "resident") {
      payload.building_code = buildingCode;
      payload.unit_number = unitNumber;
    }
    const res = await register(payload);
    setLoading(false);
    if (res.ok) {
      toast.success(`Welcome, ${res.user.name}`);
      const role = res.user.role;
      navigate(role === "super_admin" ? "/admin"
              : role === "admin" ? "/building-admin"
              : role === "guard" ? "/guard"
              : "/resident", { replace: true });
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background grain p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md card-stroke p-8 fade-up" data-testid="register-form">
        <Link to="/" className="font-display text-2xl">Fast<span className="text-accent">Vi</span></Link>
        <div className="font-display text-3xl mt-4 mb-1">Create account</div>
        <div className="text-sm text-muted-foreground mb-6">Already have one? <Link to="/login" className="underline text-foreground" data-testid="link-login">Sign in</Link></div>

        <div className="space-y-4">
          <div>
            <Label className="label-tiny">Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-2" data-testid="register-name" />
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="label-tiny">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-2" data-testid="register-email" />
            </div>
            <div>
              <Label className="label-tiny">Password</Label>
              <Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-2" data-testid="register-password" />
            </div>
          </div>

          <div>
            <Label className="label-tiny">I am a</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="mt-2" data-testid="register-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="resident">Resident</SelectItem>
                <SelectItem value="guard">Security guard</SelectItem>
                <SelectItem value="admin">Building admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === "resident" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-tiny">Building code</Label>
                <Input value={buildingCode} onChange={(e) => setBuildingCode(e.target.value.toUpperCase())} className="mt-2 font-mono" data-testid="register-building" />
              </div>
              <div>
                <Label className="label-tiny">Unit</Label>
                <Input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="101" className="mt-2 font-mono" data-testid="register-unit" />
              </div>
            </div>
          )}
        </div>

        {error && <div className="mt-4 text-sm text-destructive" data-testid="register-error">{error}</div>}

        <Button type="submit" className="w-full mt-6" disabled={loading} data-testid="register-submit">
          {loading ? "Creating…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
