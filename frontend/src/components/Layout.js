import { Sidebar } from "./Sidebar";
import { useAuth } from "../context/AuthContext";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="font-display text-xl">Fast<span className="text-accent">Vi</span></div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-widest text-muted-foreground" data-testid="mobile-role">{user?.role}</span>
            <Button size="icon" variant="ghost" onClick={handleLogout} data-testid="mobile-logout"><LogOut size={16} /></Button>
          </div>
        </div>
        <div className="p-6 md:p-10">{children}</div>
      </main>
    </div>
  );
}
