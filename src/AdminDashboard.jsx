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
  const [userQuery, setUserQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [selectedError, setSelectedError] = useState("");

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

  // Fetch users list
  const fetchUsers = async (q) => {
    setLoadingUsers(true);
    setUsersError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/users?q=${encodeURIComponent(q || "")}` , { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || `Request failed: ${res.status}`);
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (e) {
      setUsersError(e.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch a single user detail
  const fetchUserDetail = async (id) => {
    if (!id) return;
    setLoadingSelected(true);
    setSelectedError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/user/${id}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || `Request failed: ${res.status}`);
      setSelectedUser(data.user || null);
    } catch (e) {
      setSelectedError(e.message || "Failed to load user");
      setSelectedUser(null);
    } finally {
      setLoadingSelected(false);
    }
  };

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

          {/* Users search and details */}
          <div style={{ height: 16 }} />
          <div className="asrar-dash-characters" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 2fr", gap: 16 }}>
            {/* Search + list card */}
            <div className="asrar-character-card">
              <div className="asrar-character-card-inner">
                <div className="asrar-character-card-top asrar-character-card-top--stack">
                  <h3 style={{ margin: 0 }}>{isAr ? "بحث عن المستخدمين" : "Search Users"}</h3>
                </div>
                <div className="asrar-character-text" style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="asrar-settings-input"
                    placeholder={isAr ? "بحث بالبريد أو الاسم" : "Search by email or name"}
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') fetchUsers(userQuery); }}
                    style={{ flex: 1 }}
                  />
                  <button className="asrar-btn primary" onClick={() => fetchUsers(userQuery)}>
                    {isAr ? "بحث" : "Search"}
                  </button>
                </div>
                <div style={{ marginTop: 10 }}>
                  {loadingUsers && <div style={{ color: '#9bb0c6' }}>{isAr ? "جاري التحميل..." : "Loading..."}</div>}
                  {usersError && <div style={{ color: '#ff9cae' }}>{usersError}</div>}
                  {!loadingUsers && !usersError && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, maxHeight: 360, overflow: 'auto', paddingRight: 4 }}>
                      {users.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="asrar-dash-header-link"
                          style={{ textAlign: 'left' }}
                          onClick={() => fetchUserDetail(u.id)}
                          aria-label={`View ${u.email}`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ color: '#eaf6ff' }}>{u.name || '—'}</span>
                            <span style={{ color: '#9bb0c6' }}>{u.email}</span>
                          </div>
                        </button>
                      ))}
                      {users.length === 0 && (
                        <div style={{ color: '#9bb0c6' }}>{isAr ? "لا توجد نتائج." : "No results."}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Details card */}
            <div className="asrar-character-card">
              <div className="asrar-character-card-inner">
                <div className="asrar-character-card-top asrar-character-card-top--stack">
                  <h3 style={{ margin: 0 }}>{isAr ? "معلومات المستخدم" : "User Details"}</h3>
                </div>
                <div className="asrar-character-text">
                  {!selectedUser && !loadingSelected && !selectedError && (
                    <div style={{ color: '#9bb0c6' }}>{isAr ? "اختر مستخدمًا من القائمة" : "Select a user from the list"}</div>
                  )}
                  {loadingSelected && <div style={{ color: '#9bb0c6' }}>{isAr ? "جاري التحميل..." : "Loading..."}</div>}
                  {selectedError && <div style={{ color: '#ff9cae' }}>{selectedError}</div>}
                  {selectedUser && !loadingSelected && !selectedError && (
                    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: 6, columnGap: 10 }}>
                      <div style={{ color: '#9bb0c6' }}>ID</div>
                      <div>{selectedUser.id}</div>
                      <div style={{ color: '#9bb0c6' }}>{isAr ? 'الاسم' : 'Name'}</div>
                      <div>{selectedUser.name || '—'}</div>
                      <div style={{ color: '#9bb0c6' }}>{isAr ? 'البريد' : 'Email'}</div>
                      <div>{selectedUser.email}</div>
                      <div style={{ color: '#9bb0c6' }}>{isAr ? 'الخطة' : 'Plan'}</div>
                      <div>{selectedUser.plan || 'free'}</div>
                      <div style={{ color: '#9bb0c6' }}>{isAr ? 'مميز؟' : 'Premium?'}</div>
                      <div>{selectedUser.isPremium ? 'Yes' : 'No'}</div>
                      <div style={{ color: '#9bb0c6' }}>{isAr ? 'حفظ السجل' : 'Save history'}</div>
                      <div>{selectedUser.saveHistoryEnabled ? 'On' : 'Off'}</div>
                      <div style={{ color: '#9bb0c6' }}>{isAr ? 'تاريخ الإنشاء' : 'Created at'}</div>
                      <div>{new Date(selectedUser.createdAt).toISOString().slice(0,10)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <AsrarFooter />
    </div>
  );
}
