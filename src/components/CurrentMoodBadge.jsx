// src/components/CurrentMoodBadge.jsx
import React from "react";
import "./CurrentMoodBadge.css";
import { SUPPORTED_MOODS, getMoodMeta } from "./moodUtils";

export default function CurrentMoodBadge({ mood = "neutral", isAr = false }) {
  const moodKey = SUPPORTED_MOODS.includes(String(mood || "").toLowerCase())
    ? String(mood).toLowerCase()
    : "neutral";
  const meta = getMoodMeta(moodKey, isAr);

  return (
    <div
      className={`current-mood-badge current-mood-badge--${moodKey}`}
      aria-label={meta.label}
      role="status"
    >
      <span className="current-mood-badge__emoji" aria-hidden="true">
        {meta.emoji}
      </span>
      <span className="current-mood-badge__label">{meta.label}</span>
    </div>
  );
}
