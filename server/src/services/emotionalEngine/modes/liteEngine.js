'use strict';

// server/src/services/emotionalEngine/modes/liteEngine.js
// Ultra-fast, low-cost reply mode using a minimal system prompt and short output.

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Lite engine: super fast, shallow reasoning, no heavy long-term memory.
 * Keeps replies short (~30–35 tokens) and avoids extra orchestration.
 *
 * @param {Object} params
 * @param {string} params.userMessage
 * @param {Array<{role:string, content:string}>} params.recentMessages
 * @param {string} params.personaText
 * @param {('ar'|'en'|'mixed')} params.language
 * @param {string} params.dialect
 * @param {string=} params.model         Explicit model override (e.g. gpt-4o-mini / gpt-4o)
 * @param {boolean=} params.isPremiumUser Whether the caller is premium/tester
 * @returns {Promise<{ role: 'assistant', text: string, model: string }>}
 */
async function runLiteEngine({ userMessage, recentMessages, personaText, language, dialect, model, isPremiumUser }) {
  const coreModel = process.env.OPENAI_CORE_MODEL || 'gpt-4o-mini';
  const premiumModel = process.env.OPENAI_PREMIUM_MODEL || 'gpt-4o';

  const routedModel =
    typeof model === 'string' && model.trim()
      ? model.trim()
      : isPremiumUser
        ? premiumModel
        : coreModel;

  const isAr = language === 'ar';
  const sysLines = [];

  if (isAr) {
    sysLines.push(
      'أنت رفيق عاطفي خفيف داخل تطبيق "أسرار". ردودك قصيرة وواضحة جداً (جملة إلى ثلاث جمل).',
      'ركّز على طمأنة المستخدم بجملة بسيطة وسريعة بدون تحليل عميق أو تفاصيل طويلة.',
      'لا تستخدم أي قوائم أو تعداد، فقط نص بسيط متصل.',
      personaText
    );
  } else {
    sysLines.push(
      'You are a very fast, lightweight emotional support companion inside Asrar.',
      'Your replies must be very short (1–3 concise sentences) and easy to read.',
      'Avoid lists or long explanations; respond with a single compact paragraph.',
      personaText
    );
  }

  const systemPrompt = sysLines.join('\n');

  const messages = [];
  messages.push({ role: 'system', content: systemPrompt });

  if (Array.isArray(recentMessages) && recentMessages.length) {
    // Tiny context window to keep cost/latency low.
    const trimmed = recentMessages.slice(-3);
    for (const m of trimmed) {
      if (!m || typeof m.content !== 'string') continue;
      messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    }
  }

  messages.push({ role: 'user', content: String(userMessage || '').slice(0, 400) });

  const completion = await openai.chat.completions.create({
    model: routedModel,
    temperature: 0.6,
    max_tokens: 40,
    messages,
  });

  const text = completion.choices?.[0]?.message?.content?.trim() || '';

  return {
    role: 'assistant',
    text: text || (isAr ? 'أنا معك، احكي لي أكثر لو حابب.' : "I'm here with you, tell me a bit more if you want."),
    model: routedModel,
  };
}

module.exports = runLiteEngine;
