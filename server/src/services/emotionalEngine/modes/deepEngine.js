'use strict';

// server/src/services/emotionalEngine/modes/deepEngine.js
// Deep, premium-only mode with higher-quality model and longer, more
// emotionally layered replies.

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Deep engine: uses a premium model (gpt-4.1 / gpt-4o-mini-2024-12-17 / gpt-5.1)
 * with the full emotional system prompt and long-form empathetic responses.
 *
 * @param {Object} params
 * @param {string} params.userMessage
 * @param {Array<{role:string, content:string}>} params.recentMessages
 * @param {string} params.systemPrompt
 * @param {string} [params.model]
 * @returns {Promise<{ role: 'assistant', text: string, model: string }>}
 */
async function runDeepEngine({ userMessage, recentMessages, systemPrompt, model }) {
  const premiumModel =
    model || process.env.OPENAI_PREMIUM_MODEL || process.env.OPENAI_CORE_MODEL || 'gpt-4o';

  const messages = [];
  messages.push({ role: 'system', content: systemPrompt });

  if (Array.isArray(recentMessages) && recentMessages.length) {
    const trimmed = recentMessages.slice(-16);
    for (const m of trimmed) {
      if (!m || typeof m.content !== 'string') continue;
      messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    }
  }

  messages.push({ role: 'user', content: String(userMessage || '') });

  const completion = await openai.chat.completions.create({
    model: premiumModel,
    temperature: 0.9,
    max_tokens: 640,
    messages,
  });

  const text = completion.choices?.[0]?.message?.content?.trim() || '';

  return {
    role: 'assistant',
    text: text || '',
    model: premiumModel,
  };
}

module.exports = runDeepEngine;
