// src/Settings.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./HomePage.css";
import "./Dashboard.css";
import "./Settings.css";
import AsrarHeader from "./AsrarHeader";
import { useAuth, TOKEN_KEY } from "./hooks/useAuth";
import { API_BASE } from "./apiBase";
import AsrarFooter from "./AsrarFooter";
import defaultAvatar from "./assets/favicon.png";

// --- LANGUAGE ----------------------------------------------------
const getInitialLang = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("asrar-lang") || "ar";
  }
  return "ar";
};

const SETTINGS_TEXT = {
  en: {
    eyebrow: "Account",
    title: "Settings",
    subtitle: "Manage your profile and security inside Asrar AI.",
    privacyNote: "Learn more about how we protect your data in the Security & Privacy section.",

    profileTitle: "Profile",
    changePhoto: "Change photo",
    nameLabel: "Name",
    emailLabel: "Email",
    interfaceLangLabel: "Interface language",
    currentLangEn: "English",
    currentLangAr: "Arabic (عربي)",
    saveProfile: "Save profile",

    securityTitle: "Security",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    passwordHint: "Use at least 8 characters, including a number or symbol.",
    updatePassword: "Update password",

    deleteAccountQuestion: "Need to leave Asrar?",
    deleteAccount: "Delete account",

    saveHistory: "Save my chat history",
    deleteConversations: "Delete all my conversations",
    confirmDelete: "Are you sure? This action is irreversible.",
    cancel: "Cancel",
    confirm: "Confirm",
  },
  ar: {
    eyebrow: "الحساب",
    title: "الإعدادات",
    subtitle: "إدارة ملفك الشخصي وأمانك داخل أسرار AI.",
    privacyNote: "تعرّف أكثر على حماية بياناتك في قسم الأمان والخصوصية في الصفحة الرئيسية.",

    profileTitle: "الملف الشخصي",
    changePhoto: "تغيير الصورة",
    nameLabel: "الاسم",
    emailLabel: "البريد الإلكتروني",
    interfaceLangLabel: "لغة الواجهة",
    currentLangEn: "الإنجليزية (English)",
    currentLangAr: "العربية",
    saveProfile: "حفظ الملف الشخصي",

    securityTitle: "الأمان",
    currentPassword: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور",
    passwordHint: "استخدم 8 أحرف على الأقل، مع رقم أو رمز.",
    updatePassword: "تحديث كلمة المرور",

    deleteAccountQuestion: "تفكر تترك أسرار؟",
    deleteAccount: "حذف الحساب",

    saveHistory: "احفظ سجل محادثاتي",
    deleteConversations: "احذف جميع محادثاتي",
    confirmDelete: "هل أنت متأكد؟ هذا الإجراء لا يمكن التراجع عنه.",
    cancel: "إلغاء",
    confirm: "تأكيد",
  },
};

export default function Settings() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();

  const [lang, setLang] = useState(getInitialLang);
  const isAr = lang === "ar";
  const t = SETTINGS_TEXT[isAr ? "ar" : "en"];

  // FORM STATES
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  

  // HISTORY STATES
  const [saveHistory, setSaveHistory] = useState(!!user?.saveHistoryEnabled);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [isUpdatingSaveHistory, setIsUpdatingSaveHistory] = useState(false); // track toggle loading state
  const [deleteConfirmValue, setDeleteConfirmValue] = useState("");

  // --- LOAD SETTINGS FROM BACKEND (FIXED with credentials) -------------
  useEffect(() => {
    async function fetchUserSettings() {
      const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setSaveHistory(!!data.user.saveHistoryEnabled);
      }
    }
    fetchUserSettings();
  }, [setUser]);

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setName(user.name || "");
      setSaveHistory(!!user.saveHistoryEnabled);
    }
  }, [user]);

  // SWITCH LANGUAGE
  const handleLangSwitch = (newLang) => {
    setLang(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("asrar-lang", newLang);
    }
  };

  // SAVE PROFILE (name)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    const trimmed = (name || "").trim();
    if (!trimmed) {
      setErrorMessage(isAr ? "الاسم مطلوب" : "Name is required");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data?.message || (isAr ? "فشل حفظ الملف الشخصي" : "Failed to save profile"));
        return;
      }
      if (data.user) setUser(data.user);
      setSuccessMessage(isAr ? "تم حفظ الملف الشخصي" : "Profile saved");
    } catch (err) {
      console.error("Save profile error", err);
      setErrorMessage(isAr ? "حدث خطأ أثناء الحفظ" : "An error occurred while saving");
    }
  };

  // UPDATE PASSWORD
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage(isAr ? "اكمل جميع الحقول" : "Please fill all fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage(isAr ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/user/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data?.message || (isAr ? "فشل تحديث كلمة المرور" : "Failed to update password"));
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage(isAr ? "تم تحديث كلمة المرور" : "Password updated successfully");
    } catch (err) {
      console.error("Update password error", err);
      setErrorMessage(isAr ? "حدث خطأ أثناء تحديث كلمة المرور" : "An error occurred while updating password");
    }
  };

  // DELETE ACCOUNT
  const handleDeleteAccount = async () => {
    setErrorMessage("");
    if (deleteConfirmValue.trim() !== "DELETE") {
      setErrorMessage(
        isAr
          ? "لإكمال الحذف، اكتب DELETE بالإنجليزية في خانة التأكيد."
          : "To confirm deletion, please type DELETE in the confirmation box."
      );
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/user/delete`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(
          data?.message || (isAr ? "فشل حذف الحساب" : "Failed to delete account")
        );
        return;
      }
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("asrar-chat-history");
        }
      } catch {}
      await logout();
      navigate("/");
    } catch (err) {
      console.error("Delete account error", err);
      setErrorMessage(
        isAr
          ? "حدث خطأ أثناء حذف الحساب"
          : "An error occurred while deleting account"
      );
    } finally {
      setShowDeleteAccountModal(false);
      setDeleteConfirmValue("");
    }
  };

  // Download full user data as JSON
  const handleDownloadData = async () => {
    setErrorMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/user/export`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(
          data?.message || (isAr ? "فشل تنزيل البيانات" : "Failed to download data")
        );
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "asrarai-data-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export data error", err);
      setErrorMessage(
        isAr ? "حدث خطأ أثناء تنزيل البيانات" : "An error occurred while downloading data"
      );
    }
  };

  // LOGOUT
  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  // Photo upload removed

  // SAVE HISTORY TOGGLE (FIXED + preserves avatar photoUrl)
  const toggleSaveHistory = async () => {
    if (isUpdatingSaveHistory) return;
    setIsUpdatingSaveHistory(true);
    try {
      const res = await fetch(`${API_BASE}/api/user/save-history`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ saveHistoryEnabled: !saveHistory }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          // merge into existing user so fields like photoUrl are preserved if the endpoint returns a partial user
          setUser((prevUser) => {
            const incoming = data.user || {};
            const base = prevUser || {};
            return {
              ...base,
              ...incoming,
              photoUrl:
                incoming.photoUrl !== undefined
                  ? incoming.photoUrl
                  : base.photoUrl,
            };
          });
          setSaveHistory(!!data.user.saveHistoryEnabled);
        }
      }
    } catch (err) {
      console.error("Failed to update history preference", err);
    } finally {
      setIsUpdatingSaveHistory(false);
    }
  };

  // DELETE-ALL FIXED (now also sends Bearer token like other protected calls)
  const deleteAllConversations = async () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const res = await fetch(`${API_BASE}/api/chat/delete-all`, {
      method: "DELETE",
      credentials: "include",
      headers,
    });
    if (res.ok) {
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("asrar-chat-history");
        }
      } catch {}
      setSuccessMessage(isAr ? "تم حذف جميع المحادثات." : "All conversations have been deleted.");
    }
  };

  return (
    <div
      className={`asrar-dash-page asrar-dashboard-page asrar-settings-page ${
        isAr ? "asrar-dash-page--ar" : ""
      }`}
    >
      {/* background glows */}
      <div className="asrar-dash-orbit asrar-dash-orbit--top" />
      <div className="asrar-dash-orbit asrar-dash-orbit--bottom" />

      {/*  Header now has real logout */}
      <AsrarHeader
        lang={lang}
        isAr={isAr}
        onLangChange={handleLangSwitch}
        onLogout={handleLogout}
      />

      {/* MAIN CONTENT */}
      <main className="asrar-dash-main asrar-settings-main">
        <section
          className="asrar-dash-panel asrar-settings-panel"
          dir={isAr ? "rtl" : "ltr"}
        >
          <p className="asrar-dash-eyebrow">{t.eyebrow}</p>
          <h1 className="asrar-dash-title">{t.title}</h1>
          <p className="asrar-dash-subtitle">{t.subtitle}</p>

          <div className="asrar-settings-grid">

            {/* PROFILE CARD (RESTORED FULLY) */}
            <form
              className="asrar-settings-card asrar-settings-card--profile"
              onSubmit={handleSaveProfile}
            >
              <h2 className="asrar-settings-card-title">
                {t.profileTitle}
              </h2>

              <div className="asrar-settings-avatar-section">
                <div className="asrar-settings-avatar-circle">
                  <img src={defaultAvatar} alt="avatar" />
                </div>
              </div>

              <div className="asrar-settings-field">
                <label className="asrar-settings-label">{t.nameLabel}</label>
                <input
                  type="text"
                  className="asrar-settings-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="asrar-settings-field">
                <label className="asrar-settings-label">{t.emailLabel}</label>
                <input
                  type="email"
                  className="asrar-settings-input asrar-settings-input--readonly"
                  value={email}
                  readOnly
                  disabled
                />
              </div>

              <div className="asrar-settings-actions">
                <button type="submit" className="asrar-settings-save-btn">
                  {t.saveProfile}
                </button>
              </div>
            </form>

            {/* SECURITY CARD (FULL RESTORE) */}
            <form
              className="asrar-settings-card asrar-settings-card--security"
              onSubmit={handleUpdatePassword}
            >
              <h2 className="asrar-settings-card-title">{t.securityTitle}</h2>

              <div className="asrar-settings-field">
                <label className="asrar-settings-label">{t.currentPassword}</label>
                <input
                  type="password"
                  className="asrar-settings-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="asrar-settings-field">
                <label className="asrar-settings-label">{t.newPassword}</label>
                <input
                  type="password"
                  className="asrar-settings-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="asrar-settings-field">
                <label className="asrar-settings-label">{t.confirmPassword}</label>
                <input
                  type="password"
                  className="asrar-settings-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <p className="asrar-settings-hint">{t.passwordHint}</p>

              <div className="asrar-settings-actions">
                <button type="submit" className="asrar-settings-update-btn">
                  {t.updatePassword}
                </button>
              </div>

              <div className="asrar-settings-danger-zone">
                <span>{t.deleteAccountQuestion}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="asrar-settings-delete-btn"
                    onClick={() => setShowDeleteAccountModal(true)}
                  >
                    {t.deleteAccount}
                  </button>
                  <button
                    type="button"
                    className="asrar-settings-delete-btn"
                    onClick={handleDownloadData}
                  >
                    {isAr ? "تحميل بياناتي" : "Download my data"}
                  </button>
                </div>
              </div>
            </form>

            {/* HISTORY CARD (FIXED + RESTORED) */}
            <form className="asrar-settings-card asrar-settings-card--history">
              <h2 className="asrar-settings-card-title">History</h2>

              <div className="asrar-settings-field asrar-settings-field-row">
                <label className="asrar-settings-label">{t.saveHistory}</label>
                <button
                  type="button"
                  className={
                    "asrar-toggle " +
                    (saveHistory ? "asrar-toggle--on" : "asrar-toggle--off") +
                    (isUpdatingSaveHistory ? " asrar-toggle--loading" : "")
                  }
                  onClick={toggleSaveHistory}
                  disabled={isUpdatingSaveHistory}
                  aria-pressed={saveHistory}
                  aria-label={t.saveHistory}
                >
                  <span className="asrar-toggle-thumb" />
                </button>
              </div>

              <div className="asrar-settings-actions">
                <button
                  type="button"
                  className="asrar-settings-delete-btn"
                  onClick={() => setShowConfirmModal(true)}
                >
                  {t.deleteConversations}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>

      {/* FIXED MODAL STYLING */}
      {showConfirmModal && (
        <div className="asrar-modal-backdrop">
          <div className="asrar-modal">
            <div className="asrar-modal-body">{t.confirmDelete}</div>
            <div className="asrar-modal-actions">
              <button className="asrar-btn ghost" onClick={() => setShowConfirmModal(false)}>
                {t.cancel}
              </button>
              <button
                className="asrar-btn primary"
                onClick={() => {
                  deleteAllConversations();
                  setShowConfirmModal(false);
                }}
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAccountModal && (
        <div className="asrar-modal-backdrop">
          <div className="asrar-modal">
            <div className="asrar-modal-body">
              {isAr
                ? "هل تريد حذف حسابك وبياناتك نهائياً؟ هذا الإجراء لا يمكن التراجع عنه. اكتب DELETE للتأكيد."
                : "Delete your account and all data permanently? This cannot be undone. Type DELETE to confirm."}
              <div style={{ marginTop: '0.75rem' }}>
                <input
                  type="text"
                  className="asrar-settings-input"
                  placeholder={isAr ? "اكتب DELETE هنا" : "Type DELETE here"}
                  value={deleteConfirmValue}
                  onChange={(e) => setDeleteConfirmValue(e.target.value)}
                />
              </div>
            </div>
            <div className="asrar-modal-actions">
              <button className="asrar-btn ghost" onClick={() => setShowDeleteAccountModal(false)}>
                {t.cancel}
              </button>
              <button className="asrar-btn primary" onClick={handleDeleteAccount}>
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="asrar-success">{successMessage}</div>
      )}
      {errorMessage && (
        <div className="asrar-error">{errorMessage}</div>
      )}
      <AsrarFooter />
    </div>
  );
}
