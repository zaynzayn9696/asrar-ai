// src/AsrarHeader.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import asrarLogo from "./assets/asrar-logo.png";
import { useAuth } from "./hooks/useAuth";
import { API_BASE } from "./apiBase";

export default function AsrarHeader({ lang, isAr, onLangChange, onLogout }) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const avatarSrc = user?.photoUrl
    ? (user.photoUrl.startsWith("http") ? user.photoUrl : `${API_BASE}${user.photoUrl}`)
    : null;

  const handleLangSwitch = (newLang) => {
    if (newLang === lang) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("asrar-lang", newLang);
    }
    onLangChange?.(newLang);
  };

  const nav = isAr
    ? {
        home: "الرئيسية",
        dashboard: "لوحة التحكم",
        history: "سجل المحادثات",
        chat: "المحادثة",
        settings: "الإعدادات",
        billing: "الفوترة والاشتراك",
        logout: "تسجيل الخروج",
      }
    : {
        home: "Home",
        dashboard: "Dashboard",
        history: "Chat history",
        chat: "Chat",
        settings: "Settings",
        billing: "Billing",
        logout: "Log out",
      };

  const authLabels = isAr
    ? { login: "تسجيل الدخول", signup: "أنشئ حسابًا" }
    : { login: "Login", signup: "Create Account" };

  const goTo = (path) => {
    navigate(path);
    setIsMobileNavOpen(false);
    setIsUserMenuOpen(false);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      alert(
        isAr
          ? "تسجيل الخروج سيتم ربطه لاحقاً."
          : "Logout will be wired to auth later."
      );
    }
    setIsUserMenuOpen(false);
    setIsMobileNavOpen(false);
  };

  return (
    <>
      {/* TOP HEADER (desktop) */}
      <header className="asrar-dash-header">
        <div className="asrar-dash-header-left">
          <Link to="/" className="asrar-dash-logo-wrap">
            <div className="asrar-dash-logo-frame">
              <img src={asrarLogo} alt="Asrar AI" className="asrar-dash-logo" />
            </div>
            <div className="asrar-dash-brand">
              <span className="asrar-dash-brand-main">ASRAR AI</span>
              <span className="asrar-dash-brand-sub">
                {isAr
                  ? "رفاق ذكاء اصطناعي • للعالم العربي"
                  : "Private AI Companions • For the Arab World"}
              </span>
            </div>
          </Link>
        </div>

        <div className="asrar-dash-header-right">
          {/* language toggle (hidden on mobile by existing CSS) */}
          <div className="asrar-lang-toggle">
            <button
              className={lang === "en" ? "active" : ""}
              onClick={() => handleLangSwitch("en")}
            >
              EN
            </button>
            <button
              className={lang === "ar" ? "active" : ""}
              onClick={() => handleLangSwitch("ar")}
            >
              عربي
            </button>
          </div>

          {/* Logged-out: show auth buttons */}
          {!loading && !user && (
            <div className="asrar-header-auth-buttons">
              <Link to="/login" className="asrar-btn ghost">
                {authLabels.login}
              </Link>
              <Link to="/create-account" className="asrar-btn primary">
                {authLabels.signup}
              </Link>
            </div>
          )}

          {/* Logged-in: dashboard links + avatar menu */}
          {!loading && user && (
            <>
              {/* Dashboard + history links (desktop only) */}
              <Link to="/dashboard" className="asrar-dash-header-link">
                {nav.dashboard}
              </Link>
              <Link to="/history" className="asrar-dash-header-link">
                {nav.history}
              </Link>

              {/* user avatar + dropdown */}
              <div className="asrar-dash-header-user">
                <button
                  type="button"
                  className="asrar-dash-header-avatar"
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                >
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt="avatar"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "999px",
                      }}
                    />
                  ) : (
                    <span>🙂</span>
                  )}
                </button>

                {isUserMenuOpen && (
                  <div
                    className={
                      "asrar-dash-user-menu" +
                      (isAr ? " asrar-dash-user-menu--ar" : "")
                    }
                  >
                    <button type="button" onClick={() => goTo("/settings")}>
                      {nav.settings}
                    </button>
                    <button type="button" onClick={() => goTo("/billing")}>
                      {nav.billing}
                    </button>
                    <button
                      type="button"
                      className="asrar-dash-user-menu-danger"
                      onClick={handleLogout}
                    >
                      {nav.logout}
                    </button>
                  </div>
                )}
              </div>

              {/* mobile menu toggle */}
              <button
                className="asrar-header-menu asrar-dash-header-menu-toggle"
                aria-label="Toggle navigation"
                onClick={() => setIsMobileNavOpen((prev) => !prev)}
              >
                <span></span>
                <span></span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* MOBILE NAV DROPDOWN (only when logged in) */}
      {isMobileNavOpen && user && (
        <nav className="asrar-dash-mobile-nav">
          {/* language toggle inside dropdown */}
          <div className="asrar-lang-toggle asrar-dash-mobile-lang">
            <button
              className={lang === "en" ? "active" : ""}
              onClick={() => handleLangSwitch("en")}
            >
              EN
            </button>
            <button
              className={lang === "ar" ? "active" : ""}
              onClick={() => handleLangSwitch("ar")}
            >
              عربي
            </button>
          </div>

          {/* main links */}
          <Link to="/" onClick={() => setIsMobileNavOpen(false)}>
            {nav.home}
          </Link>
          <Link to="/dashboard" onClick={() => setIsMobileNavOpen(false)}>
            {nav.dashboard}
          </Link>
          <Link to="/history" onClick={() => setIsMobileNavOpen(false)}>
            {nav.history}
          </Link>
          <Link to="/chat" onClick={() => setIsMobileNavOpen(false)}>
            {nav.chat}
          </Link>

          {/* extra actions */}
          <button
            type="button"
            className="asrar-dash-mobile-nav-btn"
            onClick={() => goTo("/settings")}
          >
            {nav.settings}
          </button>

          <button
            type="button"
            className="asrar-dash-mobile-nav-btn"
            onClick={() => goTo("/billing")}
          >
            {nav.billing}
          </button>

          <button
            type="button"
            className="asrar-dash-mobile-nav-btn asrar-dash-mobile-nav-danger"
            onClick={handleLogout}
          >
            {nav.logout}
          </button>
        </nav>
      )}
    </>
  );
}
