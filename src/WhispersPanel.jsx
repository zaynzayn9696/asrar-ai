// src/WhispersPanel.jsx
import React, { useEffect, useState } from "react";
import "./Whispers.css";
import { API_BASE } from "./apiBase";
import { TOKEN_KEY } from "./hooks/useAuth";

export default function WhispersPanel({
  isOpen,
  onClose,
  personaId,
  personaName,
  isAr,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isOpen || !personaId) return;

    let cancelled = false;
    const controller = new AbortController();

    const fetchStatus = async () => {
      setLoading(true);
      setError(null);
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem(TOKEN_KEY)
            : null;
        const headers = {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        const res = await fetch(
          `${API_BASE}/api/personas/${encodeURIComponent(
            personaId
          )}/whispers/status`,
          {
            method: "GET",
            credentials: "include",
            headers,
            signal: controller.signal,
          }
        );
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            (data && data.message) ||
              (isAr
                ? "فشل تحميل حالة الهمسات."
                : "Failed to load whispers status.")
          );
        }
        if (!cancelled) {
          setStatus(data || null);
        }
      } catch (err) {
        if (cancelled || err.name === "AbortError") return;
        setError(err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchStatus();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, personaId, isAr, refreshKey]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const unlockedList =
    (status && Array.isArray(status.unlockedWhispers)
      ? status.unlockedWhispers
      : []) || [];

  const title = isAr
    ? "همساتك السرّية"
    : "Your Whispers with this companion";

  const subtitle = personaName
    ? isAr
      ? `أسرار بينك وبين ${personaName}`
      : `Secrets between you and ${personaName}`
    : isAr
    ? "أسرارك الآمنة هنا."
    : "Your safe secrets live here.";

  const trustLabel = (() => {
    if (!status) return null;
    const lvl = status.trustLevel ?? 0;
    if (isAr) {
      if (lvl <= 0) return "مستوى الثقة: بداية الطريق";
      if (lvl === 1) return "مستوى الثقة: همسات خفيفة";
      if (lvl === 2) return "مستوى الثقة: أسرار عميقة";
      return "مستوى الثقة: ثقة كاملة";
    }
    if (lvl <= 0) return "Trust level: just starting";
    if (lvl === 1) return "Trust level: light whispers";
    if (lvl === 2) return "Trust level: deeper secrets";
    return "Trust level: fully trusted";
  })();

  const handleRetry = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="asrar-whispers-layer" onClick={handleBackdropClick}>
      <div
        className="asrar-whispers-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="asrar-whispers-header">
          <div>
            <h2 className="asrar-whispers-title">{title}</h2>
            <p className="asrar-whispers-subtitle">{subtitle}</p>
          </div>
          <button
            type="button"
            className="asrar-whispers-close"
            onClick={onClose}
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            ×
          </button>
        </div>

        {trustLabel && (
          <div className="asrar-whispers-trust-row">
            <span className="asrar-whispers-trust-label">{trustLabel}</span>
            {typeof status?.trustScore === "number" && (
              <span className="asrar-whispers-trust-score">
                {Math.round(status.trustScore)}/100
              </span>
            )}
          </div>
        )}

        {loading && (
          <div className="asrar-whispers-state">
            {isAr ? "جارٍ تحميل الهمسات…" : "Loading whispers…"}
          </div>
        )}

        {error && !loading && (
          <div className="asrar-whispers-state asrar-whispers-state--error">
            <p>
              {isAr
                ? "تعذر تحميل همساتك الآن."
                : "We couldn’t load your whispers right now."}
            </p>
            <button
              type="button"
              className="asrar-whispers-retry"
              onClick={handleRetry}
            >
              {isAr ? "حاول مرة أخرى" : "Try again"}
            </button>
          </div>
        )}

        {!loading && !error && unlockedList.length === 0 && (
          <div className="asrar-whispers-state">
            {isAr
              ? "لا توجد همسات بعد. استمر في التحدث مع رفيقك لفتح أسرار خاصة."
              : "No whispers yet. Keep talking with your companion to unlock private secrets."}
          </div>
        )}

        {!loading && !error && unlockedList.length > 0 && (
          <div className="asrar-whispers-list">
            {unlockedList.map((w) => (
              <div
                key={`${w.id}-${w.unlockedAt || ""}`}
                className="asrar-whispers-list-item"
              >
                <div className="asrar-whispers-list-item-header">
                  <h3 className="asrar-whispers-list-title">{w.title}</h3>
                  {typeof w.levelRequired === "number" && (
                    <span className="asrar-whispers-list-level">
                      {isAr
                        ? `المستوى ${w.levelRequired}`
                        : `Level ${w.levelRequired}`}
                    </span>
                  )}
                </div>
                {w.shortPreview && (
                  <p className="asrar-whispers-list-preview">{w.shortPreview}</p>
                )}
                {w.unlockedAt && (
                  <div className="asrar-whispers-list-meta">
                    {isAr ? "تم الفتح في " : "Unlocked on "}
                    {new Date(w.unlockedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
