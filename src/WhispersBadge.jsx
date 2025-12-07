// src/WhispersBadge.jsx
import React from "react";
import "./Whispers.css";

export default function WhispersBadge({ isAr, hasNew, onClick }) {
  const label = isAr ? "الجانب الخفي" : "Hidden Side";

  return (
    <button
      type="button"
      className={
        "asrar-whispers-badge" +
        (hasNew ? " asrar-whispers-badge--highlight" : "")
      }
      onClick={onClick}
    >
      <span className="asrar-whispers-badge-icon" aria-hidden="true">
        ☾
      </span>
      <span className="asrar-whispers-badge-label">{label}</span>
      {hasNew && <span className="asrar-whispers-badge-dot" />}
    </button>
  );
}
