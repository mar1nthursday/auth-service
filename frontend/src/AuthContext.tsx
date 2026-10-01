import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import * as api from "./api";
import type { User } from "./api";

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  setSession: (accessToken: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setSession = useCallback(async (token: string) => {
    setAccessToken(token);
    const currentUser = await api.me(token);
    setUser(currentUser);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!accessToken) return;
    setUser(await api.me(accessToken));
  }, [accessToken]);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    api
      .refresh()
      .then((res) => setSession(res.accessToken))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [setSession]);

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, setSession, refreshUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
