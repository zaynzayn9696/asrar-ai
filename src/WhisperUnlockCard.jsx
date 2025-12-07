// src/WhisperUnlockCard.jsx
import React from "react";
import "./Whispers.css";

export default function WhisperUnlockCard({
  whisper,
  personaName,
  isAr,
  onViewAll,
  onDismiss,
}) {
  if (!whisper) return null;

  const title = whisper.title || (isAr ? "همسة جديدة" : "New Whisper");
  const content = whisper.content || "";
  const level = whisper.levelRequired;

  const introLabel = isAr
    ? "وُجد سر جديد بينك وبين هذا الرفيق."
    : "A new secret has just unlocked between you and this companion.";

  const viewAllLabel = isAr ? "عرض كل الهمسات" : "View all whispers";
  const hideLabel = isAr ? "إخفاء" : "Hide";

  return (
    <div className="asrar-whisper-unlock-card">
      <div className="asrar-whisper-unlock-header">
        <span className="asrar-whisper-unlock-pill">
          {isAr ? "وضع الهمسات" : "Whispers Mode"}
        </span>
        {typeof level === "number" && (
          <span className="asrar-whisper-unlock-level">
            {isAr ? `المستوى ${level}` : `Level ${level}`}
          </span>
        )}
      </div>

      <div className="asrar-whisper-unlock-title-row">
        <h2 className="asrar-whisper-unlock-title">{title}</h2>
        {personaName && (
          <span className="asrar-whisper-unlock-persona">
            {isAr ? `مع ${personaName}` : `with ${personaName}`}
          </span>
        )}
      </div>

      <p className="asrar-whisper-unlock-intro">{introLabel}</p>

      {content && (
        <p className="asrar-whisper-unlock-content">{content}</p>
      )}

      <div className="asrar-whisper-unlock-actions">
        <button
          type="button"
          className="asrar-whisper-unlock-secondary"
          onClick={onDismiss}
        >
          {hideLabel}
        </button>
        <button
          type="button"
          className="asrar-whisper-unlock-primary"
          onClick={onViewAll}
        >
          {viewAllLabel}
        </button>
      </div>
    </div>
  );
}
