// server/src/services/voiceService.js
// Helper utilities for STT (transcription) and TTS (voice replies)
// used by the chat routes. This keeps the main route handler focused on
// usage limits and emotional engine orchestration.

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { CHARACTER_VOICES } = require('../config/characterVoices');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Transcribe an audio file using OpenAI Whisper.
 *
 * The input can be either:
 * - a string path to an audio file on disk, or
 * - an object with a `path` field (e.g. multer's `req.file`).
 *
 * Returns the transcribed text (trimmed). On error, returns an empty string.
 *
 * @param {string|{path:string}} input
 * @returns {Promise<string>}
 */
async function transcribeAudio(input) {
  if (!process.env.OPENAI_API_KEY) {
    return '';
  }

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';

  let filePath = null;
  if (typeof input === 'string') {
    filePath = input;
  } else if (input && typeof input.path === 'string') {
    filePath = input.path;
  }

  if (!filePath) {
    return '';
  }

  try {
    const stream = fs.createReadStream(filePath);
    const resp = await openai.audio.transcriptions.create({
      model,
      file: stream,
    });
    const text = (resp && (resp.text || resp.data?.text) || '').trim();
    return text;
  } catch (_) {
    return '';
  }
}

/**
 * Generate a voice reply for the given text using OpenAI TTS.
 *
 * Returns an object with:
 * - base64: base64-encoded audio
 * - buffer: Node Buffer containing the audio data
 * - mimeType: audio MIME type (e.g. audio/mpeg)
 * - voiceId: the OpenAI voice ID that was used
 *
 * On any error, returns null.
 *
 * @param {string} text
 * @param {{ characterId?: string, format?: string }} options
 * @returns {Promise<{ base64: string, buffer: Buffer, mimeType: string, voiceId: string }|null>}
 */
async function generateVoiceReply(text, options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const safeText = String(text || '').trim();
  if (!safeText) {
    return null;
  }

  const { characterId, format } = options;
  const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-audio-preview';
  const outputFormat = format || process.env.OPENAI_TTS_FORMAT || 'mp3';

  const profile = CHARACTER_VOICES[characterId] || CHARACTER_VOICES.default;
  const voiceId = profile.voiceId || process.env.OPENAI_TTS_VOICE || 'alloy';

  try {
    const response = await openai.audio.speech.create({
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
    else if (outputFormat === 'ogg') mimeType = 'audio/ogg';
    else if (outputFormat === 'flac') mimeType = 'audio/flac';

    return { base64, buffer, mimeType, voiceId };
  } catch (err) {
    console.error('[voiceService] generateVoiceReply error', err && err.message ? err.message : err);
    return null;
  }
}

module.exports = {
  transcribeAudio,
  generateVoiceReply,
};
