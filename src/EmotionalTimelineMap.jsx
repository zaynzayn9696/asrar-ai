// src/EmotionalTimelineMap.jsx
import React, { useEffect, useState } from "react";
import "./EmotionalTimelineMap.css";
import { API_BASE } from "./apiBase";
import { TOKEN_KEY } from "./hooks/useAuth";
import AIMirrorPanel from "./AIMirrorPanel";

// Emotional Journey stages/chapters
const JOURNEY_STAGES = {
  en: [
    {
      id: 1,
      label: "Noticing",
      shortLabel: "Notice",
      description: "You're starting to pay attention to your emotional patterns.",
      nowBullets: [
        "Basic awareness of your daily mood changes",
        "Simple recognition of strong emotions",
        "Beginning to notice emotional triggers",
      ],
      nextHint: "deeper emotional insights and pattern recognition",
    },
    {
      id: 2,
      label: "Naming",
      shortLabel: "Name",
      description: "You're learning to identify and name your emotions clearly.",
      nowBullets: [
        "Clear emotional vocabulary and labeling",
        "Understanding the difference between similar feelings",
        "Expressing emotions with more precision",
      ],
      nextHint: "understanding the root causes and patterns",
    },
    {
      id: 3,
      label: "Understanding",
      shortLabel: "Understand",
      description: "You're exploring why emotions happen and how they connect.",
      nowBullets: [
        "Connecting emotions to specific situations",
        "Recognizing recurring emotional cycles",
        "Seeing how thoughts influence feelings",
      ],
      nextHint: "healing strategies and emotional regulation",
    },
    {
      id: 4,
      label: "Healing",
      shortLabel: "Heal",
      description: "You're developing healthy ways to process and recover.",
      nowBullets: [
        "Building emotional resilience and coping tools",
        "Processing difficult emotions constructively",
        "Finding balance during emotional storms",
      ],
      nextHint: "sustainable emotional growth and wisdom",
    },
    {
      id: 5,
      label: "Growing",
      shortLabel: "Grow",
      description: "You're using emotional wisdom to navigate life's challenges.",
      nowBullets: [
        "Applying emotional insights proactively",
        "Helping others understand their emotions",
        "Living with greater emotional intelligence",
      ],
      nextHint: "You're already mastering your emotional journey",
    },
  ],
  ar: [
    {
      id: 1,
      label: "الملاحظة",
      shortLabel: "لاحظ",
      description: "تبدأ بالانتباه إلى أنماطك العاطفية.",
      nowBullets: [
        "وعي أساسي بتغيرات مزاجك اليومية",
        "التعرف البسيط على المشاعر القوية",
        "بدء ملاحظة المحفزات العاطفية",
      ],
      nextHint: "رؤى عاطفية أعمق وتحديد الأنماط",
    },
    {
      id: 2,
      label: "التسمية",
      shortLabel: "سمِّ",
      description: "تتعلم كيفية تحديد المشاعر وتسميتها بوضوح.",
      nowBullets: [
        "مفردات عاطفية واضحة وتسمية دقيقة",
        "فهم الفرق بين المشاعر المتشابهة",
        "التعبير عن المشاعر بدقة أكبر",
      ],
      nextHint: "فهم الأسباب الجذرية والأنماط",
    },
    {
      id: 3,
      label: "الفهم",
      shortLabel: "افهم",
      description: "تستكشف لماذا تحدث المشاعر وكيف تتصل ببعضها.",
      nowBullets: [
        "ربط المشاعر بمواقف محددة",
        "التعرف على الدورات العاطفية المتكررة",
        "رؤية كيف تؤثر الأفكار على المشاعر",
      ],
      nextHint: "استراتيجيات الشفاء والتنظيم العاطفي",
    },
    {
      id: 4,
      label: "الشفاء",
      shortLabel: "اشفِ",
      description: "تطور طرقاً صحية لمعالجة المشاعر والتعافي.",
      nowBullets: [
        "بناء المرونة العاطفية وأدوات المواجهة",
        "معالجة المشاعر الصعبة بشكل بنّاء",
        "إيجاد التوازن خلال العواصف العاطفية",
      ],
      nextHint: "النمو العاطفي المستدامل والحكمة",
    },
    {
      id: 5,
      label: "النمو",
      shortLabel: "انمُ",
      description: "تستخدم الحكمة العاطفية لمواجهة تحديات الحياة.",
      nowBullets: [
        "تطبيق الرؤى العاطفية بشكل استباقي",
        "مساعدة الآخرين على فهم مشاعرهم",
        "العيش بذكاء عاطفي أكبر",
      ],
      nextHint: "أنت بالفعل تتقن رحلتك العاطفية",
    },
  ],
};

export default function EmotionalTimelineMap({
  isOpen,
  onClose,
  personaId,
  personaName,
  isAr,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showMirror, setShowMirror] = useState(false);
  const [range, setRange] = useState("30d");
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedStageId, setSelectedStageId] = useState(null);

  useEffect(() => {
    if (!isOpen || !personaId) return;

    let cancelled = false;
    const controller = new AbortController();

    const fetchTimeline = async () => {
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
        const url = `${API_BASE}/api/emotions/timeline?personaId=${encodeURIComponent(
          personaId
        )}&range=30d`;
        const res = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers,
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            (json && json.message) ||
              (isAr
                ? "فشل تحميل خريطة المشاعر."
                : "Failed to load emotional timeline.")
          );
        }
        if (!cancelled) {
          setData(json || null);
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

    fetchTimeline();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, personaId, isAr, refreshKey]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const points = React.useMemo(() => {
    if (Array.isArray(data?.points)) return data.points;
    // Also support a plain array response shape: [ { date, topEmotion, avgIntensity, keyEvents } ]
    if (Array.isArray(data)) return data;
    return [];
  }, [data]);

  const visiblePoints = React.useMemo(() => {
    if (!points.length) return [];
    const normalized = points.filter((p) => p && typeof p === "object");
    if (!normalized.length) return [];
    if (range === "7d") {
      // Show the most recent 7 mood snapshots client-side
      return normalized.slice(-7);
    }
    return normalized;
  }, [points, range]);

  useEffect(() => {
    if (visiblePoints.length > 0) {
      setSelectedIndex(visiblePoints.length - 1);
    } else {
      setSelectedIndex(null);
    }
  }, [visiblePoints]);

  const selectedPoint =
    selectedIndex != null &&
    selectedIndex >= 0 &&
    selectedIndex < visiblePoints.length
      ? visiblePoints[selectedIndex]
      : null;

  const getIntensityMeta = (avgIntensityRaw) => {
    const v = Number.isFinite(avgIntensityRaw)
      ? Math.max(0, Math.min(1, avgIntensityRaw))
      : 0.5;
    let level = "medium";
    if (v < 0.35) level = "low";
    else if (v >= 0.7) level = "high";

    const label = isAr
      ? level === "low"
        ? "منخفضة"
        : level === "high"
        ? "مرتفعة"
        : "متوسطة"
      : level === "low"
      ? "Low"
      : level === "high"
      ? "High"
      : "Medium";

    return { value: v, level, label };
  };

  const describeDayCopy = (emotionCode, intensityLevel) => {
    const code = String(emotionCode || "NEUTRAL").toUpperCase();
    const heavy =
      code === "ANGRY" || code === "STRESSED" || code === "ANXIOUS";
    const low = intensityLevel === "low";
    const high = intensityLevel === "high";

    if (isAr) {
      if (high && heavy) {
        return "يبدو أن هذا اليوم كان مُحمّلًا بمشاعر قوية وثقيلة.";
      }
      if (high && !heavy) {
        return "يوم مليء بالمشاعر الواضحة والحضور العاطفي القوي.";
      }
      if (low) {
        return "يوم هادئ نسبيًا، بمشاعر خفيفة ومتوازنة.";
      }
      return "يوم بمستوى متوسط من الشدة العاطفية، لا هو ثقيل ولا خفيف تمامًا.";
    }

    if (high && heavy) {
      return "This day carried a lot of emotional weight and tension.";
    }
    if (high && !heavy) {
      return "A vivid, emotionally present day with strong feelings.";
    }
    if (low) {
      return "A comparatively gentle day with softer emotional energy.";
    }
    return "A day with a moderate emotional load — neither very heavy nor completely light.";
  };

  const mapEventLabel = (evt) => {
    if (!evt) return null;
    if (typeof evt === "string") {
      const s = evt.toLowerCase();
      if (s.includes("whisper")) {
        return isAr ? "وِسواس / هَمْسَة" : "Whisper moment";
      }
      if (s.includes("voice")) {
        return isAr ? "جلسة صوتية" : "Voice session";
      }
      if (s.includes("mirror")) {
        return isAr ? "استخدام المرآة" : "Mirror used";
      }
      return evt;
    }
    if (typeof evt === "object") {
      const base = evt.label || evt.type || "";
      if (!base) return null;
      return base;
    }
    return null;
  };

  const handleRetry = () => {
    setRefreshKey((k) => k + 1);
  };

  // Calculate current journey stage based on data points
  const getCurrentJourneyStage = () => {
    if (!points.length) return 1;
    // Simple logic: more points = higher stage
    const pointCount = points.length;
    if (pointCount <= 5) return 1; // Noticing
    if (pointCount <= 12) return 2; // Naming
    if (pointCount <= 25) return 3; // Understanding
    if (pointCount <= 40) return 4; // Healing
    return 5; // Growing
  };

  const currentStageNumber = getCurrentJourneyStage();
  const langKey = isAr ? "ar" : "en";
  const stagesForUi = JOURNEY_STAGES[langKey] || JOURNEY_STAGES.en;
  
  const currentStageUi = stagesForUi.find(
    (stage) => Number(stage.id) === Number(currentStageNumber)
  ) || stagesForUi[0];
  
  const selectedStageUi = selectedStageId 
    ? stagesForUi.find((stage) => Number(stage.id) === Number(selectedStageId))
    : currentStageUi;
  
  const nextStageUi = selectedStageUi && stagesForUi
    ? stagesForUi.find((stage) => Number(stage.id) === Number(selectedStageUi.id) + 1)
    : null;

  // Get recent pattern summary
  const getRecentPattern = () => {
    if (!points.length) {
      return isAr 
        ? "ابدأ بالحديث عن مشاعرك لترى أنماطك هنا."
        : "Start talking about your feelings to see your patterns here.";
    }
    
    const recentPoints = points.slice(-7);
    const emotions = recentPoints.map(p => p.topEmotion).filter(Boolean);
    
    if (!emotions.length) {
      return isAr 
        ? "استمر في المشاركة لرؤية الأنماط العاطفية."
        : "Keep sharing to see emotional patterns.";
    }
    
    // Simple pattern detection
    const stressEmotions = ['STRESSED', 'ANXIOUS', 'ANGRY'];
    const happyEmotions = ['HAPPY', 'EXCITED', 'GRATEFUL', 'HOPEFUL'];
    
    const stressCount = emotions.filter(e => stressEmotions.includes(e)).length;
    const happyCount = emotions.filter(e => happyEmotions.includes(e)).length;
    
    if (stressCount > happyCount * 1.5) {
      return isAr 
        ? "مؤخراً كنت تشعر بالتوتر أكثر. حاول ممارسة التقنيات المريحة."
        : "Recently you've been more stressed. Try relaxation techniques.";
    } else if (happyCount > stressCount * 1.5) {
      return isAr 
        ? "مؤخراً كنت في مزاج جيد! استمر في الأنشطة التي تجلب لك السعادة."
        : "You've been in a good mood lately! Keep up what's working.";
    } else {
      return isAr 
        ? "مزاجك متوازن lately. استمر في الوعي بمشاعرك."
        : "Your mood has been balanced lately. Keep staying aware.";
    }
  };

  const title = personaName
    ? isAr
      ? `رحلتك العاطفية مع ${personaName}`
      : `Your Emotional Journey with ${personaName}`
    : isAr
    ? "رحلتك العاطفية"
    : "Your Emotional Journey";

  const subtitle = isAr
    ? "قصة مرئية لنموك العاطفي وتطورك مع الوقت."
    : "A visual story of your emotional growth and progress over time.";

  if (!isOpen) return null;

  return (
    <div className="asrar-timeline-layer" onClick={handleBackdropClick}>
      <div
        className="asrar-timeline-panel"
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Header Zone */}
        <div className="emotional-journey-header">
          <div className="emotional-journey-header-content">
            <h2 className="emotional-journey-title">{title}</h2>
            <p className="emotional-journey-subtitle">{subtitle}</p>
          </div>
          <button
            type="button"
            className="emotional-journey-close-btn"
            onClick={onClose}
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            ×
          </button>
        </div>

        {/* Journey Progress Track */}
        <div className="journey-progress-hero">
          <div className="journey-stage-display">
            <div className="journey-stage-number">
              {isAr ? `المرحلة ${currentStageUi.id}` : `Stage ${currentStageUi.id}`}
            </div>
            <div className="journey-stage-name">{currentStageUi.label}</div>
          </div>
          
          <div className="journey-progress-container">
            <div className="journey-progress-label">
              {isAr ? "تقدمك في الرحلة" : "Your journey progress"}
            </div>
            <div className="journey-progress-wrapper">
              <div className="journey-progress-track" />
              <div 
                className="journey-progress-fill" 
                style={{width: `${(currentStageNumber / 5) * 100}%`}} 
              />
              <div className="journey-progress-glow" />
            </div>
            <div className="journey-progress-hint">
              {isAr 
                ? `${currentStageNumber} من 5 مراحل مكتملة` 
                : `${currentStageNumber} of 5 stages completed`}
            </div>
          </div>
        </div>

        {/* Stage Selector */}
        <div className="stage-selector">
          <div className="stage-selector-title">
            {isAr ? "اختر مرحلة" : "Select Stage"}
          </div>
          <div className="stage-orbs">
            {stagesForUi.map(stage => {
              const isCurrent = Number(stage.id) === Number(currentStageNumber);
              const isSelected = Number(stage.id) === Number(selectedStageId);
              const isCompleted = Number(stage.id) < Number(currentStageNumber);
              const isLocked = Number(stage.id) > Number(currentStageNumber) + 1;
              
              return (
                <div 
                  key={stage.id} 
                  className={`stage-orb ${
                    isCurrent ? 'stage-orb--current' : ''
                  } ${
                    isSelected ? 'stage-orb--preview' : ''
                  } ${
                    isCompleted ? 'stage-orb--completed' : ''
                  } ${
                    isLocked ? 'stage-orb--locked' : ''
                  }`}
                  role="button"
                  tabIndex={isLocked ? -1 : 0}
                  onClick={() => !isLocked && setSelectedStageId(stage.id)}
                  onKeyDown={(e) => {
                    if (!isLocked && (e.key === 'Enter' || e.key === ' ')) {
                      setSelectedStageId(stage.id);
                    }
                  }}
                >
                  <div className="stage-orb-inner">
                    <div className="stage-orb-number">{stage.id}</div>
                    {isLocked && <div className="stage-orb-lock">🔒</div>}
                  </div>
                  <div className="stage-orb-label">{stage.shortLabel || stage.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stage Details Card */}
        {selectedStageUi && (
          <div className="stage-details-card">
            <div className="stage-details-header">
              <div className="stage-details-icon">
                {selectedStageUi.shortLabel || selectedStageUi.label}
              </div>
              <h3 className="stage-details-title">{selectedStageUi.label}</h3>
            </div>
            <div className="stage-details-content">
              <div className="stage-section">
                <h4 className="stage-section-title">
                  {isAr ? "ما تعنيه هذه المرحلة" : "What this stage means"}
                </h4>
                <ul className="stage-section-list">
                  {selectedStageUi.nowBullets.map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              </div>
              {nextStageUi && (
                <div className="stage-section">
                  <h4 className="stage-section-title">
                    {isAr ? "المرحلة التالية تفتح" : "Next stage unlocks"}
                  </h4>
                  <ul className="stage-section-list">
                    <li>{nextStageUi.nextHint}</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* How to Progress Card */}
        <div className="howto-progress-card">
          <h3 className="howto-progress-card-title">
            {isAr ? "كيف تتقدم في رحلتك" : "How to progress in your journey"}
          </h3>
          <ul className="howto-progress-card-list">
            <li>
              {isAr 
                ? "تحدث عن مشاعرك الحقيقية، وليس فقط ما تعتقد أن يجب عليك قوله"
                : "Talk about your true feelings, not just what you think you should say"}
            </li>
            <li>
              {isAr 
                ? "احضر يومياً للمشاركة، حتى لو لفترة قصيرة"
                : "Show up daily to share, even for brief moments"}
            </li>
            <li>
              {isAr 
                ? "اشرح ما الذي أثار مشاعرك، وليس فقط اسم المشاعر"
                : "Explain what triggered your feelings, not just the emotion names"}
            </li>
            <li>
              {isAr 
                ? "استخدم المرآة العاطفية للحصول على رؤى أعمق"
                : "Use the emotional mirror for deeper insights"}
            </li>
          </ul>
        </div>

        {/* Journey Summary Area */}
        <div className="journey-summary-area">
          <h3 className="journey-summary-title">
            {isAr ? "ملخص الرحلة" : "Journey Summary"}
          </h3>
          <div className="journey-summary-content">
            <p className="journey-summary-text">{getRecentPattern()}</p>
            
            {/* Show recent mood visualization if data exists */}
            {!loading && !error && points.length > 0 && (
              <div className="recent-mood-visualization">
                <div className="recent-mood-title">
                  {isAr ? "المزاج مؤخراً" : "Recent Moods"}
                </div>
                <div className="recent-mood-stream">
                  {points.slice(-7).map((p, idx) => {
                    const emotion = String(p.topEmotion || "NEUTRAL").toUpperCase();
                    const { value: intensityValue } = getIntensityMeta(p.avgIntensity);
                    
                    let famClass = "mood-neutral";
                    if (
                      emotion === "HAPPY" ||
                      emotion === "EXCITED" ||
                      emotion === "WARM" ||
                      emotion === "GRATEFUL" ||
                      emotion === "HOPEFUL"
                    ) {
                      famClass = "mood-happy";
                    } else if (emotion === "SAD" || emotion === "LONELY") {
                      famClass = "mood-sad";
                    } else if (
                      emotion === "ANGRY" ||
                      emotion === "STRESSED" ||
                      emotion === "ANXIOUS"
                    ) {
                      famClass = "mood-angry";
                    }
                    
                    return (
                      <div 
                        key={idx} 
                        className={`recent-mood-node ${famClass}`}
                        style={{ "--intensity-scale": intensityValue }}
                      >
                        <div className="recent-mood-node-core" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {loading && (
              <div className="journey-summary-loading">
                {isAr ? "جارٍ تحليل رحلتك..." : "Analyzing your journey..."}
              </div>
            )}
            
            {error && !loading && (
              <div className="journey-summary-error">
                <p>
                  {isAr
                    ? "تعذر تحليل رحلتك الآن."
                    : "We couldn't analyze your journey right now."}
                </p>
                <button
                  type="button"
                  className="journey-summary-retry-btn"
                  onClick={handleRetry}
                >
                  {isAr ? "حاول مرة أخرى" : "Try again"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="emotional-journey-footer">
          {isAr 
            ? "رحلتك العاطفية هي قصة نمك. كل محادثة صادقة تقربك من فهم أعمق."
            : "Your emotional journey is a growth story. Every honest conversation brings you closer to deeper understanding."}
        </div>

        {/* Mirror Button */}
        <div className="emotional-journey-actions">
          <button
            type="button"
            className="emotional-journey-mirror-btn"
            onClick={() => setShowMirror(true)}
          >
            {isAr ? "المرآة العاطفية" : "Emotional Mirror"}
          </button>
        </div>

        <AIMirrorPanel
          isOpen={showMirror}
          onClose={() => setShowMirror(false)}
          personaId={personaId}
          personaName={personaName}
          isAr={isAr}
        />
      </div>
    </div>
  );
}
