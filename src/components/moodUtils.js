// src/components/moodUtils.js

const UI_MOOD_ALIASES = {
  sad: ["sad", "sadness", "lonely", "loneliness", "down"],
  anxious: ["anxious", "anxiety", "fear", "worry", "stressed", "stress"],
  angry: ["angry", "anger", "frustration", "frustrated"],
  tired: ["tired", "low-energy", "exhausted", "fatigue", "sleepy"],
  calm: ["calm", "stable", "steady", "grounded"],
  neutral: ["neutral", "mixed", "balanced"],
  hopeful: ["hopeful", "optimistic", "optimism"],
  happy: ["happy", "joy", "excitement", "excited"],
  warm: ["warm", "gratitude", "grateful", "love", "affection", "grace"],
};

export const SUPPORTED_MOODS = Object.keys(UI_MOOD_ALIASES);

export function mapEmotionToUIMood(emotion) {
  const key = String(emotion || "").toLowerCase();
  for (const mood of SUPPORTED_MOODS) {
    if (UI_MOOD_ALIASES[mood].includes(key)) return mood;
  }
  return null;
}

export function deriveUIMoodFromTimeline(timelineData) {
  if (timelineData && typeof timelineData === "object") {
    const stableCandidate = mapEmotionToUIMood(
      timelineData.currentMood?.dominantEmotion || timelineData.currentMood?.transientEmotion
    );
    if (stableCandidate) return stableCandidate;
  }

  const points = Array.isArray(timelineData?.points)
    ? timelineData.points
    : Array.isArray(timelineData)
    ? timelineData
    : [];

  for (let i = points.length - 1; i >= 0; i -= 1) {
    const candidateMood = mapEmotionToUIMood(points[i]?.topEmotion);
    if (candidateMood) return candidateMood;
  }

  return "neutral";
}

const MOOD_META_EN = {
  sad: { emoji: "🌧️", label: "Today: Sad & heavy" },
  anxious: { emoji: "🌬️", label: "Today: Anxious but pushing through" },
  angry: { emoji: "🔥", label: "Today: Tense & charged" },
  tired: { emoji: "🌫️", label: "Today: Tired, low energy" },
  calm: { emoji: "🌙", label: "Today: Calm & steady" },
  neutral: { emoji: "🌓", label: "Today: Neutral & balanced" },
  hopeful: { emoji: "🌈", label: "Today: Hopeful & open" },
  happy: { emoji: "✨", label: "Today: Bright & lifted" },
  warm: { emoji: "🌅", label: "Today: Warm & grateful" },
};

const MOOD_META_AR = {
  sad: { emoji: "🌧️", label: "اليوم: حزين وثقيل" },
  anxious: { emoji: "🌬️", label: "اليوم: قلق لكن مستمر" },
  angry: { emoji: "🔥", label: "اليوم: متوتر ومشحون" },
  tired: { emoji: "🌫️", label: "اليوم: مرهق ومنهك" },
  calm: { emoji: "🌙", label: "اليوم: هادئ ومتزن" },
  neutral: { emoji: "🌓", label: "اليوم: متعادل ومتوازن" },
  hopeful: { emoji: "🌈", label: "اليوم: متفائل ومنفتح" },
  happy: { emoji: "✨", label: "اليوم: منطلق ومبهج" },
  warm: { emoji: "🌅", label: "اليوم: دافئ وممتن" },
};

export function getMoodMeta(mood, isAr = false) {
  const key = SUPPORTED_MOODS.includes(String(mood || "").toLowerCase())
    ? String(mood).toLowerCase()
    : "neutral";
  const meta = (isAr ? MOOD_META_AR : MOOD_META_EN)[key];
  return meta || (isAr ? MOOD_META_AR.neutral : MOOD_META_EN.neutral);
}
