import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GlobalWs } from "@/components/GlobalWs";
import { Toaster } from "@/components/ui/sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ResidentDashboard from "@/pages/ResidentDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";
import GuardDashboard from "@/pages/GuardDashboard";
import Kiosk from "@/pages/Kiosk";
import CallScreen from "@/pages/CallScreen";
import PassScreen from "@/pages/PassScreen";
import ActivityPage from "@/pages/ActivityPage";

function RoleHome() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "super_admin") return <Navigate to="/admin" replace />;
  if (user.role === "admin") return <Navigate to="/building-admin" replace />;
  if (user.role === "guard") return <Navigate to="/guard" replace />;
  return <Navigate to="/resident" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GlobalWs />
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/call/:callId" element={<CallScreen />} />
          <Route path="/pass/:code" element={<PassScreen />} />

          <Route path="/home" element={<RoleHome />} />

          {/* Super admin */}
          <Route path="/admin" element={<ProtectedRoute roles={["super_admin"]}><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/activity" element={<ProtectedRoute roles={["super_admin"]}><ActivityPage /></ProtectedRoute>} />

          {/* Building admin */}
          <Route path="/building-admin" element={<ProtectedRoute roles={["admin", "super_admin"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/building-admin/buildings" element={<ProtectedRoute roles={["admin", "super_admin"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/building-admin/people" element={<ProtectedRoute roles={["admin", "super_admin"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/building-admin/activity" element={<ProtectedRoute roles={["admin", "super_admin"]}><ActivityPage /></ProtectedRoute>} />

          {/* Resident */}
          <Route path="/resident" element={<ProtectedRoute roles={["resident"]}><ResidentDashboard /></ProtectedRoute>} />
          <Route path="/resident/passes" element={<ProtectedRoute roles={["resident"]}><ResidentDashboard /></ProtectedRoute>} />
          <Route path="/resident/history" element={<ProtectedRoute roles={["resident"]}><ActivityPage /></ProtectedRoute>} />

          {/* Guard */}
          <Route path="/guard" element={<ProtectedRoute roles={["guard"]}><GuardDashboard /></ProtectedRoute>} />
          <Route path="/guard/scan" element={<ProtectedRoute roles={["guard"]}><GuardDashboard /></ProtectedRoute>} />
          <Route path="/guard/activity" element={<ProtectedRoute roles={["guard"]}><ActivityPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
