// src/LoginPage.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import asrarLogo from "./assets/asrar-logo.png";
import "./AuthPage.css";
import { useAuth } from "./hooks/useAuth";

const API_BASE = "http://localhost:4100";

const getInitialLang = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("asrar-lang") || "en";
  }
  return "en";
};

const LOGIN_TEXT = {
  en: {
    title: "Log in to your account",
    subtitle: "Your secrets, guarded. Your companion, always here.",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    forgot: "Forgot your password?",
    button: "Log in",
    footerText: "Don’t have an account?",
    footerLink: "Create free account",
  },
  ar: {
    title: "تسجيل الدخول إلى حسابك",
    subtitle: "أسرارك في مكان واحد آمن. رفيقك دائماً معك.",
    emailLabel: "البريد الإلكتروني",
    emailPlaceholder: "you@email.com",
    passwordLabel: "كلمة المرور",
    passwordPlaceholder: "أدخل كلمة المرور",
    forgot: "نسيت كلمة المرور؟",
    button: "تسجيل الدخول",
    footerText: "ليس لديك حساب؟",
    footerLink: "إنشاء حساب جديد",
  },
};

const LoginPage = () => {
  const [lang] = useState(getInitialLang);
  const isArabic = lang === "ar";
  const t = LOGIN_TEXT[isArabic ? "ar" : "en"];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const { setUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert(
        isArabic
          ? "الرجاء إدخال البريد الإلكتروني وكلمة المرور."
          : "Please enter your email and password."
      );
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // 🔑 send / receive cookie
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(
          data.message ||
            (isArabic
              ? "فشل تسجيل الدخول. تأكد من البيانات."
              : "Login failed. Please check your credentials.")
        );
        return;
      }

      // 🔑 mark user as logged in in React
      if (data.user) {
        setUser(data.user);
      }

      // Decide where to send them based on any preselected character
      let targetPath = "/dashboard";
      if (typeof window !== "undefined") {
        const preselected = localStorage.getItem("asrar-selected-character");
        if (preselected) {
          targetPath = "/chat";
        }
      }

      // 🔑 go to dashboard
      navigate(targetPath);
    } catch (err) {
      console.error("Login error:", err);
      alert(
        isArabic
          ? "حدث خطأ غير متوقع أثناء تسجيل الدخول."
          : "Unexpected error while logging in."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`auth-page ${isArabic ? "auth-page-rtl" : ""}`}>
      <div className="auth-glow-ring" />

      <div
        className="auth-card auth-card-anim"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <div className="auth-logo-wrap">
          <Link to="/" className="auth-logo-link">
            <img src={asrarLogo} alt="Asrar AI" className="auth-logo" />
          </Link>
        </div>

        <h1 className="auth-title">{t.title}</h1>
        <p className="auth-subtitle">{t.subtitle}</p>

      <button
  type="button"
  className="auth-primary-button"
  style={{ marginBottom: "12px" }}
 onClick={() => {
  window.location.href = "http://localhost:4100/api/auth/google/start";
}}
>
  {isArabic ? "المتابعة باستخدام Google" : "Continue with Google"}
</button>

<div className="auth-divider" style={{ margin: "16px 0", textAlign: "center" }}>
  <span>{isArabic ? "أو" : "or"}</span>
</div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label">{t.emailLabel}</label>
            <input
              type="email"
              className="auth-input"
              placeholder={t.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">{t.passwordLabel}</label>
            <input
              type="password"
              className="auth-input"
              placeholder={t.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="auth-row auth-row-meta">
            <button
              type="button"
              className="auth-link-button auth-link-button-small"
              onClick={() =>
                alert(
                  isArabic
                    ? "إعادة تعيين كلمة المرور سيتم تفعيلها لاحقاً."
                    : "Password reset will be implemented later."
                )
              }
            >
              {t.forgot}
            </button>
          </div>

          <button
            type="submit"
            className="auth-primary-button"
            disabled={submitting}
          >
            {submitting
              ? isArabic
                ? "جاري تسجيل الدخول..."
                : "Logging in..."
              : t.button}
          </button>
        </form>

        <p className="auth-footer-text">
          {t.footerText}{" "}
          <Link to="/create-account" className="auth-footer-link">
            {t.footerLink}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
