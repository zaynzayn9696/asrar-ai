// src/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import "./HomePage.css";
import "./Dashboard.css";
import AsrarHeader from "./AsrarHeader";
import AsrarFooter from "./AsrarFooter";
import { useAuth } from "./hooks/useAuth";
import { API_BASE } from "./apiBase";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [lang, setLang] = useState(() => (typeof window !== "undefined" ? (localStorage.getItem("asrar-lang") || "en") : "en"));
  const isAr = lang === "ar";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let aborted = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/admin/stats`, { credentials: "include" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || data?.message || `Request failed: ${res.status}`);
        }
        const data = await res.json();
        if (!aborted) setStats(data);
      } catch (e) {
        if (!aborted) setError(e.message || "Failed to load stats");
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    load();
    return () => { aborted = true; };
  }, []);

  const handleLangSwitch = (newLang) => {
    if (newLang === lang) return;
    if (typeof window !== "undefined") localStorage.setItem("asrar-lang", newLang);
    setLang(newLang);
  };

  return (
    <div className={`asrar-dash-page asrar-dashboard-page ${isAr ? "asrar-dash-page--ar" : ""}`}> 
      <div className="asrar-dash-orbit asrar-dash-orbit--top" />
      <div className="asrar-dash-orbit asrar-dash-orbit--bottom" />

      <AsrarHeader lang={lang} isAr={isAr} onLangChange={handleLangSwitch} onLogout={logout} />

      <main className="asrar-dash-main">
        <section className="asrar-dash-panel" dir={isAr ? "rtl" : "ltr"}>
          <p className="asrar-dash-eyebrow">{isAr ? "لوحة المدير" : "Admin Panel"}</p>
          <h1 className="asrar-dash-title">{isAr ? "إحصائيات المستخدمين" : "User Stats"}</h1>
          <p className="asrar-dash-subtitle">{isAr ? "نظرة عامة سريعة على المستخدمين" : "A quick overview of users"}</p>

          {loading && <div style={{ padding: 16 }}>{isAr ? "جاري التحميل..." : "Loading..."}</div>}
          {error && !loading && (
            <div style={{ padding: 16, color: "#ff9cae" }}>{isAr ? `خطأ: ${error}` : `Error: ${error}`}</div>
          )}

          {!loading && !error && stats && (
            <div className="asrar-dash-characters" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <div className="asrar-character-card">
                <div className="asrar-character-card-inner">
                  <div className="asrar-character-card-top asrar-character-card-top--stack">
                    <h3 style={{ margin: 0 }}>{isAr ? "إجمالي المستخدمين" : "Total Users"}</h3>
                  </div>
                  <div className="asrar-character-text" style={{ fontSize: 28, fontWeight: 700 }}>{stats.totalUsers}</div>
                </div>
              </div>

              <div className="asrar-character-card">
                <div className="asrar-character-card-inner">
                  <div className="asrar-character-card-top asrar-character-card-top--stack">
                    <h3 style={{ margin: 0 }}>{isAr ? "آخر 7 أيام" : "Last 7 Days"}</h3>
                  </div>
                  <div className="asrar-character-text" style={{ fontSize: 28, fontWeight: 700 }}>{stats.usersLast7Days}</div>
                </div>
              </div>

              <div className="asrar-character-card" style={{ gridColumn: "1 / -1" }}>
                <div className="asrar-character-card-inner">
                  <div className="asrar-character-card-top asrar-character-card-top--stack">
                    <h3 style={{ margin: 0 }}>{isAr ? "آخر 14 يوماً (حسب اليوم)" : "Last 14 Days (by day)"}</h3>
                  </div>
                  <div className="asrar-character-text" style={{ width: "100%" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 8 }}>
                      {stats.usersByDayLast14Days?.map((row) => (
                        <React.Fragment key={row.date}>
                          <div style={{ color: "#9bb0c6" }}>{row.date}</div>
                          <div style={{ fontWeight: 600 }}>{row.count}</div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
      <AsrarFooter />
    </div>
  );
}
