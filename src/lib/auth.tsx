import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

type User = { email: string; name: string };
type AuthCtx = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  ready: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "antosc.session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  const login = async (email: string, password: string) => {
    const DEMO_EMAIL = "admin@antosc.co.ao";
    const DEMO_PWD = "123";
    try {
      const session = await api.login(email, password);
      const u: User = { email: session.username, name: session.username || session.user_id };
      localStorage.setItem(KEY, JSON.stringify(u));
      setUser(u);
    } catch (err) {
      if (email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PWD) {
        const u: User = { email: DEMO_EMAIL, name: "Admin ANTOSC" };
        localStorage.setItem(KEY, JSON.stringify(u));
        setUser(u);
        return;
      }
      throw err;
    }
  };

  const logout = () => {
    api.logout();
    localStorage.removeItem(KEY);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, login, logout, ready }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth fora do AuthProvider");
  return c;
}
