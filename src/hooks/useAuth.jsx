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
  const [loading, setLoading] = useState(true);

  // Load current user from /api/auth/me using the cookie
  useEffect(() => {
    const loadUser = async () => {
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem(TOKEN_KEY)
            : null;

        const headers = token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined;

        const res = await fetch(`${API_BASE}/api/auth/me`, {
          method: "GET",
          credentials: "include", // 👈 send cookies
          headers,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          console.error("/api/auth/me failed", res.status, errBody);
          setUser(null);
        } else {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {
        console.error("Error loading /auth/me:", err);
        setUser(null);
      } finally {
        setLoading(false);
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
    <AuthContext.Provider value={{ user, setUser, loading, logout }}>
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
