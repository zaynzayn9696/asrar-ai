// src/WhispersPanel.jsx
import React, { useEffect, useState } from "react";
import "./Whispers.css";
import { API_BASE } from "./apiBase";
import { TOKEN_KEY } from "./hooks/useAuth";

const TRUST_LEVELS_UI = {
  en: [
    {
      id: 1,
      label: "Surface",
      description:
        "You're just starting to build trust. Hidden Side is mostly quiet while your companion gets a feel for you.",
    },
    {
      id: 2,
      label: "Openness",
      description:
        "You’ve shared enough that your companion starts unlocking small 'whispers' about how it sees your moods.",
    },
    {
      id: 3,
      label: "Depth",
      description:
        "Trust is growing. Your companion now reflects back deeper emotional patterns and gentle insights.",
    },
    {
      id: 4,
      label: "Secrets",
      description:
        "You’ve opened more of your inner world. Whispers can point to recurring triggers and how you tend to cope.",
    },
    {
      id: 5,
      label: "True Bond",
      description:
        "Your conversations span many moments and moods. Your companion now offers its most honest, high-trust reflections.",
    },
  ],
  ar: [
    {
      id: 1,
      label: "السطح",
      description:
        "أنتم في بداية بناء الثقة. الجانب الخفي ما زال هادئًا بينما يتعرّف رفيقك عليك أكثر.",
    },
    {
      id: 2,
      label: "الانفتاح",
      description:
        "بدأت تشارك أكثر. رفيقك يبدأ بفتح «همسات» صغيرة عن كيف يرى تقلبات مزاجك.",
    },
    {
      id: 3,
      label: "العمق",
      description:
        "الثقة تكبر. رفيقك يعكس لك أنماطًا أعمق في مشاعرك وبعض الملاحظات اللطيفة.",
    },
    {
      id: 4,
      label: "الأسرار",
      description:
        "فتحت جزءًا أكبر من عالمك الداخلي. الهمسات قد تشير الآن إلى محفّزات متكررة وطرق تعاملك معها.",
    },
    {
      id: 5,
      label: "الرابطة الحقيقية",
      description:
        "محادثاتك تغطي لحظات وحالات مزاجية مختلفة. رفيقك يقدّم أصدق انعكاساته عالية الثقة عنك.",
    },
  ],
};

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

  const title = personaName
    ? isAr
      ? `الجانب الخفي لـ ${personaName}`
      : `Hidden Side of ${personaName}`
    : isAr
    ? "الجانب الخفي"
    : "Hidden Side";

  const subtitle = isAr
    ? "مساحة ثقة طويلة المدى؛ كلما زادت ثقتكما، فتح رفيقك همسات عاطفية خاصة عنك بمرور الوقت."
    : "A long‑term trust space where this companion slowly unlocks private emotional 'whispers' about you over time.";
  const rawTrustScore =
    typeof status?.trustScore === "number" ? status.trustScore : null;

  const trustScore =
    rawTrustScore == null
      ? null
      : Math.max(0, Math.min(100, Math.round(rawTrustScore)));

  const trustLevelUi = (() => {
    if (trustScore == null) return null;
    const langKey = isAr ? "ar" : "en";
    const levels = TRUST_LEVELS_UI[langKey] || TRUST_LEVELS_UI.en;

    let levelNumber = 1;
    if (trustScore <= 20) levelNumber = 1;
    else if (trustScore <= 40) levelNumber = 2;
    else if (trustScore <= 60) levelNumber = 3;
    else if (trustScore <= 80) levelNumber = 4;
    else levelNumber = 5;

    const meta = levels[levelNumber - 1] || levels[0];
    return {
      levelNumber,
      label: meta.label,
      description: meta.description,
    };
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

        {trustLevelUi && (
          <div className="asrar-whispers-trust-row">
            <div className="asrar-whispers-trust-main">
              <span className="asrar-whispers-trust-label">
                {isAr ? "مستوى الثقة" : "Trust Level"}
              </span>
              <span className="asrar-whispers-trust-level-name">
                {isAr
                  ? `المستوى ${trustLevelUi.levelNumber} — ${trustLevelUi.label}`
                  : `Level ${trustLevelUi.levelNumber} — ${trustLevelUi.label}`}
              </span>
            </div>
            <div className="asrar-whispers-trust-indicator">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <div
                  key={lvl}
                  className={
                    "asrar-whispers-trust-segment" +
                    (trustLevelUi.levelNumber >= lvl
                      ? " asrar-whispers-trust-segment--active"
                      : "")
                  }
                />
              ))}
            </div>
          </div>
        )}

        {trustLevelUi && (
          <p className="asrar-whispers-trust-description">
            {trustLevelUi.description}
          </p>
        )}

        <p className="asrar-whispers-explainer">
          {isAr
            ? "الجانب الخفي لا يغيّر شخصية رفيقك. هو مقياس ثقة بينكما: كلما زادت الثقة ظهرت همسات عاطفية أعمق وانعكاسات أوضح مخصّصة لك."
            : "Hidden Side doesn’t change who your companion is. It’s a trust meter between you and this persona: more trust unlocks deeper emotional whispers and clearer reflections, just for you."}
        </p>

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
              ? "لا توجد همسات بعد. استمر في التحدّث بصدق مع رفيقك، ومع الوقت ستظهر هنا انعكاسات خاصة كلما زادت الثقة."
              : "No whispers yet. Keep talking honestly with your companion and, as trust grows, private emotional whispers will start to appear here."}
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
