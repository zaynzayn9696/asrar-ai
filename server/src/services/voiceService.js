// server/src/services/voiceService.js
// Final, Render-friendly version with dedicated TTS client
// - Uses a separate OpenAI client for TTS + STT
// - Avoids /v1/audio/speech 404 issues caused by wrong base URLs

const OpenAI = require("openai");
const fs = require("fs");
const { CHARACTER_VOICES } = require("../config/characterVoices");

// ------------------------------------
// 🎤 Dedicated OpenAI client for audio
// ------------------------------------
// This client is ONLY for:
//   - STT: /audio/transcriptions
//   - TTS: /audio/speech
//
// It *ignores* any OPENAI_BASE_URL / OPENAI_TTS_BASE_URL that might be used
// elsewhere. We always talk directly to official OpenAI:
//   https://api.openai.com/v1
// using the primary OPENAI_API_KEY.

const openaiTTS = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});

// Small debug line so Render logs show exactly which base URL is used.
// This never prints any secrets.
console.log("[voiceService] Using TTS baseURL:", "https://api.openai.com/v1");

// ------------------------------------
// 🔊 TRANSCRIBE AUDIO (STT)
// ------------------------------------
/**
 * Transcribe an audio file using OpenAI Whisper.
 *
 * @param {string|{path:string}} input - path or multer file object
 * @returns {Promise<string>} - transcript text or '' on failure
 */
async function transcribeAudio(input) {
  // If we have no key at all, bail
  if (!process.env.OPENAI_API_KEY) {
    console.error("[voiceService] STT called but no OPENAI_API_KEY set");
    return "";
  }

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

  let filePath = null;
  if (typeof input === "string") {
    filePath = input;
  } else if (input && typeof input.path === "string") {
    filePath = input.path;
  }

  if (!filePath) {
    return "";
  }

  try {
    const stream = fs.createReadStream(filePath);

    const resp = await openaiTTS.audio.transcriptions.create({
      model,
      file: stream,
    });

    const text = (resp && (resp.text || resp.data?.text)) || "";
    return text.trim();
  } catch (err) {
    console.error("[voiceService] STT error:", err?.message || err);
    return "";
  }
}

// ------------------------------------
// 🔈 GENERATE VOICE REPLY (TTS)
// ------------------------------------
/**
 * Generate a voice reply with OpenAI TTS.
 *
 * @param {string} text
 * @param {{ characterId?: string, format?: string }} options
 * @returns {Promise<{ base64: string, buffer: Buffer, mimeType: string, voiceId: string }|null>}
 */
async function generateVoiceReply(text, options = {}) {
  // Same key check as STT
  if (!process.env.OPENAI_API_KEY) {
    console.error("[voiceService] TTS called but no OPENAI_API_KEY set");
    return null;
  }

  const safeText = String(text || "").trim();
  if (!safeText) {
    return null;
  }

  const { characterId, format } = options;

  // Model & format
  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-audio-preview";
  const outputFormat = format || process.env.OPENAI_TTS_FORMAT || "mp3";

  // Voice selection from CHARACTER_VOICES
  const profile = CHARACTER_VOICES[characterId] || CHARACTER_VOICES.default;
  const voiceId = profile.voiceId || process.env.OPENAI_TTS_VOICE || "alloy";

  try {
    const response = await openaiTTS.audio.speech.create({
      model,
      voice: voiceId,
      input: safeText,
      format: outputFormat,
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const base64 = buffer.toString("base64");

    let mimeType = "audio/mpeg";
    if (outputFormat === "wav") mimeType = "audio/wav";
    else if (outputFormat === "ogg") mimeType = "audio/ogg";
    else if (outputFormat === "flac") mimeType = "audio/flac";

    return { base64, buffer, mimeType, voiceId };
  } catch (err) {
    console.error(
      "[voiceService] generateVoiceReply error",
      err?.message || err
    );
    return null;
  }
}

module.exports = {
  transcribeAudio,
  generateVoiceReply,
};
