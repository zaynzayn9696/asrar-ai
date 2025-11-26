// src/VoiceMessageBubble.jsx
// Simple tap-to-play voice message bubble used in the chat view.
import React, { useEffect, useRef, useState } from "react";

const SPEED_OPTIONS = [
  { value: 1.25, label: "1.25x" },
  { value: 1.5, label: "1.5x" },
];

const VOICE_SPEED_STORAGE_KEY = "asrar-voice-speed";

export default function VoiceMessageBubble({ audioBase64, from, isArabic }) {
  const audioRef = useRef(null);
  const trackRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.25);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // hydrate playback speed from localStorage once
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const stored = window.localStorage.getItem(VOICE_SPEED_STORAGE_KEY);
      if (!stored) return;
      const parsed = parseFloat(stored);
      const allowed = SPEED_OPTIONS.map((o) => o.value);
      if (allowed.includes(parsed)) {
        setPlaybackRate(parsed);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!audioBase64) return undefined;
    const src = `data:audio/mpeg;base64,${audioBase64}`;
    const audioEl = new Audio(src);
    audioRef.current = audioEl;
    audioEl.playbackRate = playbackRate;

    const onTimeUpdate = () => {
      if (!audioEl.duration || Number.isNaN(audioEl.duration)) {
        setProgress(0);
        return;
      }
      setProgress((audioEl.currentTime / audioEl.duration) * 100);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audioEl.addEventListener("timeupdate", onTimeUpdate);
    audioEl.addEventListener("ended", onEnded);

    return () => {
      audioEl.pause();
      audioEl.removeEventListener("timeupdate", onTimeUpdate);
      audioEl.removeEventListener("ended", onEnded);
    };
  }, [audioBase64]);

  // keep playbackRate in sync with the audio element and persist choice
  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl) {
      audioEl.playbackRate = playbackRate;
    }
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          VOICE_SPEED_STORAGE_KEY,
          String(playbackRate)
        );
      }
    } catch (_) {}
  }, [playbackRate]);

  const handleToggle = () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (isPlaying) {
      audioEl.pause();
      setIsPlaying(false);
    } else {
      audioEl
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
        });
    }
  };

  const handleSpeedChange = (value) => {
    setPlaybackRate(value);
  };

  const updateTimeFromClientX = (clientX) => {
    const audioEl = audioRef.current;
    const trackEl = trackRef.current;
    if (!audioEl || !trackEl || !audioEl.duration || Number.isNaN(audioEl.duration)) {
      return;
    }
    const rect = trackEl.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audioEl.currentTime = audioEl.duration * ratio;
    setProgress(ratio * 100);
  };

  const handleTrackMouseDown = (e) => {
    e.preventDefault();
    setIsScrubbing(true);
    updateTimeFromClientX(e.clientX);
  };

  const handleTrackMouseMove = (e) => {
    if (!isScrubbing) return;
    e.preventDefault();
    updateTimeFromClientX(e.clientX);
  };

  const handleTrackMouseUp = () => {
    setIsScrubbing(false);
  };

  const handleTrackMouseLeave = () => {
    if (isScrubbing) {
      setIsScrubbing(false);
    }
  };

  const handleTrackTouchStart = (e) => {
    if (!e.touches || !e.touches.length) return;
    setIsScrubbing(true);
    updateTimeFromClientX(e.touches[0].clientX);
  };

  const handleTrackTouchMove = (e) => {
    if (!isScrubbing || !e.touches || !e.touches.length) return;
    updateTimeFromClientX(e.touches[0].clientX);
  };

  const handleTrackTouchEnd = () => {
    setIsScrubbing(false);
  };

  const label = isArabic
    ? from === "user"
      ? "رسالتك الصوتية"
      : "رد صوتي"
    : from === "user"
    ? "Your voice note"
    : "Voice reply";

  return (
    <div className="asrar-voice-bubble">
      <button
        type="button"
        className="asrar-voice-play-btn"
        onClick={handleToggle}
        aria-label={label}
        aria-pressed={isPlaying}
      >
        <span className="asrar-voice-play-btn-icon" aria-hidden="true">
          {isPlaying ? (
            // pause icon
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            // play icon
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </span>
      </button>
      <div className="asrar-voice-meta">
        <div className="asrar-voice-label">{label}</div>
        <div className="asrar-voice-speed-row">
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={
                "asrar-voice-speed-btn" +
                (opt.value === playbackRate ? " asrar-voice-speed-btn--active" : "")
              }
              onClick={() => handleSpeedChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div
          className="asrar-voice-progress-track"
          ref={trackRef}
          onMouseDown={handleTrackMouseDown}
          onMouseMove={handleTrackMouseMove}
          onMouseUp={handleTrackMouseUp}
          onMouseLeave={handleTrackMouseLeave}
          onTouchStart={handleTrackTouchStart}
          onTouchMove={handleTrackTouchMove}
          onTouchEnd={handleTrackTouchEnd}
        >
          <div
            className="asrar-voice-progress-bar"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
