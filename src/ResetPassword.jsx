// src/ResetPassword.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import asrarLogo from "./assets/asrar-logo.png";
import "./AuthPage.css";
import { API_BASE } from "./apiBase";

const getInitialLang = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("asrar-lang") || "ar";
  }
  return "ar";
};

const RESET_TEXT = {
  en: {
    title: "Reset your password",
    subtitle: "Choose a new password for your Asrar AI account.",
    passwordLabel: "New password",
    passwordPlaceholder: "Enter a new password",
    confirmLabel: "Confirm password",
    confirmPlaceholder: "Re-enter your new password",
    submit: "Reset password",
    loading: "Checking your reset link...",
    invalidToken: "This reset link is invalid or has expired.",
    backToLogin: "Back to login",
    mismatch: "Passwords do not match.",
    tooShort: "Password must be at least 8 characters.",
    genericError:
      "Something went wrong while resetting your password. Please try again.",
    success: "Password has been reset successfully. You can now log in.",
  },
  ar: {
    title: "إعادة تعيين كلمة المرور",
    subtitle: "اختر كلمة مرور جديدة لحسابك في أسرار AI.",
    passwordLabel: "كلمة المرور الجديدة",
    passwordPlaceholder: "أدخل كلمة مرور جديدة",
    confirmLabel: "تأكيد كلمة المرور",
    confirmPlaceholder: "أعد إدخال كلمة المرور الجديدة",
    submit: "إعادة تعيين كلمة المرور",
    loading: "جاري التحقق من رابط إعادة التعيين...",
    invalidToken: "هذا الرابط غير صالح أو منتهي الصلاحية.",
    backToLogin: "العودة لتسجيل الدخول",
    mismatch: "كلمتا المرور غير متطابقتين.",
    tooShort: "يجب أن تكون كلمة المرور 8 أحرف على الأقل.",
    genericError:
      "حدث خطأ أثناء إعادة تعيين كلمة المرور. يرجى المحاولة مرة أخرى.",
    success: "تمت إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.",
  },
};

const ResetPassword = () => {
  const [lang] = useState(getInitialLang);
  const isArabic = lang === "ar";
  const t = RESET_TEXT[isArabic ? "ar" : "en"];

  const location = useLocation();
  const navigate = useNavigate();

  const [token, setToken] = useState("");
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const rawToken = params.get("token") || "";

    if (!rawToken) {
      setChecking(false);
      setValid(false);
      return;
    }

    setToken(rawToken);

    const validate = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/reset-password/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token: rawToken }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data && data.valid) {
          setValid(true);
        } else {
          setValid(false);
        }
      } catch (err) {
        console.error("Reset token validate error:", err);
        setValid(false);
      } finally {
        setChecking(false);
      }
    };

    validate();
  }, [location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!password || !confirm) {
      setError(
        isArabic
          ? "الرجاء إدخال كلمة المرور الجديدة وتأكيدها."
          : "Please enter and confirm your new password."
      );
      return;
    }

    if (password !== confirm) {
      setError(t.mismatch);
      return;
    }

    if (password.length < 8) {
      setError(t.tooShort);
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data && data.ok) {
        setMessage(t.success);
      } else {
        setError(
          data && data.message
            ? data.message
            : t.genericError
        );
      }
    } catch (err) {
      console.error("Reset password error:", err);
      setError(t.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  const renderBody = () => {
    if (checking) {
      return (
        <p className="auth-subtitle" style={{ marginTop: "16px" }}>
          {t.loading}
        </p>
      );
    }

    if (!valid) {
      return (
        <>
          <p className="auth-subtitle" style={{ marginTop: "16px" }}>
            {t.invalidToken}
          </p>
          <button
            type="button"
            className="auth-primary-button"
            style={{ marginTop: "20px" }}
            onClick={() => navigate("/login")}
          >
            {t.backToLogin}
          </button>
        </>
      );
    }

    return (
      <>
        {error && <div className="auth-error-banner">{error}</div>}
        {message && !error && (
          <div className="auth-success-banner">{message}</div>
        )}

        {!message && (
          <form className="auth-form" onSubmit={handleSubmit}>
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
                  ? "جاري إعادة التعيين..."
                  : "Resetting..."
                : t.submit}
            </button>
          </form>
        )}

        {message && (
          <button
            type="button"
            className="auth-primary-button"
            style={{ marginTop: "20px" }}
            onClick={() => navigate("/login")}
          >
            {t.backToLogin}
          </button>
        )}
      </>
    );
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

        {renderBody()}
      </div>
    </div>
  );
};

export default ResetPassword;
