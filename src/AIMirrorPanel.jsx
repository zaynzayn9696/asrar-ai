// src/AIMirrorPanel.jsx
import React, { useEffect, useState } from "react";
import "./AIMirror.css";
import { API_BASE } from "./apiBase";
import { TOKEN_KEY } from "./hooks/useAuth";

export default function AIMirrorPanel({
  isOpen,
  onClose,
  personaId,
  personaName,
  isAr,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summaryText, setSummaryText] = useState(null);
  const [insights, setInsights] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeMode, setActiveMode] = useState("persona"); // "persona" | "global"
  const [notEnoughHistory, setNotEnoughHistory] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const controller = new AbortController();

    const fetchMirror = async () => {
      setLoading(true);
      setError(null);
      setNotEnoughHistory(false);
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem(TOKEN_KEY)
            : null;
        const headers = {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        const res = await fetch(
          `${API_BASE}/api/mirror/${encodeURIComponent(
            activeMode === "global" ? "all" : personaId
          )}`,
          {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({
              rangeDays: 30,
              lang: isAr ? "ar" : "en",
            }),
            signal: controller.signal,
          }
        );
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            (data && data.message) ||
              (isAr
                ? "فشل توليد ملخص المرآة العاطفية."
                : "Failed to generate mirror summary.")
          );
        }
        if (!cancelled) {
          setSummaryText(data?.summaryText || null);
          setInsights(data?.insights || null);
          setNotEnoughHistory(!!data?.notEnoughHistory);
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

    fetchMirror();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, personaId, isAr, refreshKey, activeMode]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleRetry = () => {
    setRefreshKey((k) => k + 1);
  };

  const isGlobal = activeMode === "global";

  const title = isGlobal
    ? isAr
      ? "مرآة أسرار العاطفية – كل المحادثات"
      : "Asrar AI Mirror – All Conversations"
    : isAr
    ? "مرآة أسرار العاطفية"
    : "Asrar AI Mirror";

  const subtitle = isGlobal
    ? isAr
      ? "ملخص عاطفي مبسّط مبني على الأنماط في محادثاتك الأخيرة عبر أسرار AI."
      : "A simple emotional summary built from patterns in your recent chats across Asrar AI."
    : personaName
    ? isAr
      ? `ملخّص لطيف للمشاعر والأنماط التي تظهر في محادثاتك الأخيرة مع ${personaName}.`
      : `A friendly summary of the feelings and patterns your recent chats with ${personaName} have been showing.`
    : isAr
    ? "انعكاس لطيف للمشاعر والأنماط العاطفية التي التقطناها من محادثاتك الأخيرة."
    : "A gentle reflection of the moods and emotional patterns we’ve picked up from your recent conversations.";

  const noDataLabel = isAr
    ? "لا نملك بعد لحظات عاطفية كافية لنقدّم لك انعكاسًا حقيقيًا. تحدّث أكثر عن شعورك، خصوصًا في أيام ومزاجات مختلفة، ثم افتح المرآة مرة أخرى."
    : "We don’t have enough emotional moments yet to reflect back something real. Talk a bit more about how you feel—especially on different days—and then open Mirror Me again.";

  return (
    <div className="asrar-mirror-layer" onClick={handleBackdropClick}>
      <div
        className="asrar-mirror-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="asrar-mirror-header">
          <div>
            <h2 className="asrar-mirror-title">{title}</h2>
            <p className="asrar-mirror-subtitle">{subtitle}</p>
          </div>
          <button
            type="button"
            className="asrar-mirror-close"
            onClick={onClose}
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            ×
          </button>
        </div>
        <div className="asrar-mirror-tabs">
          <button
            type="button"
            className={
              "asrar-mirror-tab" +
              (activeMode === "persona" ? " asrar-mirror-tab--active" : "")
            }
            onClick={() => setActiveMode("persona")}
          >
            {isAr ? "هذا الرفيق" : "This Companion"}
          </button>
          <button
            type="button"
            className={
              "asrar-mirror-tab" +
              (activeMode === "global" ? " asrar-mirror-tab--active" : "")
            }
            onClick={() => setActiveMode("global")}
          >
            {isAr ? "كل المحادثات" : "All Conversations"}
          </button>
        </div>

        <div
          key={activeMode}
          className="asrar-mirror-content"
        >
          {activeMode === "persona" && (
            <>
              {loading && (
                <div className="asrar-mirror-state">
                  {isAr
                    ? "جارٍ توليد ملخص عاطفي…"
                    : "Generating a gentle emotional summary…"}
                </div>
              )}

              {error && !loading && (
                <div className="asrar-mirror-state asrar-mirror-state--error">
                  <p>
                    {isAr
                      ? "تعذر توليد المرآة الآن."
                      : "We couldn’t generate the mirror right now."}
                  </p>
                  <button
                    type="button"
                    className="asrar-mirror-retry"
                    onClick={handleRetry}
                  >
                    {isAr ? "حاول مرة أخرى" : "Try again"}
                  </button>
                </div>
              )}

              {!loading && !error && (!summaryText || notEnoughHistory) && (
                <div className="asrar-mirror-state">{noDataLabel}</div>
              )}

              {!loading && !error && summaryText && (
                <div className="asrar-mirror-body">
                  {summaryText.split(/\n+/).map((para, idx) => (
                    <p key={idx} className="asrar-mirror-paragraph">
                      {para}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}

          {activeMode === "global" && (
            <div className="asrar-mirror-body">
              <p className="asrar-mirror-paragraph">
                {isAr
                  ? "ما زلنا نتعلم من محادثاتك مع كل الرفاق. كلما شاركت مشاعرك أكثر، سنعرض لك هنا أنماطًا بسيطة في مزاجك عبر المحادثات."
                  : "We’re still learning from your conversations across companions. As you share more about your feelings, this space will show simple patterns in your moods."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
