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
  const [previewLevelId, setPreviewLevelId] = useState(null);

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

  useEffect(() => {
    if (!isOpen) {
      setPreviewLevelId(null);
    }
  }, [isOpen]);

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

  const currentLevelNumber = trustLevelUi?.levelNumber || null;

  const effectivePreviewLevelNumber =
    previewLevelId && levelsForUi
      ? (() => {
          const found = levelsForUi.find(
            (lvl) => Number(lvl.id) === Number(previewLevelId)
          );
          return found ? Number(found.id) : currentLevelNumber;
        })()
      : currentLevelNumber;

  const previewLevelUi =
    effectivePreviewLevelNumber != null
      ? (() => {
          const metaById = levelsForUi.find(
            (lvl) => Number(lvl.id) === Number(effectivePreviewLevelNumber)
          );
          const meta =
            metaById ||
            levelsForUi[effectivePreviewLevelNumber - 1] ||
            levelsForUi[0];
          return {
            levelNumber: effectivePreviewLevelNumber,
            label: meta.label,
            shortLabel: meta.shortLabel || meta.label,
            description: meta.description,
            nowBullets: Array.isArray(meta.nowBullets) ? meta.nowBullets : [],
            nextHint: meta.nextHint || "",
          };
        })()
      : null;

  const nextLevelUi =
    previewLevelUi && levelsForUi
      ? getNextLevelUi(levelsForUi, previewLevelUi.levelNumber)
      : null;

  let progressToNext = null;
  let progressPercent = null;
  let nextLevelNumberForProgress = null;
  let railFillPercent = null;

  if (trustScore != null && trustLevelUi) {
    if (trustLevelUi.levelNumber >= 5) {
      progressToNext = 1;
      progressPercent = 100;
    } else {
      const currentNumber = trustLevelUi.levelNumber;
      const currentMin = (currentNumber - 1) * 20;
      const nextMin = currentNumber * 20;
      const range = nextMin - currentMin || 1;
      const raw = (trustScore - currentMin) / range;
      const clamped = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      progressToNext = clamped;
      progressPercent = Math.round(clamped * 100);
      nextLevelNumberForProgress = currentNumber + 1;
    }

    const segmentsBetweenLevels = 4;
    const completedSegments = Math.max(
      0,
      Math.min(segmentsBetweenLevels, trustLevelUi.levelNumber - 1)
    );
    const partial =
      progressToNext != null
        ? progressToNext < 0
          ? 0
          : progressToNext > 1
          ? 1
          : progressToNext
        : 0;
    const totalSegments = Math.min(
      segmentsBetweenLevels,
      completedSegments + partial
    );
    railFillPercent = Math.round(
      (totalSegments / segmentsBetweenLevels) * 100
    );
  }

  const handleRetry = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="asrar-whispers-layer" onClick={handleBackdropClick}>
      <div
        className="asrar-whispers-panel"
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Header Zone */}
        <div className="hidden-side-header">
          <div className="hidden-side-header-content">
            <h2 className="hidden-side-title">{title}</h2>
            <p className="hidden-side-subtitle">{subtitle}</p>
          </div>
          <button
            type="button"
            className="hidden-side-close-btn"
            onClick={onClose}
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            ×
          </button>
        </div>

        {trustLevelUi && (
          <>
            {/* Trust Level & Progress Hero */}
            <div className="trust-level-hero">
              <div className="trust-level-display">
                <div className="trust-level-number">
                  {isAr ? `المستوى ${trustLevelUi.levelNumber}` : `Level ${trustLevelUi.levelNumber}`}
                </div>
                <div className="trust-level-name">{trustLevelUi.label}</div>
              </div>
              
              <div className="xp-bar-container">
                <div className="xp-bar-label">
                  {trustLevelUi.levelNumber < 5 && progressPercent != null
                    ? isAr
                      ? `التقدّم نحو المستوى ${nextLevelNumberForProgress}: ${progressPercent}%`
                      : `Progress to Level ${nextLevelNumberForProgress}: ${progressPercent}%`
                    : isAr
                    ? "وصلت لأعلى مستوى ثقة"
                    : "Maximum trust level reached"}
                </div>
                <div className="xp-bar-wrapper">
                  <div className="xp-bar-track" />
                  <div
                    className="xp-bar-fill"
                    style={{
                      width: `${railFillPercent != null ? railFillPercent : 0}%`,
                    }}
                  />
                  {progressPercent != null && (
                    <div
                      className="xp-bar-glow"
                      key={progressPercent}
                    />
                  )}
                </div>
                <div className="xp-bar-hint">
                  {isAr
                    ? "المحادثات الصادقة والمستمرة = تقدم أسرع"
                    : "More honest, consistent emotional conversations = faster progress"}
                </div>
              </div>
            </div>

            {/* Level Selector */}
            <div className="level-selector">
              <div className="level-selector-title">
                {isAr ? "اختر مستوى" : "Select Level"}
              </div>
              <div className="level-orbs">
                {levelsForUi.map((lvl) => {
                  const levelNumber = Number(lvl.id);
                  const isCurrent =
                    trustLevelUi &&
                    levelNumber === Number(trustLevelUi.levelNumber);
                  const isPreview =
                    previewLevelUi &&
                    levelNumber === Number(previewLevelUi.levelNumber);
                  const isLocked =
                    trustLevelUi &&
                    Number(trustLevelUi.levelNumber) < levelNumber;
                  const isCompleted =
                    trustLevelUi &&
                    Number(trustLevelUi.levelNumber) > levelNumber;

                  return (
                    <div
                      key={lvl.id}
                      className={`
                        level-orb
                        ${isCurrent ? "level-orb--current" : ""}
                        ${isCompleted ? "level-orb--completed" : ""}
                        ${isPreview ? "level-orb--preview" : ""}
                        ${isLocked ? "level-orb--locked" : ""}
                      `}
                      role="button"
                      tabIndex={isLocked ? -1 : 0}
                      onClick={() => !isLocked && setPreviewLevelId(lvl.id)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && !isLocked) {
                          e.preventDefault();
                          setPreviewLevelId(lvl.id);
                        }
                      }}
                    >
                      <div className="level-orb-inner">
                        <div className="level-orb-number">{lvl.id}</div>
                        {isLocked && (
                          <div className="level-orb-lock">🔒</div>
                        )}
                      </div>
                      <div className="level-orb-label">
                        {lvl.shortLabel || lvl.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current Level Details Card */}
            {previewLevelUi && (
              <div className="level-details-card">
                <div className="level-details-header">
                  <div className="level-details-icon">
                    {previewLevelUi.shortLabel || previewLevelUi.label}
                  </div>
                  <h3 className="level-details-title">{previewLevelUi.label}</h3>
                </div>
                
                <div className="level-details-content">
                  <div className="level-section">
                    <h4 className="level-section-title">
                      {isAr ? "ما يعنيه هذا المستوى" : "What this level means"}
                    </h4>
                    <ul className="level-section-list">
                      {previewLevelUi.nowBullets.slice(0, 5).map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  </div>
                  
                  {nextLevelUi && (
                    <div className="level-section">
                      <h4 className="level-section-title">
                        {isAr ? "المستوى التالي يفتح" : "Next level unlocks"}
                      </h4>
                      <ul className="level-section-list">
                        {nextLevelUi.nextHint && (
                          <li>{nextLevelUi.nextHint}</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* How to Level Up Card */}
            <div className="howto-card">
              <h3 className="howto-card-title">
                {isAr ? "كيف ترتقي في المستويات" : "How to level up"}
              </h3>
              <ul className="howto-card-list">
                <li>
                  {isAr
                    ? "تحدث بصدق عن مشاعرك الحقيقية"
                    : "Talk honestly about how you really feel"}
                </li>
                <li>
                  {isAr
                    ? "تواصل في أيام مختلفة، وليس مرة واحدة فقط"
                    : "Come back on different days, not just once"}
                </li>
                <li>
                  {isAr
                    ? "شارك أفكاراً عميقة وليست محادثات سطحية"
                    : "Share deep thoughts, not just small talk"}
                </li>
                <li>
                  {isAr
                    ? "رد على فحوصات المزاج والمتابعات من رفيقك"
                    : "Respond to emotional check-ins from your companion"}
                </li>
              </ul>
            </div>
          </>
        )}

        {/* Whispers Area */}
        <div className="whispers-area">
          <h3 className="whispers-area-title">
            {isAr ? "الهمسات المفتوحة" : "Unlocked whispers"}
          </h3>
          
          {loading && (
            <div className="whispers-loading">
              {isAr ? "جارٍ تحميل الهمسات…" : "Loading whispers…"}
            </div>
          )}

          {error && !loading && (
            <div className="whispers-error">
              <p>
                {isAr
                  ? "تعذر تحميل همساتك الآن."
                  : "We couldn't load your whispers right now."}
              </p>
              <button
                type="button"
                className="whispers-retry-btn"
                onClick={handleRetry}
              >
                {isAr ? "حاول مرة أخرى" : "Try again"}
              </button>
            </div>
          )}

          {!loading && !error && unlockedList.length === 0 && (
            <div className="whispers-empty">
              <div className="whispers-empty-icon">🔮</div>
              <div className="whispers-empty-text">
                {isAr
                  ? "لا توجد همسات بعد. استمر في بناء الثقة وستظهر انعكاساتك الخاصة هنا."
                  : "No whispers yet. Keep building trust and your first private reflection will appear here."}
              </div>
            </div>
          )}

          {!loading && !error && unlockedList.length > 0 && (
            <div className="whispers-grid">
              {unlockedList.map((w) => (
                <div
                  key={`${w.id}-${w.unlockedAt || ""}`}
                  className="whisper-card"
                >
                  <div className="whisper-card-header">
                    <h4 className="whisper-card-title">{w.title}</h4>
                    {typeof w.levelRequired === "number" && (
                      <span className="whisper-card-level">
                        {isAr ? `مستوى ${w.levelRequired}` : `Level ${w.levelRequired}`}
                      </span>
                    )}
                  </div>
                  {w.shortPreview && (
                    <p className="whisper-card-preview">{w.shortPreview}</p>
                  )}
                  <div className="whisper-card-meta">
                    <span className="whisper-card-persona">{personaName}</span>
                    {w.unlockedAt && (
                      <span className="whisper-card-date">
                        {new Date(w.unlockedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="hidden-side-footer">
          {isAr
            ? "الجانب الخفي هو مقياس ثقة؛ المحادثات الصادقة والمتكررة تفتح همسات عاطفية أعمق ببطء."
            : "Hidden Side is a trust meter. More honest, frequent emotional talks slowly unlock deeper emotional whispers."}
        </div>
      </div>
    </div>
  );
}
