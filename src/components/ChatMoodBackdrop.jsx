// src/components/ChatMoodBackdrop.jsx
import React from "react";
import "./ChatMoodBackdrop.css";

const SUPPORTED_MOODS = [
  "sad",
  "anxious",
  "angry",
  "tired",
  "neutral",
  "calm",
  "hopeful",
  "happy",
  "warm",
];

export default function ChatMoodBackdrop({ mood = "neutral" }) {
  const rawMood = String(mood || "neutral").toLowerCase();
  const moodKey = SUPPORTED_MOODS.includes(rawMood) ? rawMood : "neutral";

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      className={`chat-mood-backdrop chat-mood-backdrop--${moodKey} ${
        prefersReducedMotion ? "chat-mood-backdrop--reduced-motion" : ""
      }`}
      aria-hidden="true"
    >
      <div className="chat-mood-backdrop__base" />
      <div className="chat-mood-backdrop__texture" />
      <div className="chat-mood-backdrop__tint" />

      {!prefersReducedMotion && (
        <>
          <div className="chat-mood-backdrop__motion" />
          <div className="chat-mood-backdrop__particles" />
        </>
      )}
    </div>
  );
}
