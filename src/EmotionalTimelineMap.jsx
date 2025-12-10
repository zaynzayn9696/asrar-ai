// src/EmotionalTimelineMap.jsx
import React, { useEffect, useState } from "react";
import "./EmotionalTimelineMap.css";
import { API_BASE } from "./apiBase";
import { TOKEN_KEY } from "./hooks/useAuth";
import AIMirrorPanel from "./AIMirrorPanel";

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

  const title = personaName
    ? isAr
      ? `رحلة مشاعرك مع ${personaName}`
      : `Mood Journey with ${personaName}`
    : isAr
    ? "رحلة مشاعرك"
    : "Your Mood Journey";

  const subtitle = isAr
    ? "خريطة بصرية لكيفية تغيّر مشاعرك مع الوقت."
    : "A visual map of how your feelings change over time.";

  const emptyLabel = isAr
    ? "لا توجد بيانات للمشاعر بعد."
    : "No mood data available yet.";

  const emotionLabel = (emotionCode) => {
    const code = String(emotionCode || "NEUTRAL").toUpperCase();
    if (!isAr) return code;
    switch (code) {
      case "NEUTRAL":
        return "محايد";
      case "SAD":
        return "حزين";
      case "ANGRY":
        return "غاضب";
      case "ANXIOUS":
        return "قلق";
      case "LONELY":
        return "وحيد";
      case "STRESSED":
        return "مُتوتّر";
      default:
        return code;
    }
  };

  const emotionEmoji = (emotionCode) => {
    const code = String(emotionCode || "NEUTRAL").toUpperCase();
    switch (code) {
      case "HAPPY":
        return "😊";
      case "NEUTRAL":
        return "😐";
      case "SAD":
        return "😢";
      case "ANGRY":
        return "😡";
      case "ANXIOUS":
        return "😰";
      case "LONELY":
        return "😔";
      case "STRESSED":
        return "😰";
      case "EXCITED":
        return "🤩";
      case "TIRED":
        return "😴";
      case "WARM":
        return "❤️";
      case "HOPEFUL":
        return "🌈";
      case "GRATEFUL":
        return "🙏";
      default:
        return "💭";
    }
  };

  const handleRetry = () => {
    setRefreshKey((k) => k + 1);
  };

  if (!isOpen) return null;

  return (
    <div className="asrar-timeline-layer" onClick={handleBackdropClick}>
      <div
        className="asrar-timeline-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="asrar-timeline-header">
          <div>
            <h2 className="asrar-timeline-title">{title}</h2>
            <p className="asrar-timeline-subtitle">{subtitle}</p>
            <div className="asrar-timeline-header-right">
              <div className="asrar-timeline-range-toggle">
              <button
                type="button"
                className={
                  "asrar-timeline-range-btn" +
                  (range === "7d" ? " asrar-timeline-range-btn--active" : "")
                }
                onClick={() => setRange("7d")}
              >
                {isAr ? "آخر ٧ أيام" : "Last 7 days"}
              </button>
              <button
                type="button"
                className={
                  "asrar-timeline-range-btn" +
                  (range === "30d" ? " asrar-timeline-range-btn--active" : "")
                }
                onClick={() => setRange("30d")}
              >
                {isAr ? "آخر ٣٠ يومًا" : "Last 30 days"}
              </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="asrar-timeline-close"
            onClick={onClose}
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            ×
          </button>
        </div>

        {loading && (
          <div className="asrar-timeline-state">
            {isAr ? "جارٍ تحميل خريطة المشاعر…" : "Loading emotional timeline…"}
          </div>
        )}

        {error && !loading && (
          <div className="asrar-timeline-state asrar-timeline-state--error">
            <p>
              {isAr
                ? "تعذر تحميل خريطة المشاعر الآن."
                : "We couldn’t load your emotional history right now."}
            </p>
            <button
              type="button"
              className="asrar-timeline-retry"
              onClick={handleRetry}
            >
              {isAr ? "حاول مرة أخرى" : "Try again"}
            </button>
          </div>
        )}

        {!loading && !error && points.length === 0 && (
          <div className="asrar-timeline-state">{emptyLabel}</div>
        )}

        {!loading && !error && points.length > 0 && (
          <div className="asrar-timeline-body">
            <div className="asrar-timeline-scroll">
              <div className="asrar-timeline-visual">
                <div className="asrar-mood-stream-rail" />
                <div
                  className={
                    "asrar-mood-stream " +
                    (range === "7d"
                      ? "asrar-mood-stream--focus"
                      : "asrar-mood-stream--overview")
                  }
                >
                  {visiblePoints.map((p, idx) => {
                    if (!p || typeof p !== "object") return null;

                    let shortDate = "";
                    if (p.date) {
                      const d = new Date(p.date);
                      if (!Number.isNaN(d.getTime())) {
                        shortDate = d.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        });
                      }
                    }

                    const emotion = String(p.topEmotion || "NEUTRAL").toUpperCase();
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

                    const { value: intensityValue } = getIntensityMeta(
                      p.avgIntensity
                    );
                    const isSelected = idx === selectedIndex;

                    const nodeClass =
                      "asrar-mood-node " +
                      famClass +
                      (isSelected ? " asrar-mood-node--selected" : "");

                    return (
                      <button
                        key={idx}
                        type="button"
                        className={nodeClass}
                        style={{ "--intensity-scale": intensityValue }}
                        onClick={() => setSelectedIndex(idx)}
                        aria-pressed={isSelected}
                      >
                        <div className="asrar-mood-node-core" />
                        <span className="asrar-mood-node-day">{shortDate}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="asrar-timeline-details">
              {selectedPoint && (() => {
                const fullDate =
                  selectedPoint.date &&
                  !Number.isNaN(new Date(selectedPoint.date).getTime())
                    ? new Date(selectedPoint.date).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )
                    : "";
                const { level, label } = getIntensityMeta(
                  selectedPoint.avgIntensity
                );
                const description = describeDayCopy(
                  selectedPoint.topEmotion,
                  level
                );
                const events = Array.isArray(selectedPoint.keyEvents)
                  ? selectedPoint.keyEvents.map(mapEventLabel).filter(Boolean)
                  : [];

                return (
                  <div className="asrar-timeline-detail-card">
                    <div className="asrar-timeline-detail-header">
                      <div className="asrar-timeline-detail-main">
                        <div className="asrar-timeline-detail-date">
                          {fullDate}
                        </div>
                        <div className="asrar-timeline-detail-emotion-row">
                          <span className="asrar-timeline-mood-pill">
                            {emotionLabel(selectedPoint.topEmotion)}
                          </span>
                          <span className="asrar-timeline-detail-emoji">
                            {emotionEmoji(selectedPoint.topEmotion)}
                          </span>
                        </div>
                      </div>

                      <div
                        className={
                          "asrar-timeline-intensity asrar-timeline-intensity--" +
                          level
                        }
                      >
                        <span className="asrar-timeline-intensity-ring" />
                        <span className="asrar-timeline-intensity-label">
                          {label}
                        </span>
                      </div>
                    </div>

                    <div className="asrar-timeline-detail-body">
                      <p className="asrar-timeline-detail-copy">
                        {description}
                      </p>

                      {events.length > 0 && (
                        <div className="asrar-timeline-detail-events">
                          {events.slice(0, 2).map((label, idx) => (
                            <span
                              key={idx}
                              className="asrar-timeline-event-chip"
                            >
                              {label}
                            </span>
                          ))}
                          {events.length > 2 && (
                            <span className="asrar-timeline-detail-events-more">
                              {isAr
                                ? "وأحداث أخرى في هذا اليوم."
                                : "Plus other moments on this day."}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="asrar-timeline-legend">
                {isAr
                  ? "اللون يمثّل نوع الشعور، والسطوع وارتفاع النقطة يمثّلان شدّة المشاعر."
                  : "Color reflects the emotion family; glow and height reflect how intense the day felt."}
              </div>
            </div>
          </div>
        )}

        {points.length > 0 && (
          <p className="asrar-timeline-explainer">
            {isAr
              ? "كل نقطة مضيئة تمثّل مزاجك العام في ذلك اليوم، لتمنحك خريطة هادئة لكيف يتغيّر نمطك العاطفي عبر الأيام."
              : "Each glowing point shows your overall mood for that day, giving you a calm map of how your emotional pattern shifts over time."}
          </p>
        )}

        <div className="asrar-timeline-footer">
          <button
            type="button"
            className="asrar-timeline-mirror-btn"
            onClick={() => setShowMirror(true)}
          >
            {isAr ? "وضع المرآة العاطفية" : "Mirror Me"}
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
