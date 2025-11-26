// src/CreateAccountPage.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import asrarLogo from "./assets/asrar-logo.png";
import "./AuthPage.css";
import { useAuth, TOKEN_KEY } from "./hooks/useAuth";
import { API_BASE } from "./apiBase";

const getInitialLang = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("asrar-lang") || "ar";
  }
  return "ar";
};

const SIGNUP_TEXT = {
  en: {
    title: "Create your Asrar account",
    subtitle: "Start building your private space with the companions you choose.",
    nameLabel: "Name",
    namePlaceholder: "What should we call you?",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Create a strong password",
    confirmLabel: "Confirm password",
    confirmPlaceholder: "Repeat your password",
    button: "Create account",
    footerText: "Already have an account?",
    footerLink: "Log in",
  },
  ar: {
    title: "أنشئ حسابك في أسرار",
    subtitle: "ابدأ بناء مساحتك الخاصة مع الرفقاء الذين تختارهم.",
    nameLabel: "الاسم",
    namePlaceholder: "كيف نُناديك؟",
    emailLabel: "البريد الإلكتروني",
    emailPlaceholder: "you@email.com",
    passwordLabel: "كلمة المرور",
    passwordPlaceholder: "أنشئ كلمة مرور قوية",
    confirmLabel: "تأكيد كلمة المرور",
    confirmPlaceholder: "أعد إدخال كلمة المرور",
    button: "إنشاء حساب",
    footerText: "لديك حساب بالفعل؟",
    footerLink: "تسجيل الدخول",
  },
};

const CreateAccountPage = () => {
  const [lang] = useState(getInitialLang);
  const isArabic = lang === "ar";
  const t = SIGNUP_TEXT[isArabic ? "ar" : "en"];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { setUser } = useAuth();

 const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");

  if (!name || !email || !password || !confirm) {
    setError(
      isArabic
        ? "الرجاء ملء جميع الحقول."
        : "Please fill in all fields."
    );
    return;
  }

  if (password !== confirm) {
    setError(
      isArabic
        ? "كلمتا المرور غير متطابقتين."
        : "Passwords do not match."
    );
    return;
  }

  try {
    setSubmitting(true);

    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(
        data.message ||
          (isArabic
            ? "فشل إنشاء الحساب. تأكد من البيانات."
            : "Failed to create account. Please check your details.")
      );
      return;
    }

    if (data.token && typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, data.token);
    }

    if (data.user) {
      setUser(data.user);
    }

    // ✅ Always redirect new user to dashboard after signup
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("asrar-selected-character");
      } catch (_) {}
    }

    navigate("/dashboard");
  } catch (err) {
    console.error("Signup error:", err);
    setError(
      isArabic
        ? "حدث خطأ غير متوقع أثناء إنشاء الحساب."
        : "Unexpected error while creating your account."
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

        {error && (
          <div className="auth-error-banner">{error}</div>
        )}

        <button
          type="button"
          className="auth-primary-button"
          style={{ marginBottom: "12px" }}
          onClick={() => {
            window.location.href = `${API_BASE}/api/auth/google/start`;
          }}
        >
          {isArabic ? "المتابعة باستخدام Google" : "Continue with Google"}
        </button>

        <div
          className="auth-divider"
          style={{ margin: "16px 0", textAlign: "center" }}
        >
          <span>{isArabic ? "أو" : "or"}</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label">{t.nameLabel}</label>
            <input
              type="text"
              className="auth-input"
              placeholder={t.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

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

          <div className="auth-field">
            <label className="auth-label">{t.confirmLabel}</label>
            <input
              type="password"
              className="auth-input"
              placeholder={t.confirmPlaceholder}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="auth-primary-button"
            disabled={submitting}
          >
            {submitting
              ? isArabic
                ? "جاري إنشاء الحساب..."
                : "Creating account..."
              : t.button}
          </button>
        </form>

        <p className="auth-footer-text">
          {t.footerText}{" "}
          <Link to="/login" className="auth-footer-link">
            {t.footerLink}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default CreateAccountPage;
