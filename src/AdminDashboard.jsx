// src/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import "./HomePage.css";
import "./AdminDashboard.css";
import AsrarHeader from "./AsrarHeader";
import AsrarFooter from "./AsrarFooter";
import { useAuth } from "./hooks/useAuth";
import { API_BASE } from "./apiBase";

// Stat Card Component
function StatCard({ label, value, subtext, isAr }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-card-inner">
        <div className="admin-stat-label">{label}</div>
        <div className="admin-stat-value">{value}</div>
        <div className="admin-stat-subtext">{subtext}</div>
      </div>
    </div>
  );
}

// Users Table Component
function UsersTable({ users, selectedUser, onSelectUser, isAr }) {
  if (users.length === 0) {
    return (
      <div className="admin-table-empty">
        {isAr ? "لا توجد نتائج." : "No results."}
      </div>
    );
  }

  return (
    <div className="admin-table-wrapper">
      <div className="admin-table-header">
        <div className="admin-table-header-cell">{isAr ? "البريد" : "Email"}</div>
        <div className="admin-table-header-cell">{isAr ? "الاسم" : "Name"}</div>
        <div className="admin-table-header-cell">{isAr ? "الخطة" : "Plan"}</div>
        <div className="admin-table-header-cell">{isAr ? "تاريخ الإنشاء" : "Created"}</div>
        <div className="admin-table-header-cell">{isAr ? "الاستخدام" : "Usage"}</div>
      </div>
      {users.map((u) => {
        const isSelected = selectedUser && selectedUser.id === u.id;
        const planLabel = u.plan || (u.isPremium ? "premium" : "free");
        const isPremium = !!(u.isPremium || u.plan === "premium" || u.plan === "pro");

        return (
          <button
            key={u.id}
            type="button"
            onClick={() => onSelectUser(u)}
            className={`admin-table-row ${isSelected ? "selected" : ""}`}
            aria-label={`Select ${u.email}`}
          >
            <div className="admin-table-cell" data-label={isAr ? "البريد" : "Email"}>
              {u.email}
            </div>
            <div className="admin-table-cell" data-label={isAr ? "الاسم" : "Name"}>
              {u.name || "—"}
            </div>
            <div className={`admin-table-cell ${isPremium ? "premium" : "muted"}`} data-label={isAr ? "الخطة" : "Plan"}>
              {planLabel}
            </div>
            <div className="admin-table-cell muted" data-label={isAr ? "تاريخ الإنشاء" : "Created"}>
              {new Date(u.createdAt).toISOString().slice(0, 10)}
            </div>
            <div className="admin-table-cell" data-label={isAr ? "الاستخدام" : "Usage"}>
              {u.monthlyUsed ?? 0} / {u.monthlyLimit ?? 0}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// User Details Panel Component
function UserDetailsPanel({ user, isAr }) {
  if (!user) {
    return (
      <div className="admin-details-placeholder">
        {isAr ? "اختر مستخدمًا من الجدول" : "Select a user from the table"}
      </div>
    );
  }

  return (
    <div className="admin-details-grid">
      <div className="admin-details-label">ID</div>
      <div className="admin-details-value">{user.id}</div>

      <div className="admin-details-label">{isAr ? "الاسم" : "Name"}</div>
      <div className="admin-details-value">{user.name || "—"}</div>

      <div className="admin-details-label">{isAr ? "البريد" : "Email"}</div>
      <div className="admin-details-value">{user.email}</div>

      <div className="admin-details-label">{isAr ? "الخطة" : "Plan"}</div>
      <div className="admin-details-value">{user.plan || (user.isPremium ? "premium" : "free")}</div>

      <div className="admin-details-label">{isAr ? "مميز؟" : "Premium?"}</div>
      <div className="admin-details-value">{user.isPremium ? "Yes" : "No"}</div>

      <div className="admin-details-label">{isAr ? "تاريخ الإنشاء" : "Created at"}</div>
      <div className="admin-details-value">{new Date(user.createdAt).toISOString().slice(0, 10)}</div>

      <div className="admin-details-label">{isAr ? "آخر دخول" : "Last login"}</div>
      <div className="admin-details-value">
        {user.lastLoginAt ? new Date(user.lastLoginAt).toISOString().slice(0, 10) : "—"}
      </div>

      <div className="admin-details-label">{isAr ? "الاستخدام اليومي" : "Daily usage"}</div>
      <div className="admin-details-value">{user.dailyUsed ?? 0}</div>

      <div className="admin-details-label">{isAr ? "الاستخدام الشهري" : "Monthly usage"}</div>
      <div className="admin-details-value">{user.monthlyUsed ?? 0}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [lang, setLang] = useState(() => (typeof window !== "undefined" ? (localStorage.getItem("asrar-lang") || "en") : "en"));
  const isAr = lang === "ar";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [userQuery, setUserQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

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
  const total = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const currentUsers = filteredUsers.slice(start, start + pageSize);

  useEffect(() => { setPage(1); }, [userQuery, planFilter]);

  const handleLangSwitch = (newLang) => {
    if (newLang === lang) return;
    if (typeof window !== "undefined") localStorage.setItem("asrar-lang", newLang);
    setLang(newLang);
  };

  return (
    <div className={`asrar-page admin-page ${isAr ? "asrar-page--ar" : ""}`} dir={isAr ? "rtl" : "ltr"}>
      <AsrarHeader lang={lang} isAr={isAr} onLangChange={handleLangSwitch} onLogout={logout} />

      <main className="admin-content">
        {/* Header */}
        <div className="admin-header">
          <p className="admin-eyebrow">{isAr ? "لوحة المدير" : "Admin Panel"}</p>
          <h1 className="admin-title">{isAr ? "إحصائيات المستخدمين" : "User Statistics"}</h1>
          <p className="admin-subtitle">
            {isAr ? "نظرة عامة سريعة على المستخدمين والإيرادات" : "Quick overview of users and revenue"}
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="admin-loading">{isAr ? "جاري التحميل..." : "Loading..."}</div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="admin-error">{isAr ? `خطأ: ${error}` : `Error: ${error}`}</div>
        )}

        {/* Main Content */}
        {!loading && !error && stats && (
          <>
            {/* Stats Grid */}
            <div className="admin-stats-grid">
              <StatCard
                label={isAr ? "إجمالي المستخدمين" : "Total Users"}
                value={stats.totalUsers || 0}
                subtext={isAr ? "تم التحديث الآن" : "Updated just now"}
                isAr={isAr}
              />
              <StatCard
                label={isAr ? "مستخدمون بريميوم" : "Premium Users"}
                value={stats.totalPremiumUsers ?? stats.premiumUsersCount ?? 0}
                subtext={isAr ? "تم التحديث الآن" : "Updated just now"}
                isAr={isAr}
              />
              <StatCard
                label={isAr ? "مستخدمون مجاناً" : "Free Users"}
                value={
                  stats.totalFreeUsers ??
                  (stats.totalUsers - (stats.totalPremiumUsers ?? stats.premiumUsersCount ?? 0))
                }
                subtext={isAr ? "تم التحديث الآن" : "Updated just now"}
                isAr={isAr}
              />
              <StatCard
                label={isAr ? "إيراد شهري تقديري ($)" : "Estimated MRR ($)"}
                value={
                  stats.estimatedMrr?.toFixed(2) ??
                  ((stats.totalPremiumUsers ?? stats.premiumUsersCount ?? 0) * 4.99).toFixed(2)
                }
                subtext={isAr ? "تم التحديث الآن" : "Updated just now"}
                isAr={isAr}
              />
            </div>

            {/* Main Grid: Table + Details */}
            <div className="admin-main-grid">
              {/* Users Table Card */}
              <div className="admin-card">
                <div className="admin-card-inner">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">{isAr ? "المستخدمون" : "Users"}</h2>
                  </div>

                  {/* Filters */}
                  <div className="admin-filters">
                    <input
                      type="text"
                      className="admin-search-input"
                      placeholder={isAr ? "بحث بالاسم أو البريد..." : "Search by email or name..."}
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                    />
                    <select
                      className="admin-filter-select"
                      value={planFilter}
                      onChange={(e) => setPlanFilter(e.target.value)}
                    >
                      <option value="all">{isAr ? "الكل" : "All"}</option>
                      <option value="premium">{isAr ? "بريميوم فقط" : "Premium"}</option>
                      <option value="free">{isAr ? "مجاني فقط" : "Free"}</option>
                    </select>
                  </div>

                  {/* Table */}
                  <UsersTable
                    users={currentUsers}
                    selectedUser={selectedUser}
                    onSelectUser={setSelectedUser}
                    isAr={isAr}
                  />

                  {/* Pagination */}
                  {filteredUsers.length > 0 && totalPages > 1 && (
                    <div className="admin-pagination">
                      <div className="admin-pagination-info">
                        {start + 1}–{Math.min(start + pageSize, total)} {isAr ? "من" : "of"} {total}
                      </div>
                      <div className="admin-pagination-controls">
                        <button
                          type="button"
                          className="admin-pagination-button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          {isAr ? "السابق" : "Prev"}
                        </button>
                        <div className="admin-pagination-page">
                          {page} / {totalPages}
                        </div>
                        <button
                          type="button"
                          className="admin-pagination-button"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                        >
                          {isAr ? "التالي" : "Next"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* User Details Card */}
              <div className="admin-card">
                <div className="admin-card-inner">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">{isAr ? "تفاصيل المستخدم" : "User Details"}</h2>
                  </div>
                  <UserDetailsPanel user={selectedUser} isAr={isAr} />
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <AsrarFooter />
    </div>
  );
}
