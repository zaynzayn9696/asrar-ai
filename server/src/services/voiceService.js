// server/src/services/voiceService.js
const OpenAI = require("openai");
const fs = require("fs");
const { CHARACTER_VOICES } = require("../config/characterVoices");

/**
 * Dedicated TTS client (must always use api.openai.com!)
 * STT uses the normal SDK, but TTS must NOT use any baseURL override.
 */
const openaiTTS = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1"
});

/**
 * Default OpenAI client for Whisper (STT)
 */
const openaiSTT = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/** STT (transcription) */
async function transcribeAudio(input) {
  if (!process.env.OPENAI_API_KEY) return "";

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

  let filePath = null;
  if (typeof input === "string") filePath = input;
  else if (input && input.path) filePath = input.path;

  if (!filePath) return "";

  try {
    const stream = fs.createReadStream(filePath);

    const resp = await openaiSTT.audio.transcriptions.create({
      model,
      file: stream
    });

    return (resp.text || resp.data?.text || "").trim();
  } catch (_) {
    return "";
  }
}

/** TTS (voice output) */
async function generateVoiceReply(text, { characterId, format } = {}) {
  if (!process.env.OPENAI_API_KEY) return null;

  const safeText = String(text || "").trim();
  if (!safeText) return null;

  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-audio-preview";
  const outputFormat = format || "mp3";

  const profile = CHARACTER_VOICES[characterId] || CHARACTER_VOICES.default;
  const voiceId = profile.voiceId || "alloy";

  try {
    const response = await openaiTTS.audio.speech.create({
      model,
      voice: voiceId,
      input: safeText,
      format: outputFormat
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");

    let mimeType = "audio/mpeg";
    if (outputFormat === "wav") mimeType = "audio/wav";
    if (outputFormat === "ogg") mimeType = "audio/ogg";
    if (outputFormat === "flac") mimeType = "audio/flac";

    return { base64, buffer, mimeType, voiceId };
  } catch (err) {
    console.error("[voiceService] generateVoiceReply error", err.message || err);
    return null;
  }
}

module.exports = {
  transcribeAudio,
  generateVoiceReply
};
