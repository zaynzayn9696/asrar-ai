'use strict';

// server/src/services/emotionalEngine/modes/balancedEngine.js
// Default emotionally-aware engine using existing emotional pipeline results.

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Balanced engine: medium-depth reasoning using a richer system prompt
 * supplied by the emotional engine, but with moderate length constraints.
 *
 * @param {Object} params
 * @param {string} params.userMessage
 * @param {Array<{role:string, content:string}>} params.recentMessages
 * @param {string} params.systemPrompt
 * @param {string=} params.model         Explicit model override (e.g. gpt-4o-mini / gpt-4o)
 * @param {boolean=} params.isPremiumUser Whether the caller is premium/tester
 * @returns {Promise<{ role: 'assistant', text: string, model: string }>}
 */
async function runBalancedEngine({ userMessage, recentMessages, systemPrompt, model, isPremiumUser }) {
  const coreModel = process.env.OPENAI_CORE_MODEL || 'gpt-4o-mini';
  const premiumModel = process.env.OPENAI_PREMIUM_MODEL || 'gpt-4o';

  const routedModel =
    typeof model === 'string' && model.trim()
      ? model.trim()
      : isPremiumUser
        ? premiumModel
        : coreModel;

  const messages = [];
  messages.push({ role: 'system', content: systemPrompt });

  if (Array.isArray(recentMessages) && recentMessages.length) {
    const trimmed = recentMessages.slice(-10);
    for (const m of trimmed) {
      if (!m || typeof m.content !== 'string') continue;
      messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    }
  }

  messages.push({ role: 'user', content: String(userMessage || '').slice(0, 1000) });

  const completion = await openai.chat.completions.create({
    model: routedModel,
    temperature: 0.8,
    max_tokens: 320,
    messages,
  });

  const text = completion.choices?.[0]?.message?.content?.trim() || '';

  return {
    role: 'assistant',
    text: text || '',
    model: routedModel,
  };
}

module.exports = runBalancedEngine;
