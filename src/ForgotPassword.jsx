// src/ForgotPassword.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import asrarLogo from "./assets/asrar-logo.png";
import "./AuthPage.css";
import { API_BASE } from "./apiBase";

const getInitialLang = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("asrar-lang") || "ar";
  }
  return "ar";
};

const FORGOT_TEXT = {
  en: {
    title: "Forgot your password?",
    subtitle: "Enter your email and we'll send you a reset link.",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    submit: "Send reset link",
    success:
      "If this email exists, a reset link has been sent. Please check your inbox.",
    genericError:
      "Something went wrong while requesting a reset link. Please try again.",
    backToLogin: "Back to login",
  },
  ar: {
    title: "نسيت كلمة المرور؟",
    subtitle: "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين.",
    emailLabel: "البريد الإلكتروني",
    emailPlaceholder: "you@email.com",
    submit: "إرسال رابط إعادة التعيين",
    success:
      "إذا كان هذا البريد مسجلاً، فقد تم إرسال رابط لإعادة تعيين كلمة المرور. يرجى التحقق من بريدك.",
    genericError:
      "حدث خطأ أثناء طلب رابط إعادة التعيين. يرجى المحاولة مرة أخرى.",
    backToLogin: "العودة لتسجيل الدخول",
  },
};

const ForgotPassword = () => {
  const [lang] = useState(getInitialLang);
  const isArabic = lang === "ar";
  const t = FORGOT_TEXT[isArabic ? "ar" : "en"];

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email) {
      setError(
        isArabic
          ? "الرجاء إدخال البريد الإلكتروني."
          : "Please enter your email."
      );
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`${API_BASE}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      // Regardless of whether the email exists or not, backend returns ok
      if (res.ok) {
        setMessage(t.success);
      } else {
        setMessage(t.success);
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      setError(t.genericError);
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

        {error && <div className="auth-error-banner">{error}</div>}
        {message && !error && (
          <div className="auth-success-banner">{message}</div>
        )}

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

          <button
            type="submit"
            className="auth-primary-button"
            disabled={submitting}
          >
            {submitting
              ? isArabic
                ? "جاري الإرسال..."
                : "Sending..."
              : t.submit}
          </button>
        </form>

        <button
          type="button"
          className="auth-link-button"
          style={{ marginTop: "12px" }}
          onClick={() => navigate("/login")}
        >
          {t.backToLogin}
        </button>
      </div>
    </div>
  );
};

export default ForgotPassword;
