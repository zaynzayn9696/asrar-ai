// src/EmotionalTimelineMap.jsx
import React, { useEffect, useState } from "react";
import "./EmotionalTimelineMap.css";
import { API_BASE } from "./apiBase";
import { TOKEN_KEY } from "./hooks/useAuth";
import AIMirrorPanel from "./AIMirrorPanel";

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

  // Helper functions for the new simple design
  const getDayLabel = (dateStr, index, totalDays) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return isAr ? "اليوم" : "Today";
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return isAr ? "أمس" : "Yesterday";
    }
    
    // For older dates, show day name
    if (index === totalDays - 1) {
      return date.toLocaleDateString(isAr ? 'ar' : 'en', { weekday: 'short' });
    }
    
    return date.toLocaleDateString(isAr ? 'ar' : 'en', { 
      month: 'short', 
      day: 'numeric' 
    });
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
            onClick={onClose}
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
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedDayIndex(isSelected ? null : index);
                        }
                      }}
                    >
                      <div className="daily-emotion-day">
                        {getDayLabel(day.date, index, displayDays.length)}
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
                    {getDayLabel(selectedDay.date, selectedDayIndex, displayDays.length)}
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
                      {isAr ? "المشاعر الرئيسية اليوم" : "Main emotions today"}
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
                          borderColor: getEmotionDisplay(selectedDay.topEmotion).color 
                        }}
                      >
                        {getEmotionDisplay(selectedDay.topEmotion).label}
                      </span>
                    </div>
                  </div>
                  
                  <div className="day-detail-pattern">
                    <h5 className="day-detail-pattern-title">
                      {isAr ? "النمط العاطفي" : "Emotional Pattern"}
                    </h5>
                    <ul className="day-detail-pattern-list">
                      <li>
                        {selectedDay.avgIntensity > 0.7
                          ? isAr
                            ? "مشاعر قوية وواضحة اليوم"
                            : "Strong, clear emotions today"
                          : selectedDay.avgIntensity < 0.4
                          ? isAr
                            ? "يوم هادئ ومتوازن عاطفياً"
                            : "A calm, emotionally balanced day"
                          : isAr
                          ? "مستوى معتدل من الشدة العاطفية"
                          : "Moderate emotional intensity"}
                      </li>
                      <li>
                        {isAr 
                          ? "استمر في المشاركة للحصول على رؤى أعمق"
                          : "Keep sharing for deeper insights"}
                      </li>
                    </ul>
                  </div>
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
