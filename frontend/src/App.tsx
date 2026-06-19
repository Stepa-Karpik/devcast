import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Integrations from "./pages/Integrations";
import Operator from "./pages/Operator";
import RepoSettings from "./pages/RepoSettings";
import Calendar from "./pages/Calendar";
import Profile from "./pages/Profile";

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="grid h-screen place-items-center text-slate-400">Загрузка…</div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/integrations" element={<Protected><Integrations /></Protected>} />
      <Route path="/operator" element={<Protected><Operator /></Protected>} />
      <Route path="/repos" element={<Protected><RepoSettings /></Protected>} />
      <Route path="/calendar" element={<Protected><Calendar /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
