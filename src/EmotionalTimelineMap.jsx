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
              <div className="asrar-timeline-track-wrapper">
                <div className="asrar-timeline-track">
                  {visiblePoints.map((p, idx) => {
                    if (!p || typeof p !== "object") return null;

                    let dateLabel = "";
                    if (p.date) {
                      const date = new Date(p.date);
                      if (!Number.isNaN(date.getTime())) {
                        dateLabel = date.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        });
                      }
                    }

                    const rawEmotion = p.topEmotion || "NEUTRAL";
                    const emotion = String(rawEmotion).toUpperCase();

                    const rawIntensity = Number(p.avgIntensity);
                    const safeIntensity = Number.isFinite(rawIntensity)
                      ? Math.max(0, Math.min(1, rawIntensity))
                      : 0;
                    const pulseHeight = 40 + 110 * safeIntensity;

                    const keyEvents = Array.isArray(p.keyEvents)
                      ? p.keyEvents
                      : [];

                    return (
                      <div
                        key={idx}
                        className="asrar-timeline-point"
                      >
                        <div className="asrar-timeline-bar-wrapper">
                          <div
                            className={
                              "asrar-timeline-bar asrar-timeline-bar--" +
                              emotion.toLowerCase()
                            }
                            style={{ height: `${pulseHeight}px` }}
                          />
                          {keyEvents.length > 0 && (
                            <div className="asrar-timeline-events-dots">
                              {keyEvents.map((ev, j) => (
                                <span
                                  key={j}
                                  className={
                                    "asrar-timeline-event-dot asrar-timeline-event-dot--" +
                                    (ev?.type || "event")
                                  }
                                  title={ev?.label || ev?.type}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="asrar-timeline-point-label">
                          <div className="asrar-timeline-date">{dateLabel}</div>
                          <div className="asrar-timeline-emotion">
                            <span className="asrar-timeline-mood-pill">
                              {emotionLabel(emotion)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {points.length > 0 && (
          <p className="asrar-timeline-explainer">
            {isAr
              ? "كل عمود يمثّل مزاجك العام في ذلك اليوم، مع توضيح بسيط لكيفية تغيّر نمطك العاطفي عبر الأيام."
              : "Each bar shows your overall mood for that day and gives a simple sense of how your emotional pattern shifts over time."}
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
