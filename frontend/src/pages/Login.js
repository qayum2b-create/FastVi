import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";

const SIDE_IMG =
  "https://images.unsplash.com/photo-1761533220148-7691628ae8e3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHwxfHxzZWN1cml0eSUyMGd1YXJkJTIwZGVzayUyMGJ1aWxkaW5nfGVufDB8fHx8MTc4MjQ1NzY5M3ww&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function dest(role) {
    if (from) return from;
    if (role === "admin") return "/admin";
    if (role === "guard") return "/guard";
    return "/resident";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      toast.success(`Welcome back, ${res.user.name}`);
      navigate(dest(res.user.role), { replace: true });
    } else {
      setError(res.error);
    }
  }

  function fillDemo(role) {
    if (role === "admin") { setEmail("admin@fastvi.com"); setPassword("admin123"); }
    if (role === "guard") { setEmail("guard@fastvi.com"); setPassword("guard123"); }
    if (role === "resident") { setEmail("resident@fastvi.com"); setPassword("resident123"); }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background">
      <div className="relative hidden lg:block">
        <img src={SIDE_IMG} alt="Building" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/20 to-transparent" />
        <div className="relative h-full flex flex-col justify-between p-10 text-white">
          <Link to="/" className="font-display text-2xl">Fast<span className="text-accent">Vi</span></Link>
          <div>
            <div className="label-tiny text-white/70 mb-2">Welcome back</div>
            <h2 className="font-display text-5xl leading-tight">The lobby is calling.</h2>
            <p className="mt-3 text-sm text-white/80 max-w-md">Sign in to monitor your building, answer doorbell calls and issue visitor passes.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <form className="w-full max-w-sm fade-up" onSubmit={onSubmit} data-testid="login-form">
          <div className="font-display text-3xl mb-1">Sign in</div>
          <div className="text-sm text-muted-foreground mb-6">No account? <Link to="/register" className="underline text-foreground" data-testid="link-register">Create one</Link></div>

          <div className="space-y-4">
            <div>
              <Label className="label-tiny" htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     data-testid="login-email"
                     className="mt-2" placeholder="you@building.com" />
            </div>
            <div>
              <Label className="label-tiny" htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     data-testid="login-password"
                     className="mt-2" placeholder="••••••••" />
            </div>
          </div>

          {error && (
            <div className="mt-4 text-sm text-destructive" data-testid="login-error">{error}</div>
          )}

          <Button type="submit" className="w-full mt-6" disabled={loading} data-testid="login-submit">
            {loading ? "Signing in…" : "Sign in"}
          </Button>

          <div className="mt-6 pt-6 border-t border-border">
            <div className="label-tiny mb-3">Try a demo account</div>
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fillDemo("admin")} data-testid="demo-admin">Admin</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => fillDemo("guard")} data-testid="demo-guard">Guard</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => fillDemo("resident")} data-testid="demo-resident">Resident</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
