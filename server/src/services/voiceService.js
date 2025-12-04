// server/src/services/voiceService.js
// Helper utilities for STT (transcription) and TTS (voice replies)

const OpenAI = require("openai");
const fs = require("fs");
const { CHARACTER_VOICES } = require("../config/characterVoices");

/**
 * IMPORTANT:
 * We create TWO OpenAI clients:
 *
 * 1) STT client → uses whatever OPENAI_API_KEY you already use
 * 2) TTS client → FORCED to use https://api.openai.com/v1
 *
 * This fixes the 404 "Invalid URL (POST /v1/audio/speech)" issue,
 * because your environment (Render) was overriding baseURL and
 * your TTS calls were accidentally hitting your own server instead of OpenAI.
 */

// ---------- STT CLIENT (Whisper) ----------
const openaiSTT = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // baseURL intentionally NOT overridden
});

// ---------- TTS CLIENT (FORCED REAL OPENAI ENDPOINT) ----------
const openaiTTS = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,             // same key, or override with OPENAI_TTS_API_KEY
  baseURL: "https://api.openai.com/v1",           // <- THIS FIXES THE 404 FOREVER
});

/**
 * TRANSCRIBE (Whisper)
 */
async function transcribeAudio(input) {
  if (!process.env.OPENAI_API_KEY) return "";

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

  let filePath = null;
  if (typeof input === "string") filePath = input;
  else if (input && typeof input.path === "string") filePath = input.path;

  if (!filePath) return "";

  try {
    const stream = fs.createReadStream(filePath);
    const resp = await openaiSTT.audio.transcriptions.create({
      model,
      file: stream,
    });

    const text =
      (resp && (resp.text || resp.data?.text) || "").trim();

    return text;
  } catch (err) {
    console.error("[voiceService] STT error:", err?.message || err);
    return "";
  }
}

/**
 * TTS (OpenAI Audio Speech)
 */
async function generateVoiceReply(text, options = {}) {
  if (!process.env.OPENAI_API_KEY) return null;

  const safeText = String(text || "").trim();
  if (!safeText) return null;

  const { characterId, format } = options;
  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-audio-preview";
  const outputFormat = format || process.env.OPENAI_TTS_FORMAT || "mp3";

  const profile = CHARACTER_VOICES[characterId] || CHARACTER_VOICES.default;
  const voiceId = profile.voiceId || process.env.OPENAI_TTS_VOICE || "alloy";

  try {
    // IMPORTANT: Use openaiTTS, not openaiSTT
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
      err?.response?.data || err?.message || err
    );
    return null;
  }
}

module.exports = {
  transcribeAudio,
  generateVoiceReply,
};
