// src/components/ChatMoodBackdrop.jsx
import React from "react";
import "./ChatMoodBackdrop.css";
import { SUPPORTED_MOODS } from "./moodUtils";

export default function ChatMoodBackdrop({ mood = "neutral" }) {
  const rawMood = String(mood || "neutral").toLowerCase();
  const moodKey = SUPPORTED_MOODS.includes(rawMood) ? rawMood : "neutral";

  return (
    <div
      className={`chat-mood-backdrop chat-mood-backdrop--${moodKey}`}
      aria-hidden="true"
    >
      <div className="chat-mood-layer chat-mood-layer--base" />
      <div className="chat-mood-layer chat-mood-layer--glow" />
      <div className="chat-mood-layer chat-mood-layer--particles" />
    </div>
  );
}
