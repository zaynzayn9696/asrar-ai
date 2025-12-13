'use strict';

// server/src/services/emotionalEngine/modes/liteEngine.js
// Ultra-fast, low-cost reply mode using a minimal system prompt and short output.
// Updated: Now includes memory facts for cross-persona consistency.

const OpenAI = require('openai');
const { detectArabicContamination, enforceEnglishOnly } = require('../../../utils/languageEnforcement');
const { getPersonaSnapshot, getIdentityMemory } = require('../../../pipeline/memory/memoryKernel');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Build a compact memory facts block for lite engine.
 * @param {Object} params
 * @param {number} params.userId
 * @param {boolean} params.isArabic
 * @returns {Promise<string>}
 */
async function buildLiteMemoryBlock({ userId, isArabic }) {
  if (!userId) return '';
  
  try {
    const [personaSnapshot, identityMemory] = await Promise.all([
      getPersonaSnapshot({ userId }).catch(() => null),
      getIdentityMemory({ userId }).catch(() => null),
    ]);
    
    const facts = personaSnapshot?.facts || {};
    const name = identityMemory?.name || facts?.identity?.name || null;
    const city = facts?.profile?.location?.city || null;
    const country = facts?.profile?.location?.country || null;
    const jobTitle = facts?.profile?.job?.title || null;
    const longTermGoal = facts?.goal?.long_term || facts?.profile?.goals?.longTerm || null;
    const drinkLike = facts?.preferences?.drinkLike?.[0] || null;
    const weatherDislike = facts?.preferences?.weatherDislike?.[0] || null;
    
    const hasAnyFact = name || city || country || jobTitle || longTermGoal || drinkLike || weatherDislike;
    if (!hasAnyFact) return '';
    
    const unknown = isArabic ? 'غير معروف' : 'unknown';
    const lines = [];
    
    if (isArabic) {
      lines.push('[KNOWN_USER_FACTS_START]');
      lines.push('حقائق محفوظة عن المستخدم (استخدمها عند سؤاله عما تتذكره):');
      lines.push(`- الاسم: ${name || unknown}`);
      if (city) lines.push(`- المدينة: ${city}`);
      if (country) lines.push(`- البلد: ${country}`);
      if (jobTitle) lines.push(`- العمل: ${jobTitle}`);
      if (longTermGoal) lines.push(`- الهدف: ${longTermGoal}`);
      if (drinkLike) lines.push(`- المشروب المفضل: ${drinkLike}`);
      if (weatherDislike) lines.push(`- الطقس المكروه: ${weatherDislike}`);
      lines.push('[KNOWN_USER_FACTS_END]');
      lines.push('عند سؤال "شو بتتذكر عني؟" أجب بنقاط من الحقائق أعلاه فقط.');
    } else {
      lines.push('[KNOWN_USER_FACTS_START]');
      lines.push('Known stored facts about the user (use when asked what you remember):');
      lines.push(`- name: ${name || unknown}`);
      if (city) lines.push(`- city: ${city}`);
      if (country) lines.push(`- country: ${country}`);
      if (jobTitle) lines.push(`- job: ${jobTitle}`);
      if (longTermGoal) lines.push(`- goal: ${longTermGoal}`);
      if (drinkLike) lines.push(`- favorite drink: ${drinkLike}`);
      if (weatherDislike) lines.push(`- dislikes weather: ${weatherDislike}`);
      lines.push('[KNOWN_USER_FACTS_END]');
      lines.push('When asked "What do you remember about me?" respond with bullet points from the facts above ONLY.');
    }
    
    return lines.join('\n');
  } catch (err) {
    console.error('[LiteEngine] buildLiteMemoryBlock error', err?.message || err);
    return '';
  }
}

/**
 * Lite engine: super fast, shallow reasoning, includes memory facts for consistency.
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
 * @param {number=} params.userId        User ID for memory lookup
 * @returns {Promise<{ role: 'assistant', text: string, model: string }>}
 */
async function runLiteEngine({ userMessage, recentMessages, personaText, language, dialect, model, isPremiumUser, userId }) {
  const coreModel = process.env.OPENAI_CORE_MODEL || 'gpt-4o-mini';
  const premiumModel = process.env.OPENAI_PREMIUM_MODEL || 'gpt-4o';

  const routedModel =
    typeof model === 'string' && model.trim()
      ? model.trim()
      : isPremiumUser
        ? premiumModel
        : coreModel;

  const isAr = language === 'ar';
  
  // Fetch memory facts for cross-persona consistency
  const memoryBlock = await buildLiteMemoryBlock({ userId, isArabic: isAr });
  
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
      'CRITICAL LANGUAGE RULE: Reply ONLY in pure English. Do NOT use any Arabic script, Arabic words, or transliterated Arabic (no "ya qalbi", "habibi", "wallah", "inshallah", "yalla", etc.). Keep the reply 100% English.',
      personaText
    );
  }
  
  // Add memory facts if available
  if (memoryBlock) {
    sysLines.push('');
    sysLines.push(memoryBlock);
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

  let text = completion.choices?.[0]?.message?.content?.trim() || '';

  // P4 Language Enforcement: Clean Arabic tokens from English replies
  if (!isAr && text) {
    const detection = detectArabicContamination(text);
    if (detection.contaminated) {
      console.log('[LanguageEnforcement][Lite] Arabic contamination detected:', detection.tokens.join(', '));
      text = enforceEnglishOnly(text);
    }
  }

  return {
    role: 'assistant',
    text: text || (isAr ? 'أنا معك، احكي لي أكثر لو حابب.' : "I'm here with you, tell me a bit more if you want."),
    model: routedModel,
  };
}

module.exports = runLiteEngine;
