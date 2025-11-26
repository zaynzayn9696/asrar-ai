// src/GoogleAuthComplete.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, TOKEN_KEY } from "./hooks/useAuth";
import { API_BASE } from "./apiBase";

export default function GoogleAuthComplete() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");

        if (!token) {
          console.error("[GoogleAuthComplete] Missing token in URL");
          navigate("/login", { replace: true });
          return;
        }

        // Save token for future /auth/me calls
        if (typeof window !== "undefined") {
          localStorage.setItem(TOKEN_KEY, token);
        }

        // Fetch the full user using the Bearer token
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          method: "GET",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          console.error("[GoogleAuthComplete] /auth/me failed", res.status);
          navigate("/login", { replace: true });
          return;
        }

        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }

        navigate("/dashboard", { replace: true });
      } catch (err) {
        console.error("[GoogleAuthComplete] error:", err);
        navigate("/login", { replace: true });
      }
    };

    run();
  }, [navigate, setUser]);

  return (
    <div className="full-page-spinner">
      {/* You can style this however you like */}
      Connecting your Google account...
    </div>
  );
}
