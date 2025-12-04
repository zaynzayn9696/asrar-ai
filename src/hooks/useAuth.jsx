// src/hooks/useAuth.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { API_BASE } from "../apiBase";

export const TOKEN_KEY = "asrar_token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Load current user from /api/auth/me using the cookie
  useEffect(() => {
    const loadUser = async () => {
      const isDev = import.meta.env.DEV;
      const isLocalhost = ["localhost", "127.0.0.1"].includes(
        window.location.hostname
      );
      const devBypass =
        isDev &&
        isLocalhost &&
        import.meta.env.VITE_ASRAR_DEV_BYPASS_AUTH === "true";

      if (devBypass) {
        setUser({
          id: "dev-user-id",
          email: "dev@asrar.local",
          name: "Dev User",
        });
        setIsAuthLoading(false);
        console.info("[DEV AUTH] Bypass activated — fake user injected.");
        return;
      }

      try {
        const token =
          typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
        const headers = {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        };

        const res = await fetch(`${API_BASE}/api/auth/me?_=${Date.now()}`, {
          method: "GET",
          credentials: "include",
          headers,
          cache: "no-store",
        });

        let data = null;
        try {
          const text = await res.text();
          data = text ? JSON.parse(text) : null;
        } catch (_) {
          data = null;
        }

        if (res.ok) {
          const u = data?.user ?? data ?? null;
          setUser(u);
        } else if (res.status === 304) {
          setUser((prev) => prev ?? null);
        } else if (res.status === 401) {
          setUser(null);
        } else {
          console.error("/api/auth/me failed", res.status, data);
          setUser(null);
        }
      } catch (err) {
        console.error("Error loading /auth/me:", err);
        setUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    loadUser();
  }, []);

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem(TOKEN_KEY);
      }
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, isAuthLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
