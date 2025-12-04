// server/src/services/voiceService.js
// Final, corrected, Render-compatible version
// Includes dedicated OpenAI TTS client to avoid /v1/audio/speech 404 issues

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { CHARACTER_VOICES } = require('../config/characterVoices');

// ------------------------------
// 🎤 DEDICATED TTS CLIENT
// ------------------------------
// This ignores any OPENAI_BASE_URL used for chat
// because many proxies / Azure endpoints break /audio/speech.
// This forces voice replies to always hit official OpenAI.
// You can override if needed:
const openaiTTS = new OpenAI({
  apiKey: process.env.OPENAI_TTS_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_TTS_BASE_URL || 'https://api.openai.com/v1',
});

// ------------------------------
// 🔊 TRANSCRIBE AUDIO (STT)
// ------------------------------
async function transcribeAudio(input) {
  if (!process.env.OPENAI_API_KEY) return '';

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';

  let filePath = null;
  if (typeof input === 'string') filePath = input;
  else if (input && typeof input.path === 'string') filePath = input.path;

  if (!filePath) return '';

  try {
    const stream = fs.createReadStream(filePath);

    const resp = await openaiTTS.audio.transcriptions.create({
      model,
      file: stream,
    });

    return (resp.text || resp.data?.text || '').trim();
  } catch (err) {
    console.error("[voiceService] STT error:", err.message || err);
    return '';
  }
}

// ------------------------------
// 🔈 GENERATE VOICE REPLY (TTS)
// ------------------------------
async function generateVoiceReply(text, options = {}) {
  if (!process.env.OPENAI_API_KEY) return null;

  const safeText = String(text || '').trim();
  if (!safeText) return null;

  const { characterId, format } = options;

  const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-audio-preview';
  const outputFormat = format || process.env.OPENAI_TTS_FORMAT || 'mp3';

  const profile = CHARACTER_VOICES[characterId] || CHARACTER_VOICES.default;
  const voiceId = profile.voiceId || process.env.OPENAI_TTS_VOICE || 'alloy';

  try {
    // This is the endpoint that was failing before
    const response = await openaiTTS.audio.speech.create({
      model,
      voice: voiceId,
      input: safeText,
      format: outputFormat,
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    let mimeType = 'audio/mpeg';
    if (outputFormat === 'wav') mimeType = 'audio/wav';
    if (outputFormat === 'ogg') mimeType = 'audio/ogg';
    if (outputFormat === 'flac') mimeType = 'audio/flac';

    return { base64, buffer, mimeType, voiceId };
  } catch (err) {
    console.error('[voiceService] generateVoiceReply error', err.message || err);
    return null;
  }
}

module.exports = {
  transcribeAudio,
  generateVoiceReply,
};
