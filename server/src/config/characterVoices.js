// server/src/config/characterVoices.js
// Central mapping between Asrar characters and their TTS voice profile.
//
// This mapping assumes the OpenAI `tts-1` model and its documented voices
// (e.g. "alloy", "echo", "fable", "onyx", "nova", "verse"). Adjust if
// OpenAI adds/removes voices.

const DEFAULT_VOICE_ID = process.env.OPENAI_TTS_VOICE || "alloy";

const CHARACTER_VOICES = {
  // Abu Zain – VERY deep, older, warm, wise male.
  // Voice choice: "onyx" – one of the deepest male-sounding voices in tts‑1,
  // which generally reads as older and calmer than the brighter options.
  "abu-zain": {
    voiceId: "onyx",
    styleDescription:
      "Very deep, older, warm and wise male. Slow, calm, reassuring tone.",
    defaultTone: "calm",
  },

  // Hana – warm, early‑40s, clearly FEMALE with soft emotional tone.
  // Voice choice: "shimmer" – expressive, clearly feminine voice that tends
  // to sound warm and emotional rather than neutral or flat.
  hana: {
    voiceId: "shimmer",
    styleDescription:
      "Female, early 40s, warm and empathetic. Soft, expressive, emotionally present tone.",
    defaultTone: "soft",
  },

  // Rashid – educated, mid‑30s MALE, teacher‑like.
  // Voice choice: "fable" – narrative male voice that feels like a calm,
  // articulate storyteller or lecturer; good fit for a structured teacher.
  rashid: {
    voiceId: "fable",
    styleDescription:
      "Male, mid 30s, confident and educated. Clear, structured, teacher-like storyteller tone.",
    defaultTone: "energetic",
  },

  // Nour – confident, blunt, slightly rude female.
  // Voice choice: "echo" – a bit sharper and more assertive sounding, matching
  // a direct, no-nonsense personality.
  nour: {
    voiceId: "echo",
    styleDescription:
      "Female, confident and blunt. Straight to the point with a slightly sharp tone.",
    defaultTone: "strict",
  },

  // Farah – young, energetic, smiley female.
  // Voice choice: "nova" – brighter, higher-energy voice suited for playful,
  // upbeat replies.
  farah: {
    voiceId: "nova",
    styleDescription:
      "Female, young and energetic. Smiley, hyper, friendly tone.",
    defaultTone: "energetic",
  },

  // Fallback profile for any unknown character IDs
  default: {
    voiceId: DEFAULT_VOICE_ID,
    styleDescription: "Neutral, friendly assistant voice.",
  },
};

module.exports = { CHARACTER_VOICES };
