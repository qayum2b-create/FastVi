import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="label-tiny" data-testid="auth-loading">Verifying session…</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (roles && !roles.includes(user.role)) {
    const fallback = user.role === "super_admin" ? "/admin"
                    : user.role === "admin" ? "/building-admin"
                    : user.role === "guard" ? "/guard"
                    : "/resident";
    return <Navigate to={fallback} replace />;
  }
  return children;
}
