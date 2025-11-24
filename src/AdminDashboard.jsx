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
  const [planFilter, setPlanFilter] = useState("all"); // all | premium | free
  const [selectedUser, setSelectedUser] = useState(null);

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

  // Derived users from stats
  const allUsers = Array.isArray(stats?.users) ? stats.users : [];
  const filteredUsers = allUsers.filter((u) => {
    const q = userQuery.trim().toLowerCase();
    const matchesQuery = !q || u.email.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q);
    const isPrem = !!(u.isPremium || u.plan === 'premium' || u.plan === 'pro');
    const matchesPlan =
      planFilter === 'all' ? true : planFilter === 'premium' ? isPrem : !isPrem;
    return matchesQuery && matchesPlan;
  });

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
            <>
              {/* Summary grid */}
              <div className="asrar-dash-characters" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 1fr))", gap: 16 }}>
                {[
                  { labelEn: 'Total Users', labelAr: 'إجمالي المستخدمين', value: stats.totalUsers },
                  { labelEn: 'Premium Users', labelAr: 'مستخدمون بريميوم', value: stats.totalPremiumUsers ?? stats.premiumUsersCount },
                  { labelEn: 'Free Users', labelAr: 'مستخدمون مجاناً', value: (stats.totalFreeUsers ?? (stats.totalUsers - ((stats.totalPremiumUsers ?? stats.premiumUsersCount) ?? 0))) },
                  { labelEn: 'Estimated MRR ($/mo)', labelAr: 'إيراد شهري تقديري ($)', value: stats.estimatedMrr ?? ((stats.totalPremiumUsers ?? stats.premiumUsersCount) * 4.99) },
                ].map((card, idx) => (
                  <div key={idx} className="asrar-character-card">
                    <div className="asrar-character-card-inner">
                      <div className="asrar-character-card-top asrar-character-card-top--stack">
                        <h3 style={{ margin: 0 }}>{isAr ? card.labelAr : card.labelEn}</h3>
                      </div>
                      <div className="asrar-character-text" style={{ fontSize: 28, fontWeight: 700, textAlign: 'center' }}>{card.value}</div>
                      <div style={{ color: '#9bb0c6', fontSize: 12, textAlign: 'center' }}>{isAr ? 'تم التحديث الآن' : 'Updated just now'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Users table and details */}
          <div style={{ height: 16 }} />
          <div className="asrar-dash-characters" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            {/* Users card */}
            <div className="asrar-character-card">
              <div className="asrar-character-card-inner">
                <div className="asrar-character-card-top asrar-character-card-top--stack">
                  <h3 style={{ margin: 0 }}>{isAr ? 'المستخدمون' : 'Users'}</h3>
                </div>
                {/* Filters */}
                <div className="asrar-character-text" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="asrar-settings-input"
                    placeholder={isAr ? 'بحث بالبريد' : 'Search by email'}
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <select
                    className="asrar-dash-dialect-select"
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    style={{ minWidth: 140 }}
                  >
                    <option value="all">{isAr ? 'الكل' : 'All'}</option>
                    <option value="premium">{isAr ? 'بريميوم فقط' : 'Premium only'}</option>
                    <option value="free">{isAr ? 'مجاني فقط' : 'Free only'}</option>
                  </select>
                </div>
                {/* Table */}
                <div style={{ marginTop: 10, maxHeight: 420, overflow: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.8fr 1.2fr 1.2fr', padding: '8px 6px', color: '#9bb0c6', borderBottom: '1px solid rgba(155,176,198,0.2)' }}>
                    <div>{isAr ? 'البريد' : 'Email'}</div>
                    <div>{isAr ? 'الاسم' : 'Name'}</div>
                    <div>{isAr ? 'الخطة' : 'Plan'}</div>
                    <div>{isAr ? 'تاريخ الإنشاء' : 'Created At'}</div>
                    <div>{isAr ? 'الاستخدام الشهري' : 'Monthly Usage'}</div>
                  </div>
                  {filteredUsers.map((u) => {
                    const isSelected = selectedUser && selectedUser.id === u.id;
                    const planLabel = u.plan || (u.isPremium ? 'premium' : 'free');
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setSelectedUser(u)}
                        className="asrar-dash-header-link"
                        style={{
                          textAlign: 'left',
                          width: '100%',
                          padding: 0,
                          background: isSelected ? 'rgba(0,240,255,0.08)' : 'transparent',
                        }}
                        aria-label={`Select ${u.email}`}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.8fr 1.2fr 1.2fr', padding: '10px 6px', borderBottom: '1px solid rgba(155,176,198,0.12)' }}>
                          <div style={{ color: '#eaf6ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                          <div style={{ color: '#eaf6ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name || '—'}</div>
                          <div style={{ color: u.isPremium ? '#9be7c4' : '#9bb0c6' }}>{planLabel}</div>
                          <div style={{ color: '#9bb0c6' }}>{new Date(u.createdAt).toISOString().slice(0, 10)}</div>
                          <div style={{ color: '#eaf6ff' }}>{(u.monthlyUsed ?? 0)} / {(u.monthlyLimit ?? 0)}</div>
                        </div>
                      </button>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <div style={{ padding: 10, color: '#9bb0c6' }}>{isAr ? 'لا توجد نتائج.' : 'No results.'}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Details card */}
            <div className="asrar-character-card">
              <div className="asrar-character-card-inner">
                <div className="asrar-character-card-top asrar-character-card-top--stack">
                  <h3 style={{ margin: 0 }}>{isAr ? 'تفاصيل المستخدم' : 'User Details'}</h3>
                </div>
                <div className="asrar-character-text">
                  {!selectedUser && (
                    <div style={{ color: '#9bb0c6' }}>{isAr ? 'اختر مستخدمًا من الجدول' : 'Select a user from the table'}</div>
                  )}
                  {selectedUser && (
                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 6, columnGap: 10 }}>
                      <div style={{ color: '#9bb0c6' }}>ID</div>
                      <div>{selectedUser.id}</div>
                      <div style={{ color: '#9bb0c6' }}>{isAr ? 'الاسم' : 'Name'}</div>
                      <div>{selectedUser.name || '—'}</div>
                      <div style={{ color: '#9bb0c6' }}>{isAr ? 'البريد' : 'Email'}</div>
                      <div>{selectedUser.email}</div>
                      <div style={{ color: '#9bb0c6' }}>{isAr ? 'الخطة' : 'Plan'}</div>
                      <div>{selectedUser.plan || (selectedUser.isPremium ? 'premium' : 'free')}</div>
                      <div style={{ color: '#9bb0c6' }}>{isAr ? 'مميز؟' : 'Premium?'}</div>
                      <div>{selectedUser.isPremium ? 'Yes' : 'No'}</div>
                      <div style={{ color: '#9bb0c6' }}>{isAr ? 'تاريخ الإنشاء' : 'Created at'}</div>
                      <div>{new Date(selectedUser.createdAt).toISOString().slice(0, 10)}</div>
                      <div style={{ color: '#9bb0c6' }}>{isAr ? 'آخر دخول' : 'Last login'}</div>
                      <div>{selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toISOString().slice(0, 10) : '—'}</div>
                      <div style={{ color: '#9bb0c6' }}>{isAr ? 'الاستخدام اليومي' : 'Daily usage'}</div>
                      <div>{selectedUser.dailyUsed ?? 0}</div>
                      <div style={{ color: '#9bb0c6' }}>{isAr ? 'الاستخدام الشهري' : 'Monthly usage'}</div>
                      <div>{selectedUser.monthlyUsed ?? 0}</div>
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
