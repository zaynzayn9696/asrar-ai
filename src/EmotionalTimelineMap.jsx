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

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const points = Array.isArray(data?.points) ? data.points : [];

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
    ? "لا توجد بيانات كافية بعد لرسم خريطة المشاعر. استمر في التحدث مع رفيقك."
    : "Not enough history yet to draw a timeline. Keep talking with your companion.";

  const handleRetry = () => {
    setRefreshKey((k) => k + 1);
  };

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
              <div className="asrar-timeline-track">
                {points.map((p, idx) => {
                  const date = p.date ? new Date(p.date) : null;
                  const dateLabel = date
                    ? date.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    : "";
                  const emotion = (p.topEmotion || "NEUTRAL").toUpperCase();
                  const barHeight = 28 + 80 * (Number(p.avgIntensity) || 0);
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
                          style={{ height: `${barHeight}px` }}
                        />
                        {keyEvents.length > 0 && (
                          <div className="asrar-timeline-events-dots">
                            {keyEvents.map((ev, j) => (
                              <span
                                key={j}
                                className={
                                  "asrar-timeline-event-dot asrar-timeline-event-dot--" +
                                  (ev.type || "event")
                                }
                                title={ev.label || ev.type}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="asrar-timeline-point-label">
                        <div className="asrar-timeline-date">{dateLabel}</div>
                        <div className="asrar-timeline-emotion">{emotion}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
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
