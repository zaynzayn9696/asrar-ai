// src/EmotionalTimelineMap.jsx
import React, { useEffect, useState } from "react";
import "./EmotionalTimelineMap.css";
import { API_BASE } from "./apiBase";
import { TOKEN_KEY } from "./hooks/useAuth";
import AIMirrorPanel from "./AIMirrorPanel";

const dayKeyLocal = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString("en-CA");
};

// Emotion display data
const EMOTION_DISPLAY = {
  en: {
    HAPPY: { label: "Happy", emoji: "😊", color: "#FFD700" },
    NEUTRAL: { label: "Neutral", emoji: "😐", color: "#87CEEB" },
    SAD: { label: "Sad", emoji: "😢", color: "#6495ED" },
    ANGRY: { label: "Angry", emoji: "😡", color: "#FF6B6B" },
    ANXIOUS: { label: "Anxious", emoji: "😰", color: "#FFB6C1" },
    LONELY: { label: "Lonely", emoji: "😔", color: "#9370DB" },
    STRESSED: { label: "Stressed", emoji: "😰", color: "#FFA07A" },
    EXCITED: { label: "Excited", emoji: "🤩", color: "#FFD700" },
    TIRED: { label: "Tired", emoji: "😴", color: "#B0C4DE" },
    WARM: { label: "Warm", emoji: "❤️", color: "#FF69B4" },
    HOPEFUL: { label: "Hopeful", emoji: "🌈", color: "#98FB98" },
    GRATEFUL: { label: "Grateful", emoji: "🙏", color: "#F0E68C" },
  },
  ar: {
    HAPPY: { label: "سعيد", emoji: "😊", color: "#FFD700" },
    NEUTRAL: { label: "محايد", emoji: "😐", color: "#87CEEB" },
    SAD: { label: "حزين", emoji: "😢", color: "#6495ED" },
    ANGRY: { label: "غاضب", emoji: "😡", color: "#FF6B6B" },
    ANXIOUS: { label: "قلق", emoji: "😰", color: "#FFB6C1" },
    LONELY: { label: "وحيد", emoji: "😔", color: "#9370DB" },
    STRESSED: { label: "مُتوتّر", emoji: "😰", color: "#FFA07A" },
    EXCITED: { label: "متحمس", emoji: "🤩", color: "#FFD700" },
    TIRED: { label: "متعب", emoji: "😴", color: "#B0C4DE" },
    WARM: { label: "دافئ", emoji: "❤️", color: "#FF69B4" },
    HOPEFUL: { label: "متفائل", emoji: "🌈", color: "#98FB98" },
    GRATEFUL: { label: "ممتن", emoji: "🙏", color: "#F0E68C" },
  },
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
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const [mirrorScope, setMirrorScope] = useState("current"); // "current" or "all"

  const [mirrorSummary, setMirrorSummary] = useState(null);
  const [mirrorLoading, setMirrorLoading] = useState(false);
  const [mirrorError, setMirrorError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const controller = new AbortController();

    const fetchTimeline = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) throw new Error("No auth token");

        const res = await fetch(
          `${API_BASE}/api/emotions/timeline?personaId=${encodeURIComponent(
            personaId
          )}&range=30d&refresh=${refreshKey}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          }
        );

        if (!res.ok) throw new Error("Failed to fetch timeline");

        const timelineData = await res.json();
        if (!cancelled) {
          setData(timelineData);
          setSelectedDayIndex(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Timeline fetch error:", err);
          setError(isAr ? "فشل تحميل البيانات" : "Failed to load data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTimeline();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, personaId, refreshKey, isAr]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const controller = new AbortController();

    const fetchMirrorSummary = async () => {
      setMirrorLoading(true);
      setMirrorError(null);
      setMirrorSummary(null);

      try {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) throw new Error("No auth token");

        const scopePersonaId = mirrorScope === "current" ? personaId : "all";
        const res = await fetch(
          `${API_BASE}/api/emotions/mirror-summary?personaId=${encodeURIComponent(
            scopePersonaId
          )}&range=30d`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          }
        );

        if (!res.ok) throw new Error("Failed to fetch mirror summary");

        const summaryData = await res.json();
        if (!cancelled) {
          setMirrorSummary(summaryData);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Mirror summary fetch error:", err);
          setMirrorError(isAr ? "فشل تحميل ملخص المرآة" : "Failed to load mirror summary");
        }
      } finally {
        if (!cancelled) setMirrorLoading(false);
      }
    };

    fetchMirrorSummary();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, personaId, mirrorScope, isAr]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

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

  const buildDayNarrative = (day) => {
    const summary = day?.daySummary || {};
    const start = summary.startEmotion;
    const end = summary.endEmotion;
    const peak = summary.peakEmotion;
    const swings = summary.swings || 0;
    const volatility = summary.volatility || "low";
    const msgCount = summary.messageCount || 0;
    const intensity = typeof summary.avgIntensity === "number" ? summary.avgIntensity : day?.avgIntensity;

    if (!msgCount && !day?.topEmotion) {
      return isAr
        ? "لا توجد محادثات مسجلة لهذا اليوم بعد."
        : "No conversations are logged for this day yet.";
    }

    const parts = [];
    if (start) {
      parts.push(
        isAr
          ? `بدأ اليوم بنبرة ${start.toLowerCase()}.`
          : `The day started sounding ${start.toLowerCase()}.`
      );
    }
    if (peak) {
      parts.push(
        isAr
          ? `أعلى لحظة كانت ${peak.toLowerCase()} (الشدة ${(Math.round((summary.peakIntensity || 0) * 100) / 100) || intensity || 0}).`
          : `Peak tone hit ${peak.toLowerCase()} (intensity ${(Math.round((summary.peakIntensity || 0) * 100) / 100) || intensity || 0}).`
      );
    }
    if (end && end !== start) {
      parts.push(
        isAr
          ? `انتهى اليوم على ${end.toLowerCase()}.`
          : `It ended feeling ${end.toLowerCase()}.`
      );
    }
    if (!parts.length && day?.topEmotion) {
      parts.push(
        isAr
          ? `النبرة العامة كانت ${day.topEmotion.toLowerCase()}.`
          : `Overall the tone was ${day.topEmotion.toLowerCase()}.`
      );
    }

    const swingLine =
      volatility === "high"
        ? isAr
          ? "اليوم كان متقلباً بوضوح، عدة تغيرات في النبرة."
          : "The day swung noticeably with several shifts."
        : volatility === "medium"
        ? isAr
          ? "هناك بعض التبدلات المتوسطة في المشاعر."
          : "There were a few shifts in mood."
        : isAr
        ? "النبرة بقيت مستقرة نسبياً."
        : "The tone stayed relatively steady.";

    return `${parts.join(" ")} ${swingLine}`.trim();
  };

  const buildDayBullets = (day) => {
    const summary = day?.daySummary || {};
    const bullets = [];
    if (summary.startEmotion) {
      bullets.push(
        isAr
          ? `البداية: ${summary.startEmotion.toLowerCase()}`
          : `Start: ${summary.startEmotion.toLowerCase()}`
      );
    }
    if (summary.peakEmotion) {
      bullets.push(
        isAr
          ? `الذروة: ${summary.peakEmotion.toLowerCase()}`
          : `Peak: ${summary.peakEmotion.toLowerCase()}`
      );
    }
    if (summary.endEmotion) {
      bullets.push(
        isAr
          ? `النهاية: ${summary.endEmotion.toLowerCase()}`
          : `End: ${summary.endEmotion.toLowerCase()}`
      );
    }
    if (typeof summary.swings === "number") {
      bullets.push(
        isAr
          ? `عدد التبدلات: ${summary.swings}`
          : `Mood shifts: ${summary.swings}`
      );
    }
    if (summary.messageCount) {
      bullets.push(
        isAr
          ? `عدد الرسائل: ${summary.messageCount}`
          : `Messages: ${summary.messageCount}`
      );
    }
    return bullets;
  };

  // Helper functions for the new simple design
  const todayKey = React.useMemo(() => dayKeyLocal(new Date()), []);

  const yesterdayKey = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dayKeyLocal(d);
  }, []);

  const getDayLabel = (dateValue, index, totalDays, dayKeyOverride) => {
    const key = dayKeyOverride || (dateValue ? dayKeyLocal(dateValue) : "");
    if (!key) return "";

    if (key === todayKey) {
      return isAr ? "اليوم" : "Today";
    }
    if (key === yesterdayKey) {
      return isAr ? "أمس" : "Yesterday";
    }

    // For older dates, show month/day
    if (index === totalDays - 1) {
      try {
        return new Date(key).toLocaleDateString(isAr ? "ar" : "en", {
          weekday: "short",
        });
      } catch (_) {
        return key;
      }
    }

    try {
      return new Date(key).toLocaleDateString(isAr ? "ar" : "en", {
        month: "short",
        day: "numeric",
      });
    } catch (_) {
      return key;
    }
  };

  const getEmotionDisplay = (emotionCode) => {
    const code = String(emotionCode || "NEUTRAL").toUpperCase();
    const langEmotions = EMOTION_DISPLAY[isAr ? "ar" : "en"] || EMOTION_DISPLAY.en;
    return langEmotions[code] || langEmotions.NEUTRAL;
  };

  const getMirrorSummary = () => {
    if (mirrorError) {
      return isAr ? "لا يمكن عرض الملخص الآن." : "Unable to show summary right now.";
    }
    if (mirrorLoading || !mirrorSummary) {
      return isAr ? "جاري التحميل..." : "Loading...";
    }
    if (mirrorSummary && mirrorSummary.hasEnoughData === false) {
      return isAr
        ? mirrorSummary.summaryAr ||
            "لا توجد بيانات كافية بعد. استمر في المحادثات وسنشاركك أنماطك لاحقاً."
        : mirrorSummary.summaryEn ||
            "Not enough data yet. Keep chatting and I’ll reflect your patterns soon.";
    }
    return isAr ? mirrorSummary.summaryAr : mirrorSummary.summaryEn;
  };

  const getMirrorEmotionTags = () => {
    if (!mirrorSummary || mirrorSummary.hasEnoughData === false) {
      return [];
    }
    const tags = [mirrorSummary.primaryEmotion];
    if (mirrorSummary.secondaryEmotion) {
      tags.push(mirrorSummary.secondaryEmotion);
    }
    if (mirrorSummary.volatility && mirrorSummary.volatility !== "low") {
      if (mirrorSummary.volatility === "high") {
        tags.push(isAr ? "متقلب" : "Volatile");
      } else if (mirrorSummary.volatility === "medium") {
        tags.push(isAr ? "متغير" : "Shifts");
      }
    }
    return tags;
  };

  const handleRetry = () => {
    setRefreshKey((k) => k + 1);
  };

  const title = personaName
    ? isAr
      ? `رحلتك العاطفية مع ${personaName}`
      : `Your Emotional Journey with ${personaName}`
    : isAr
    ? "رحلتك العاطفية"
    : "Your Emotional Journey";

  const subtitle = isAr
    ? "هذه لوحة تعرض مشاعرك اليومية على مدار الأيام. إنها أداة تأملية وليست تشخيصاً طبياً."
    : "This dashboard shows your daily emotions over time. It's a reflective tool, not medical advice.";

  // Get last 10 days for display
  const displayDays = React.useMemo(() => {
    if (!points.length) return [];
    return points.slice(-10).reverse(); // Most recent first
  }, [points]);

  useEffect(() => {
    if (displayDays.length) {
      setSelectedDayIndex(null);
    }
  }, [displayDays]);

  const selectedDay = selectedDayIndex !== null 
    ? displayDays[selectedDayIndex] 
    : null;

  if (!isOpen) return null;

  return (
    <div className="asrar-timeline-layer" onClick={handleBackdropClick}>
      <div
        className="asrar-timeline-panel"
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Header Section */}
        <div className="emotional-journey-header">
          <div className="emotional-journey-header-content">
            <h2 className="emotional-journey-title">{title}</h2>
            <p className="emotional-journey-subtitle">{subtitle}</p>
          </div>
          <button
            type="button"
            className="emotional-journey-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            ×
          </button>
        </div>

        {/* Empty State */}
        {!loading && !error && displayDays.length === 0 && (
          <div className="emotional-journey-empty">
            <div className="emotional-journey-empty-icon">🌱</div>
            <h3 className="emotional-journey-empty-title">
              {isAr ? "ابدأ رحلتك العاطفية" : "Start Your Emotional Journey"}
            </h3>
            <p className="emotional-journey-empty-text">
              {isAr 
                ? "رحلتك العاطفية تبدأ بمجرد إجراء عدة محادثات حقيقية."
                : "Your Emotional Journey starts once you've had a few real conversations."}
            </p>
            
            {/* Mirror Me section in empty state */}
            <div className="mirror-me-section mirror-me-section--disabled">
              <div className="mirror-me-content">
                <div className="mirror-me-info">
                  <h4 className="mirror-me-title">
                    {isAr ? "المرآة العاطفية" : "Emotional Mirror"}
                  </h4>
                  <p className="mirror-me-description">
                    {isAr 
                      ? "احصل على رؤى أعمق حول مشاعرك بعد إجراء المزيد من المحادثات."
                      : "Get deeper insights into your emotions after more conversations."}
                  </p>
                </div>
                <button
                  type="button"
                  className="mirror-me-btn mirror-me-btn--disabled"
                  disabled
                >
                  {isAr ? "فتح المرآة العاطفية" : "Open Emotional Mirror"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content when data exists */}
        {!loading && !error && displayDays.length > 0 && (
          <div className="emotional-journey-content">
            {/* Daily Emotions Strip */}
            <div className="daily-emotions-strip">
              <h3 className="daily-emotions-title">
                {isAr ? "المشاعر اليومية" : "Daily Emotions"}
              </h3>
              <div className="daily-emotions-grid">
                {displayDays.map((day, index) => {
                  const emotionDisplay = getEmotionDisplay(day.topEmotion);
                  const isSelected = selectedDayIndex === index;
                  
                  return (
                    <div
                      key={index}
                      className={`daily-emotion-card ${
                        isSelected ? "daily-emotion-card--selected" : ""
                      }`}
                      onClick={() => setSelectedDayIndex(isSelected ? null : index)}
                    >
                      <div className="daily-emotion-day">
                        {getDayLabel(day.date, index, displayDays.length, day.dateKey)}
                      </div>
                      <div className="daily-emotion-visual">
                        <div 
                          className="daily-emotion-emoji"
                          style={{ color: emotionDisplay.color }}
                        >
                          {emotionDisplay.emoji}
                        </div>
                        <div 
                          className="daily-emotion-chip"
                          style={{ 
                            backgroundColor: `${emotionDisplay.color}20`,
                            borderColor: emotionDisplay.color 
                          }}
                        >
                          {emotionDisplay.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day Detail Section */}
            {selectedDay && (
              <div className="day-detail-section">
                <div className="day-detail-header">
                  <h4 className="day-detail-title">
                    {getDayLabel(selectedDay.date, selectedDayIndex, displayDays.length, selectedDay.dateKey)}
                  </h4>
                  <button
                    type="button"
                    className="day-detail-close"
                    onClick={() => setSelectedDayIndex(null)}
                    aria-label={isAr ? "إغلاق" : "Close"}
                  >
                    ×
                  </button>
                </div>
                <div className="day-detail-content">
                  <div className="day-detail-emotions">
                    <h5 className="day-detail-emotions-title">
                      {isAr ? "المشاعر الأبرز" : "Top Emotions"}
                    </h5>
                    <div className="day-detail-emotion-row">
                      <span
                        className="day-detail-emoji"
                        style={{ color: getEmotionDisplay(selectedDay.topEmotion).color }}
                      >
                        {getEmotionDisplay(selectedDay.topEmotion).emoji}
                      </span>
                      <span
                        className="day-detail-emotion-label"
                        style={{
                          backgroundColor: `${getEmotionDisplay(selectedDay.topEmotion).color}20`,
                          borderColor: getEmotionDisplay(selectedDay.topEmotion).color,
                        }}
                      >
                        {getEmotionDisplay(selectedDay.topEmotion).label}
                      </span>
                    </div>
                  </div>
                  {selectedDay && selectedDay.topEmotion ? (
                    <div className="day-detail-pattern">
                      <h5 className="day-detail-pattern-title">
                        {isAr ? "ملخص اليوم" : "Day Story"}
                      </h5>
                      <p className="day-detail-copy">
                        {buildDayNarrative(selectedDay)}
                      </p>
                      <ul className="day-detail-pattern-list">
                        {buildDayBullets(selectedDay).map((line, idx) => (
                          <li key={idx}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="day-detail-copy">
                      {isAr ? "لا يوجد بيانات متاحة لهذا اليوم." : "No data available for this day."}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Mirror Me Section */}
            <div className="mirror-me-section">
              <div className="mirror-me-content">
                <div className="mirror-me-info">
                  <h4 className="mirror-me-title">
                    {isAr ? "المرآة العاطفية" : "Emotional Mirror"}
                  </h4>
                  <p className="mirror-me-description">
                    {isAr 
                      ? "احصل على رؤى أعمق حول أنماطك العاطفية وعلاقاتها."
                      : "Get deeper insights into your emotional patterns and relationships."}
                  </p>
                </div>
                <button
                  type="button"
                  className="mirror-me-btn"
                  onClick={() => setShowMirror(true)}
                >
                  {isAr ? "فتح المرآة العاطفية" : "Open Emotional Mirror"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="emotional-journey-loading">
            <div className="emotional-journey-loading-spinner" />
            <p className="emotional-journey-loading-text">
              {isAr ? "جارٍ تحميل رحلتك العاطفية..." : "Loading your emotional journey..."}
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="emotional-journey-error">
            <p className="emotional-journey-error-text">{error}</p>
            <button
              type="button"
              className="emotional-journey-retry-btn"
              onClick={handleRetry}
            >
              {isAr ? "حاول مرة أخرى" : "Try again"}
            </button>
          </div>
        )}

        {/* Mirror Me Modal */}
        {showMirror && (
          <div className="mirror-me-modal-overlay" onClick={() => setShowMirror(false)}>
            <div 
              className="mirror-me-modal"
              onClick={(e) => e.stopPropagation()}
              dir={isAr ? "rtl" : "ltr"}
            >
              <div className="mirror-me-modal-header">
                <h3 className="mirror-me-modal-title">
                  {isAr ? "المرآة العاطفية" : "Emotional Mirror"}
                </h3>
                <button
                  type="button"
                  className="mirror-me-modal-close"
                  onClick={() => setShowMirror(false)}
                  aria-label={isAr ? "إغلاق" : "Close"}
                >
                  ×
                </button>
              </div>
              
              <div className="mirror-me-modal-content">
                <div className="mirror-me-summary">
                  <p className="mirror-me-summary-text">
                    {getMirrorSummary()}
                  </p>
                  {mirrorSummary && !mirrorLoading && !mirrorError && (
                    <div className="mirror-me-emotion-tags">
                      {getMirrorEmotionTags().map((tag, idx) => {
                        const display = getEmotionDisplay(tag);
                        return (
                          <span
                            key={idx}
                            className="mirror-me-emotion-tag"
                            style={{
                              backgroundColor: `${display.color}20`,
                              borderColor: display.color,
                              color: display.color,
                            }}
                          >
                            {display.emoji} {display.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                <div className="mirror-me-scope">
                  <h4 className="mirror-me-scope-title">
                    {isAr ? "نطاق التحليل" : "Analysis Scope"}
                  </h4>
                  <div className="mirror-me-scope-options">
                    <label className="mirror-me-scope-option">
                      <input
                        type="radio"
                        name="mirror-scope"
                        value="current"
                        checked={mirrorScope === "current"}
                        onChange={(e) => setMirrorScope(e.target.value)}
                      />
                      <span className="mirror-me-scope-label">
                        {isAr ? "الشخصية الحالية فقط" : "Current character only"}
                      </span>
                    </label>
                    <label className="mirror-me-scope-option">
                      <input
                        type="radio"
                        name="mirror-scope"
                        value="all"
                        checked={mirrorScope === "all"}
                        onChange={(e) => setMirrorScope(e.target.value)}
                      />
                      <span className="mirror-me-scope-label">
                        {isAr ? "عبر جميع الشخصيات" : "Across all characters"}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
