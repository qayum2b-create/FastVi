import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Home, ShieldCheck, QrCode, Users, Building2, LogOut, Activity, ScanLine, Crown } from "lucide-react";
import { Button } from "./ui/button";

const linksByRole = {
  super_admin: [
    { to: "/admin", label: "Command Center", icon: Crown },
    { to: "/admin/activity", label: "Global Activity", icon: Activity },
  ],
  admin: [
    { to: "/building-admin", label: "Overview", icon: Home },
    { to: "/building-admin/buildings", label: "Buildings", icon: Building2 },
    { to: "/building-admin/people", label: "People", icon: Users },
    { to: "/building-admin/activity", label: "Activity", icon: Activity },
  ],
  resident: [
    { to: "/resident", label: "Dashboard", icon: Home },
    { to: "/resident/passes", label: "Visitor Passes", icon: QrCode },
    { to: "/resident/history", label: "Call History", icon: Activity },
  ],
  guard: [
    { to: "/guard", label: "Live Queue", icon: ShieldCheck },
    { to: "/guard/scan", label: "Scan QR", icon: ScanLine },
    { to: "/guard/activity", label: "Activity Log", icon: Activity },
  ],
};

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = linksByRole[user?.role] || [];
  const isSuper = user?.role === "super_admin";

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-border bg-card min-h-screen p-6 gap-8">
      <div>
        <div className="font-display text-2xl leading-none">Fast<span className="text-accent">Vi</span></div>
        <div className="label-tiny mt-2">{isSuper ? "Platform Command" : "Secure Intercom"}</div>
      </div>

      <nav className="flex flex-col gap-1" data-testid="sidebar-nav">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:bg-muted hover:text-foreground"
              }`
            }
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}

        {/* Super-admin only shortcut visible from any admin session that also has super access */}
        {isSuper && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="label-tiny mb-2 flex items-center gap-1"><Crown size={10} className="text-accent"/> Super</div>
            <NavLink
              to="/admin"
              end
              data-testid="nav-super-admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? "bg-accent text-accent-foreground" : "text-foreground/80 hover:bg-muted hover:text-foreground"
                }`
              }
            >
              <Crown size={16} />
              <span>Command Center</span>
            </NavLink>
          </div>
        )}
      </nav>

      <div className="mt-auto">
        <div className="card-stroke p-3 mb-3">
          <div className="text-xs label-tiny mb-1">Signed in as</div>
          <div className="text-sm font-medium truncate" data-testid="sidebar-user-name">{user?.name}</div>
          <div className="text-xs font-mono text-muted-foreground truncate">{user?.email}</div>
          <div className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full uppercase tracking-widest font-bold ${
            isSuper ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
          }`}>
            {user?.role}
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={handleLogout} data-testid="logout-button">
          <LogOut size={16} className="mr-2" /> Sign out
        </Button>
      </div>
    </aside>
  );
}
