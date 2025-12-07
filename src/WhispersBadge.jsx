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
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="12"
            cy="10"
            r="4"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M12 14v3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M10.5 17.5h3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="asrar-whispers-badge-label">{label}</span>
      {hasNew && <span className="asrar-whispers-badge-dot" />}
    </button>
  );
}
