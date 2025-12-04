// server/src/config/characterVoices.js
// Central mapping between Asrar characters and their TTS voice profile.
//
// This mapping assumes the OpenAI `tts-1` model and its documented voices
// (e.g. "alloy", "echo", "fable", "onyx", "nova", "verse"). Adjust if
// OpenAI adds/removes voices.

const DEFAULT_VOICE_ID = process.env.OPENAI_TTS_VOICE || "alloy";

const CHARACTER_VOICES = {
  // Sheikh Al-Hara – VERY deep, older, warm, wise male.
  // Voice choice: "onyx" – one of the deepest male-sounding voices in tts‑1,
  // which generally reads as older and calmer than the brighter options.
  "sheikh-al-hara": {
    voiceId: "onyx",
    styleDescription:
      "Very deep, older, warm and wise male. Slow, calm, reassuring tone.",
    defaultTone: "calm",
  },

  // Daloua – soft, mid‑20s FEMALE with warm emotional tone.
  // Voice choice: "shimmer" – expressive, feminine-leaning voice that tends
  // to sound warm and emotional rather than neutral or flat.
  daloua: {
    voiceId: "shimmer",
    styleDescription:
      "Female, mid 20s, warm and empathetic. Soft, expressive, emotionally present tone.",
    defaultTone: "soft",
  },

  // Abu Mukh – educated, mid‑20s MALE, teacher‑like.
  // Voice choice: "fable" – narrative male voice that feels like a calm,
  // articulate storyteller or lecturer; good fit for a structured teacher.
  "abu-mukh": {
    voiceId: "fable",
    styleDescription:
      "Male, mid 20s, confident and educated. Clear, structured, teacher-like storyteller tone.",
    defaultTone: "energetic",
  },

  // Walaa – confident, blunt FEMALE in her mid‑30s.
  // Voice choice: "nova" – brighter, higher-energy voice that still supports
  // a direct, no-nonsense personality when combined with her persona.
  walaa: {
    voiceId: "nova",
    styleDescription:
      "Female, mid 30s, confident and blunt. Straight to the point with a slightly sharper, more mature tone.",
    defaultTone: "strict",
  },

  // Hiba – young, energetic, Gen‑Z female.
  // Voice choice: "alloy" – bright, friendly default voice; combined with
  // persona it reads as high-energy, playful, early‑20s.
  hiba: {
    voiceId: "alloy",
    styleDescription:
      "Female, early 20s, young and energetic. Smiley, hyper, friendly tone.",
    defaultTone: "energetic",
  },

  // Fallback profile for any unknown character IDs
  default: {
    voiceId: DEFAULT_VOICE_ID,
    styleDescription: "Neutral, friendly assistant voice.",
  },
};

module.exports = { CHARACTER_VOICES };
