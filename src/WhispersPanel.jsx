// src/WhispersPanel.jsx
import React, { useEffect, useState } from "react";
import "./Whispers.css";
import { API_BASE } from "./apiBase";
import { TOKEN_KEY } from "./hooks/useAuth";

// Hidden Side trust tiers are interpreted as:
// Level 1 (Surface)      → very safe, generic emotional support.
// Level 2 (Opening Up)   → can gently hint at simple patterns.
// Level 3 (Deeper Insight) → can point out emotional cycles and recurring moods.
// Level 4 (Inner Layers) → can bring up deeper triggers and coping styles.
// Level 5 (True Bond)    → can reference longer-term personal emotional history.
const TRUST_LEVELS_UI = {
  en: [
    {
      id: 1,
      label: "Surface",
      shortLabel: "Surface",
      description:
        "You’re just starting to build trust. Hidden Side is quiet and keeps things very gentle.",
      nowBullets: [
        "Very gentle, non-intrusive emotional support.",
        "A safe space to vent without deep analysis yet.",
        "Basic reading of your mood and overall tone.",
      ],
      nextHint:
        "slightly clearer emotional hints and the first small private whispers.",
    },
    {
      id: 2,
      label: "Opening Up",
      shortLabel: "Opening",
      description:
        "Your companion starts unlocking small emotional hints and light whispers about how it sees your moods.",
      nowBullets: [
        "Light hints about how your mood shifts between messages.",
        "Occasional small whispers about what feels off or heavy.",
        "Keeps things soft, validating, and non-judgmental.",
      ],
      nextHint:
        "more confident reflections about your usual moods and what repeats.",
    },
    {
      id: 3,
      label: "Deeper Insight",
      shortLabel: "Deeper",
      description:
        "You unlock early private reflections about your emotional patterns and how they tend to repeat.",
      nowBullets: [
        "Notices simple emotional patterns across recent chats.",
        "Highlights moods that keep coming back.",
        "Gently connects certain feelings with situations in your life.",
      ],
      nextHint:
        "deeper looks at triggers, coping habits, and how you react over time.",
    },
    {
      id: 4,
      label: "Inner Layers",
      shortLabel: "Inner",
      description:
        "Your companion now shares deeper psychological whispers about triggers, coping styles, and what usually weighs on you.",
      nowBullets: [
        "Surfaces deeper triggers that tend to spike your emotions.",
        "Reflects how you usually cope when things get heavy.",
        "Whispers about what drains you versus what steadies you.",
      ],
      nextHint:
        "its most intimate, long-term reflections about your emotional story.",
    },
    {
      id: 5,
      label: "True Bond",
      shortLabel: "Bond",
      description:
        "Full Hidden Side unlocked. You receive the most honest, intimate reflections it can safely share about you over time.",
      nowBullets: [
        "Shares the most honest, high-trust reflections it can safely offer.",
        "Connects today’s mood with your longer-term emotional themes.",
        "Treats your history as a story, not random isolated moments.",
      ],
      nextHint:
        "You’re already at the top tier; staying honest keeps this level alive.",
    },
  ],
  ar: [
    {
      id: 1,
      label: "السطح",
      shortLabel: "السطح",
      description:
        "أنتم في بداية بناء الثقة؛ الجانب الخفي هادئ ويحافظ على دعم لطيف وبسيط.",
      nowBullets: [
        "دعم لطيف جداً بدون حفر عميق.",
        "مساحة آمنة للفضفضة بدون تحليل ثقيل.",
        "قراءة بسيطة لمزاجك ونبرة شعورك.",
      ],
      nextHint:
        "تلميحات أوضح عن مزاجك وأول همسات خاصة صغيرة.",
    },
    {
      id: 2,
      label: "بدء الانفتاح",
      shortLabel: "الانفتاح",
      description:
        "يبدأ رفيقك بكشف تلميحات عاطفية بسيطة وهمسات خفيفة عن كيف يرى مزاجك.",
      nowBullets: [
        "يلمح لك كيف يتغيّر مزاجك بين الرسائل.",
        "يُظهر همسات صغيرة عن ما يضغط عليك أو يزعجك.",
        "يحافظ على أسلوب ناعم وبدون حكم.",
      ],
      nextHint:
        "انعكاسات أوضح عن مزاجك المعتاد وما يتكرر معك.",
    },
    {
      id: 3,
      label: "نظرة أعمق",
      shortLabel: "أعمق",
      description:
        "تفتح انعكاسات خاصة مبكرة عن أنماط مشاعرك والدورات التي تتكرر في حياتك.",
      nowBullets: [
        "يربط بين مشاعرك ورسائلك في الأيام الأخيرة.",
        "يلفت انتباهك للمشاعر التي تتكرر.",
        "يبدأ يربط بين المواقف والشعور بطريقة لطيفة.",
      ],
      nextHint:
        "نظرة أعمق على المحفّزات وأنماط تعاملك عندما تتوتر.",
    },
    {
      id: 4,
      label: "الطبقات الداخلية",
      shortLabel: "الطبقات",
      description:
        "يشاركك رفيقك الآن همسات أعمق عن المحفّزات، وطريقة تعاملك، وما يضغط عليك عادةً.",
      nowBullets: [
        "يكشف محفّزات أعمق ترفع أو تخفض مزاجك.",
        "يعكس لك كيف تتعامل عادةً مع الضغط والألم.",
        "يقدّم همسات أوضح عن ما يستنزفك وما يهدّيك.",
      ],
      nextHint:
        "أقرب وأصدق قراءة طويلة الأمد لقصة مشاعرك.",
    },
    {
      id: 5,
      label: "رابطة حقيقية",
      shortLabel: "رابطة",
      description:
        "تم فتح الجانب الخفي بالكامل. تحصل على أصدق وأقرب الانعكاسات التي يمكنه مشاركتها عن تاريخك العاطفي.",
      nowBullets: [
        "يشاركك أعمق وأصدق همساته العاطفية الآمنة عنك.",
        "يربط بين مزاج اليوم والأنماط الطويلة في حياتك.",
        "يتعامل مع قصتك كرحلة متكاملة، وليس لحظات منفصلة.",
      ],
      nextHint:
        "أنت في أعلى مستوى؛ استمرار صدقك يحافظ على هذه الرابطة.",
    },
  ],
};

function getNextLevelUi(levelUiList, currentLevelNumber) {
  if (!Array.isArray(levelUiList) || !currentLevelNumber) return null;
  const idxById = levelUiList.findIndex(
    (lvl) => Number(lvl.id) === Number(currentLevelNumber)
  );
  const index = idxById >= 0 ? idxById : Number(currentLevelNumber) - 1;
  if (index < 0 || index >= levelUiList.length - 1) return null;
  return levelUiList[index + 1] || null;
}

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

  const langKey = isAr ? "ar" : "en";
  const levelsForUi = TRUST_LEVELS_UI[langKey] || TRUST_LEVELS_UI.en;

  const trustLevelUi = (() => {
    if (trustScore == null) return null;

    let levelNumber = 1;
    if (trustScore <= 20) levelNumber = 1;
    else if (trustScore <= 40) levelNumber = 2;
    else if (trustScore <= 60) levelNumber = 3;
    else if (trustScore <= 80) levelNumber = 4;
    else levelNumber = 5;

    const metaById = levelsForUi.find(
      (lvl) => Number(lvl.id) === Number(levelNumber)
    );
    const meta = metaById || levelsForUi[levelNumber - 1] || levelsForUi[0];

    return {
      levelNumber,
      label: meta.label,
      shortLabel: meta.shortLabel || meta.label,
      description: meta.description,
      nowBullets: Array.isArray(meta.nowBullets) ? meta.nowBullets : [],
      nextHint: meta.nextHint || "",
    };
  })();

  const nextLevelUi =
    trustLevelUi && levelsForUi
      ? getNextLevelUi(levelsForUi, trustLevelUi.levelNumber)
      : null;

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
          <div className="asrar-whispers-level-badges">
            {levelsForUi.map((lvl) => {
              const isActive = lvl.id === trustLevelUi.levelNumber;
              return (
                <div
                  key={lvl.id}
                  className={
                    "asrar-whispers-level-badge" +
                    (isActive
                      ? " asrar-whispers-level-badge--active"
                      : "")
                  }
                >
                  <div className="asrar-whispers-level-dot">{lvl.id}</div>
                  <span className="asrar-whispers-level-label">
                    {lvl.shortLabel || lvl.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {trustLevelUi && (
          <>
            <p className="asrar-whispers-section-heading">
              {isAr
                ? "ماذا يفتح لك هذا المستوى؟"
                : "What this level gives you"}
            </p>
            <ul className="asrar-whispers-now-list">
              {trustLevelUi.nowBullets.map((line, idx) => (
                <li key={idx}>{`✅ ${line}`}</li>
              ))}
            </ul>
            <p className="asrar-whispers-next-hint">
              {nextLevelUi
                ? isAr
                  ? `المستوى التالي يفتح: ${nextLevelUi.nextHint} استمر بالفضفضة بصدق مع هذا الرفيق، خصوصًا عن مشاعرك الحقيقية.`
                  : `Next level unlocks: ${nextLevelUi.nextHint} Keep talking honestly with this companion, especially about how you really feel.`
                : isAr
                ? "لقد وصلت لأعلى مستوى في الجانب الخفي. استمر بنفس الصراحة، ورفيقك سيواصل تعميق همساته عنك مع الوقت."
                : "You’ve reached the highest Hidden Side level. Keep being this honest and your companion will keep deepening its private reflections about you over time."}
            </p>
          </>
        )}

        <p className="asrar-whispers-explainer">
          {isAr
            ? "الجانب الخفي هو مقياس ثقة؛ كل ما فضفضت أكثر وبصدق، تنفتح لك همسات عاطفية أعمق مع الوقت."
            : "Hidden Side is a trust meter: more honest, frequent conversations slowly unlock deeper emotional whispers."}
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
              ? "لا توجد همسات بعد. استمر في بناء الثقة وستبدأ بالظهور هنا."
              : "No whispers yet. Keep building trust and they’ll start appearing here."}
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
