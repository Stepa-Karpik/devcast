import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, clearToken, getToken, setToken, type User } from "../api/client";
import { setTimezone } from "../lib/time";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<User>("/api/auth/me");
      setUser(data);
      setTimezone(data.timezone);
    } catch {
      clearToken();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post("/api/auth/login", { email, password });
    setToken(data.access_token);
    await loadMe();
  }
  async function register(email: string, password: string) {
    const { data } = await api.post("/api/auth/register", { email, password });
    setToken(data.access_token);
    await loadMe();
  }
  function logout() {
    clearToken();
    setUser(null);
    location.href = "/login";
  }

  return (
    <Ctx.Provider value={{ user, loading, login, register, refresh: loadMe, logout }}>
      {children}
    </Ctx.Provider>
  );
}
