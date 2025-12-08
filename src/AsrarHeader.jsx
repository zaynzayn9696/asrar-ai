// src/AsrarHeader.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import defaultAvatar from "./assets/favicon.png";

const DEFAULT_ADMIN_EMAIL = "zaynzayn9696@gmail.com";
const RAW_ADMIN_EMAILS =
  import.meta.env.VITE_ADMIN_EMAILS ||
  import.meta.env.VITE_ADMIN_EMAIL ||
  DEFAULT_ADMIN_EMAIL;

const ADMIN_EMAILS = RAW_ADMIN_EMAILS.split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

export default function AsrarHeader({
  lang,
  isAr,
  onLangChange,
  onLogout,
  externalMobileNavOpen,
  setExternalMobileNavOpen,
  mobileLeftSlot,
}) {
  // Use external state if provided, otherwise use internal state
  const [internalMobileNavOpen, setInternalMobileNavOpen] = useState(false);
  const isMobileNavOpen =
    externalMobileNavOpen !== undefined
      ? externalMobileNavOpen
      : internalMobileNavOpen;
  const setIsMobileNavOpen =
    setExternalMobileNavOpen || setInternalMobileNavOpen;
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navigate = useNavigate();
  const { user, isAuthLoading } = useAuth();

  const avatarSrc = defaultAvatar;

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
        history: "سجل المحادثة",
        chat: "المحادثة",
        settings: "الإعدادات",
        billing: "الفاتورة و الاشتراكات",
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
    ? { login: "تسجيل الدخول", signup: "إنشاء حساب" }
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
      {/* TOP HEADER (desktop + mobile) */}
      <header className="asrar-dash-header">
        <div className="asrar-dash-header-left">
          {mobileLeftSlot && (
            <div className="asrar-header-mobile-slot">{mobileLeftSlot}</div>
          )}
          <Link to="/" className="asrar-dash-logo-wrap">
            <span className="asrar-dash-brand">ASRAR AI</span>
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
          {!isAuthLoading && !user && (
            <div className="asrar-header-auth-buttons">
              {/* Navigation Links */}
              <a 
                href="#features" 
                className="asrar-dash-header-link"
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector('#features').scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {isAr ? 'لماذا أسرار؟' : 'Why Asrar?'}
              </a>
              
              <Link to="/login" className="asrar-btn ghost">
                {authLabels.login}
              </Link>
              <Link to="/create-account" className="asrar-btn primary">
                {authLabels.signup}
              </Link>
            </div>
          )}

          {/* Logged-in: dashboard links + avatar menu */}
          {!isAuthLoading && user && (
            <>
              {/* Dashboard + history links (desktop only) */}
              
              <Link to="/dashboard" className="asrar-dash-header-link">
                {nav.dashboard}
              </Link>
              <Link to="/history" className="asrar-dash-header-link">
                {nav.history}
              </Link>
              {user?.email &&
                ADMIN_EMAILS.includes(user.email.toLowerCase()) && (
                  <Link to="/admin" className="asrar-dash-header-link">
                    {isAr ? "الإدارة" : "Admin"}
                  </Link>
                )}

              {/* user avatar + dropdown */}
              <div className="asrar-dash-header-user">
                <button
                  type="button"
                  className="asrar-dash-header-avatar"
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                >
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
            </>
          )}

          {/* mobile menu toggle - always visible */}
          <button
            className="asrar-header-menu asrar-dash-header-menu-toggle"
            aria-label={isAr ? "تبديل القائمة" : "Toggle navigation"}
            onClick={() => setIsMobileNavOpen((prev) => !prev)}
          >
            <span className="asrar-header-menu-line"></span>
            <span className="asrar-header-menu-line"></span>
            <span className="asrar-header-menu-line"></span>
          </button>
        </div>
      </header>

      {/* MOBILE NAV DRAWER */}
      {isMobileNavOpen && (
        <div className="asrar-dash-mobile-layer" role="dialog" aria-modal="true">
          <div
            className="asrar-dash-mobile-overlay"
            onClick={() => setIsMobileNavOpen(false)}
          ></div>
          <nav className="asrar-dash-mobile-nav asrar-dash-mobile-nav--open">
            <div className="asrar-dash-mobile-nav-header">
              <span className="asrar-home-mobile-nav-title">ASRAR AI</span>
              <button
                className="asrar-mobile-close"
                aria-label={isAr ? "إغلاق" : "Close navigation"}
                onClick={() => setIsMobileNavOpen(false)}
              >
                &times;
              </button>
            </div>

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

            {/* Emotional Engine (mobile) – shown for all users */}
          

            {/* Logged-out: show auth buttons */}
            {!user && (
              <div className="asrar-header-auth-buttons asrar-dash-mobile-auth">
                <Link
                  to="/login"
                  className="asrar-btn ghost"
                  onClick={() => setIsMobileNavOpen(false)}
                >
                  {authLabels.login}
                </Link>
                <Link
                  to="/create-account"
                  className="asrar-btn primary"
                  onClick={() => setIsMobileNavOpen(false)}
                >
                  {authLabels.signup}
                </Link>
              </div>
            )}

            {/* Logged-in: show dashboard links */}
            {user && (
              <>
                <Link to="/" onClick={() => setIsMobileNavOpen(false)}>
                  {nav.home}
                </Link>
                <Link
                  to="/dashboard"
                  onClick={() => setIsMobileNavOpen(false)}
                >
                  {nav.dashboard}
                </Link>
                <Link to="/history" onClick={() => setIsMobileNavOpen(false)}>
                  {nav.history}
                </Link>
                <Link to="/chat" onClick={() => setIsMobileNavOpen(false)}>
                  {nav.chat}
                </Link>

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
              </>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
