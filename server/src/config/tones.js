// server/src/config/tones.js
// Central definitions for emotional tones that affect both text style and TTS pacing.

const TONES = {
  calm: {
    label: "Calm & Supportive",
    description:
      "Speak slowly, gently, and reassuringly. Focus on emotional safety and comfort.",
    tts: {
      speed: 0.95,
    },
  },
  energetic: {
    label: "Energetic & Motivating",
    description:
      "Sound excited, positive, and motivating. Use uplifting language and dynamic pacing.",
    tts: {
      speed: 1.05,
    },
  },
  strict: {
    label: "Direct & Honest",
    description:
      "Speak in a direct, honest, no-nonsense way. Still respectful, but very straightforward.",
    tts: {
      speed: 1.0,
    },
  },
  soft: {
    label: "Soft & Empathetic",
    description:
      "Speak softly, with high empathy and emotional sensitivity. Be gentle and understanding.",
    tts: {
      speed: 0.9,
    },
  },
};

module.exports = { TONES };
