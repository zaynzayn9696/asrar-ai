// server/src/services/responseOrchestrator.js
// Phase 3 — Emotionally Adaptive Response Orchestrator
// Transforms raw AI replies to be warmer, culturally aware, safe, and aligned
// with the conversation state machine. Non-blocking, heuristic, and lightweight.

/**
 * Softens directive language in English.
 * At higher trust tiers we allow slightly more direct language.
 * @param {string} text
 * @param {number=} trustTier
 */
function softenEnglish(text, trustTier) {
  const tier = Number(trustTier || 1);
  // At strong trust (4–5), keep the model's directness.
  if (tier >= 4) {
    return text;
  }
  return text
    .replace(/\byou must\b/gi, 'you might')
    .replace(/\byou should\b/gi, 'you could consider')
    .replace(/\byou need to\b/gi, 'it may help to')
    .replace(/\bjust do\b/gi, 'you could try');
}

/**
 * Softens directive language in Arabic (simple heuristics).
 * At higher trust tiers we keep more direct suggestions.
 * @param {string} text
 * @param {number=} trustTier
 */
function softenArabic(text, trustTier) {
  const tier = Number(trustTier || 1);
  if (tier >= 4) {
    return text;
  }
  return text
    .replace(/\bلازم\b/g, 'يمكن')
    .replace(/\bيجب\b/g, 'ممكن')
    .replace(/\bلا تفعل\b/g, 'حاول تتجنب')
    .replace(/\bافعل\b/g, 'ممكن تحاول');
}

// Safety disclaimer helpers: detect and strip model-generated disclaimers so we
// can append a single canonical footer. Covers English + Arabic patterns.
const EN_DISCLAIMER_PATTERNS = [
  /\bnot\s+(?:a\s+)?(?:doctor|therapist|psychologist|psychiatrist|counselor|professional)\b/i,
  /\bI['’]m\s+not\s+(?:a\s+)?(?:doctor|therapist|psychologist|psychiatrist|counselor|professional)\b/i,
  /\bnot\s+(?:medical|professional)\s+advice\b/i,
  /\bI\s+can(?:not|'t)\s+give\s+(?:you\s+)?(?:a\s+)?diagnosis\b/i,
  /\bfor\s+serious\s+or\s+urgent\s+concerns\b/i,
  /\bif\s+(?:you|u)\s+have\s+thoughts?\s+of\s+(?:self[-\s]?harm|suicide|ending\s+your\s+life)\b/i,
  /\breach\s+out\s+to\s+(?:a\s+)?(?:professional|therapist|doctor|someone\s+you\s+trust)\b/i,
  /supportive\s+guidance,\s+not\s+medical\s+advice/i,
  /I'm\s+here\s+to\s+support\s+you,\s+but\s+I\s+can't\s+replace\s+professional\s+care/i,
];

const AR_DISCLAIMER_PATTERNS = [
  /ليس(?:ت)?\s+(?:نصيحة|استشارة)\s+(?:طبية|طبي)/i,
  /ليس\s+تشخيصاً?\s+طبي/i,
  /لست(?:ُ)?\s+(?:طبيباً|طبيب|معالج(?:اً)?(?:\s+نفسي)?)/i,
  /أفكار\s+(?:إيذاء\s+النفس|إيذاءٍ?\s+للنفس|انتحار|انتحارية)/i,
  /تواص(?:ل|لي)\s+مع\s+(?:مختص|أخصائي|شخص\s+تثق\s+به)/i,
  /أنا\s+هنا\s+للدعم،\s+لكن\s+لا\s+أستبدل\s+الرعاية\s+المتخصّصة/i,
  /كلامي\s+دعم\s+ومساندة\s+وليس\s+تشخيص\s+طبي/i,
];

function hasAnySafetyDisclaimer(text) {
  const str = String(text || '');
  if (!str) return false;
  const lower = str.toLowerCase();
  for (const re of EN_DISCLAIMER_PATTERNS) {
    if (re.test(lower)) return true;
  }
  for (const re of AR_DISCLAIMER_PATTERNS) {
    if (re.test(str)) return true;
  }
  return false;
}

function stripModelGeneratedDisclaimers(text) {
  const raw = String(text || '');
  if (!raw) return raw;
  const sentences = raw.split(/(?<=[.!؟?])\s+/).filter(Boolean);
  const kept = sentences.filter((s) => {
    const lower = s.toLowerCase();
    if (EN_DISCLAIMER_PATTERNS.some((re) => re.test(lower))) return false;
    if (AR_DISCLAIMER_PATTERNS.some((re) => re.test(s))) return false;
    return true;
  });
  const joined = kept.join(' ').trim();
  return joined || raw;
}

function computeTrustTier(trustSnapshot) {
  if (!trustSnapshot) {
    return { tier: 1, score: 0 };
  }
  const score = Number(trustSnapshot.trustScore || 0);
  if (!Number.isFinite(score) || score <= 0) {
    return { tier: 1, score: 0 };
  }
  let tier = 1;
  if (score >= 80) tier = 5;
  else if (score >= 60) tier = 4;
  else if (score >= 40) tier = 3;
  else if (score >= 20) tier = 2;
  return { tier, score };
}

/**
 * Decide tone profile from severity + conversation state + persona style.
 * @param {Object} params
 * @param {'CASUAL'|'VENTING'|'SUPPORT'|'HIGH_RISK'} params.severityLevel
 * @param {{ currentState?: string }|null} params.convoState
 * @param {{ style?: { warmth?:string, humor?:string, directness?:string, energy?:string } }=} params.personaCfg
 * @returns {{ empathyLevel: 'low'|'medium'|'high', messageLength: 'short'|'normal'|'extended', includeSoftDisclaimer: boolean, includeFullSafetyFooter: boolean, allowLightHumor: boolean }}
 */
function getToneProfile({ severityLevel, convoState, personaCfg }) {
  const sev = String(severityLevel || 'CASUAL').toUpperCase();
  const style = personaCfg?.style || {};
  const allowLightHumor = (style.humor === 'high' || style.humor === 'medium') && (sev === 'CASUAL');

  if (sev === 'HIGH_RISK') {
    return { empathyLevel: 'high', messageLength: 'normal', includeSoftDisclaimer: false, includeFullSafetyFooter: true, allowLightHumor: false };
  }
  if (sev === 'SUPPORT') {
    return { empathyLevel: 'high', messageLength: 'normal', includeSoftDisclaimer: true, includeFullSafetyFooter: false, allowLightHumor };
  }
  if (sev === 'VENTING') {
    return { empathyLevel: 'medium', messageLength: 'normal', includeSoftDisclaimer: true, includeFullSafetyFooter: false, allowLightHumor };
  }
  // CASUAL
  return { empathyLevel: 'low', messageLength: 'short', includeSoftDisclaimer: false, includeFullSafetyFooter: false, allowLightHumor };
}

/**
 * Adds a gentle empathetic opener without appending the heavy safety footer.
 * Footer will be conditionally appended elsewhere based on emotion/state.
 * @param {string} text
 * @param {'ar'|'en'|'mixed'} language
 */
function addEmpathy(text, language) {
  const isAr = language === 'ar';
  const opener = isAr
    ? 'أنا معك، وفاهم شعورك. '
    : "I hear you. It's understandable to feel this way. ";

  const trimmed = String(text || '').trim();
  const hasOpener = trimmed.startsWith('أنا معك') || trimmed.startsWith('I hear you');
  return hasOpener ? text : (opener + text);
}

/**
 * Decide if a *crisis-level* safety footer should be appended.
 * Keep this strictly for self-harm / suicidal intent or wanting to seriously harm others.
 * @param {{ severityLevel?:string, emotion?:{ notes?:string }, convoState?:{ currentState?:string, state?:string } }} meta
 */
function shouldAppendSafetyFooter(meta) {
  const sev = String(meta?.severityLevel || '').toUpperCase();
  if (sev === 'HIGH_RISK') return true;

  const notes = String(meta?.emotion?.notes || '').toLowerCase();
  if (!notes) return false;

  const selfHarmRe = /(?:self[-\s]?harm|kill myself|suicide|suicidal|end my life|إيذاء\s+النفس|انتحار|قتل\s+نفسي)/i;
  const harmOthersRe = /(?:harm(?:ing)?\s+(?:someone|others)|kill\s+(?:someone|them)|إيذاء\s+(?:الآخرين|شخص)|قتل\s+(?:شخص|أحد|الناس))/i;

  return selfHarmRe.test(notes) || harmOthersRe.test(notes);
}

/**
 * Minimal trigger-aware rewrite: avoid repeating sensitive keywords directly.
 * @param {string} text
 * @param {Array<{topic:string, emotion:string, score:number}>} triggers
 */
function avoidTriggerReintensification(text, triggers) {
  if (!Array.isArray(triggers) || triggers.length === 0) return text;
  let out = text;
  for (const t of triggers.slice(0, 3)) {
    const token = String(t.topic || '').trim();
    if (!token) continue;
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    out = out.replace(re, 'this area');
  }
  return out;
}

/**
 * Enforces state-specific adjustments.
 * @param {string} text
 * @param {{ currentState?: string }} convoState
 * @param {'ar'|'en'|'mixed'} language
 */
function applyStateAdjustments(text, convoState, language) {
  const state = String(convoState?.currentState || 'NEUTRAL').toUpperCase();
  const isAr = language === 'ar';

  // Sentence trimming helper
  const splitSentences = (t) => t.split(/(?<=[.!؟?])\s+/).filter(Boolean);
  const joinSentences = (arr, n) => arr.slice(0, n).join(' ');

  if (state === 'SAD_SUPPORT') {
    const s = splitSentences(text);
    return joinSentences(s, Math.min(3, s.length));
  }
  if (state === 'ANXIETY_CALMING') {
    const slow = isAr
      ? 'خلّينا نبطّئ شوي ونأخذ نفساً هادئاً. '
      : "Let's slow down for a moment and take a gentle breath. ";
    return slow + text;
  }
  if (state === 'ANGER_DEESCALATE') {
    const calm = isAr
      ? 'خلّينا نهدّي الإيقاع ونركّز على تهدئة التوتر. '
      : 'Let’s bring the pace down and focus on easing the tension. ';
    return calm + text;
  }
  if (state === 'LONELY_COMPANIONSHIP') {
    const warm = isAr
      ? 'أنت لست وحدك وأنا هنا معك. '
      : "You're not alone and I'm here with you. ";
    return warm + text;
  }
  if (state === 'HOPE_GUIDANCE') {
    const gentle = isAr
      ? 'خلّينا نستثمر هذا الأمل بخطوة صغيرة نافعة. '
      : "Let's lean into that hope with one small helpful step. ";
    return gentle + text;
  }
  return text;
}

function splitSentencesArAware(text) {
  return String(text || '')
    .split(/(?<=[.!؟?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeSentenceForDedupe(sentence) {
  const withoutEmojis = sentence.replace(/[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '');
  return withoutEmojis
    .replace(/[.!؟?]+/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function dedupeSentences(sentences) {
  const seen = new Set();
  const out = [];
  for (const s of sentences) {
    const normalized = normalizeSentenceForDedupe(s);
    if (!normalized) continue;
    let duplicate = false;
    for (const existing of seen) {
      if (normalized === existing || normalized.includes(existing) || existing.includes(normalized)) {
        duplicate = true;
        break;
      }
    }
    if (!duplicate) {
      seen.add(normalized);
      out.push(s.trim());
    }
  }
  return out;
}

function clampEmojis(text, maxEmojis) {
  if (!maxEmojis || maxEmojis <= 0) return String(text || '').replace(/[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '');
  const chars = Array.from(String(text || ''));
  let count = 0;
  return chars
    .map((ch) => {
      const isEmoji = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u.test(ch);
      if (!isEmoji) return ch;
      if (count < maxEmojis) {
        count += 1;
        return ch;
      }
      return '';
    })
    .join('');
}

/**
 * Lightly decorates the reply with 1–2 emojis based on primary emotion.
 * Avoids duplicating emojis or touching safety disclaimer lines.
 * @param {string} text
 * @param {{ primaryEmotion?:string }} emotion
 * @param {'ar'|'en'|'mixed'} language
 * @param {'CASUAL'|'VENTING'|'SUPPORT'|'HIGH_RISK'} severityLevel
 * @param {boolean=} shortMode
 */
function decorateWithEmojis(text, emotion, language, severityLevel, shortMode) {
  const raw = String(text || '');
  if (!raw) return raw;

  // In short mode, only allow up to 2 existing emojis, no new ones.
  if (shortMode) {
    return clampEmojis(raw, 2);
  }

  // Skip if emojis already present to avoid spam
  try {
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u;
    if (emojiRe.test(raw)) return clampEmojis(raw, 3);
  } catch (_) {
    // Environments without Unicode property support: fall through
  }

  const primary = String(emotion?.primaryEmotion || '').toUpperCase();
  let suffix = '';

  switch (primary) {
    case 'SAD':
      suffix = ' 😔💙';
      break;
    case 'ANXIOUS':
    case 'STRESSED':
      suffix = ' 😟✨';
      break;
    case 'ANGRY':
      suffix = ' 😡🔥';
      break;
    case 'LONELY':
      suffix = ' 🫂';
      break;
    case 'HOPEFUL':
    case 'GRATEFUL':
      suffix = ' ✨❤️';
      break;
    default:
      suffix = ' 🙂';
  }

  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Avoid decorating disclaimer/footer lines
    if (hasAnySafetyDisclaimer(line)) continue;
    lines[i] = line + suffix;
    return clampEmojis(lines.join('\n'), 3);
  }
  return clampEmojis(raw + suffix, 3);
}

/**
 * Persona Modulation V3 — gently modulate tone based on dominant primary emotion
 * without changing persona identity. Only adjusts wrappers/phrasing.
 */
function modulateByPrimaryEmotion(text, emotion, language) {
  const primary = String(emotion?.primaryEmotion || '').toUpperCase();
  const isAr = language === 'ar';
  const trimmed = String(text || '').trim();

  if (!trimmed) return text;

  // Helper: prepend once if not already present.
  const prependOnce = (prefixAr, prefixEn) => {
    const prefix = isAr ? prefixAr : prefixEn;
    if (!prefix) return text;
    if (trimmed.startsWith(prefix)) return text;
    return prefix + ' ' + trimmed;
  };

  if (primary === 'SAD') {
    return prependOnce(
      'أحس إنك متعب عاطفياً، خلّينا نمشي خطوة خطوة.',
      "It sounds like you're carrying a lot; let's take it one gentle step at a time."
    );
  }

  if (primary === 'ANXIOUS') {
    return prependOnce(
      'خلّينا نبطّئ الإيقاع ونهدّي التوتر شوي.',
      "Let's slow things down together so it feels a bit less overwhelming."
    );
  }

  if (primary === 'ANGRY') {
    return prependOnce(
      'واضح إن في غضب أو انزعاج، وخلّينا نحاول نفهمه بهدوء بدون حكم.',
      "I can feel the frustration; we can unpack it calmly here without judgment."
    );
  }

  if (primary === 'LONELY') {
    return prependOnce(
      'أعرف إن الشعور بالوحدة صعب، وأنا هنا معك الآن.',
      "Feeling lonely is heavy; I'm here with you while we talk through it."
    );
  }

  if (primary === 'HOPEFUL') {
    return prependOnce(
      'حلو! خلّينا نثبت هالإحساس بخطوة صغيرة.',
      "Nice — let's lock that feeling in with one small step."
    );
  }

  return text;
}

function hasQuestionMark(text) {
  return /[?؟]/.test(String(text || ''));
}

function limitSentences(text, maxSentences) {
  const sentences = splitSentencesArAware(text);
  return sentences.slice(0, maxSentences).join(' ').trim() || String(text || '').trim();
}

function clampText(text, maxSentences, maxChars) {
  let out = limitSentences(text, maxSentences);
  out = String(out || '').trim();
  if (maxChars && out.length > maxChars) out = out.slice(0, maxChars).trim();
  return out;
}

/**
 * Applies tone softening, cultural adaptation, empathy, safety guardrails, and state-machine guidance.
 * The rewrite is gentle (not drastic) and avoids clinical framing.
 */
async function orchestrateResponse({
  rawReply,
  persona,
  emotion,
  convoState,
  longTermSnapshot,
  triggers,
  language,
  severityLevel,
  personaCfg,
  engineMode,
  isPremiumUser,
  trustSnapshot,
  verbosityMode = 'normal',
}) {
  try {
    if (!rawReply || typeof rawReply !== 'string') return '';
    const isAr = language === 'ar';
    const sev = String(severityLevel || 'CASUAL').toUpperCase();
    const { tier: trustTier } = computeTrustTier(trustSnapshot);

    let out = rawReply.trim();

    // Tone softening (trust-aware)
    out = isAr ? softenArabic(out, trustTier) : softenEnglish(out, trustTier);

    // Trigger sensitivity
    out = avoidTriggerReintensification(out, triggers);

    // State-specific adjustments
    out = applyStateAdjustments(out, convoState, language);

    // Decide tone profile
    let tone = getToneProfile({ severityLevel, convoState, personaCfg });
    if (sev !== 'HIGH_RISK') {
      if (trustTier >= 3 && tone.empathyLevel === 'low') tone = { ...tone, empathyLevel: 'medium' };
      if (trustTier >= 4 && tone.messageLength === 'short') tone = { ...tone, messageLength: 'normal' };
      else if (trustTier >= 5 && tone.messageLength === 'normal') tone = { ...tone, messageLength: 'extended' };
    }

    const shortMode = verbosityMode === 'short';
    const ultraShortCasual = shortMode && sev === 'CASUAL';

    // Empathy openers (DISABLED for ultra-short casual; keeps replies non-preachy)
    const trimmed = String(out).trim();
    if (!ultraShortCasual) {
      if (tone.empathyLevel === 'high') {
        out = addEmpathy(out, language);
      } else if (tone.empathyLevel === 'medium') {
        const lightOpener = isAr ? 'شكراً إنك شاركتني. أنا هنا معك. ' : "Thanks for sharing that with me. I'm here with you. ";
        if (!trimmed.startsWith('شكراً إنك شاركتني') && !trimmed.startsWith("Thanks for sharing")) {
          out = lightOpener + out;
        }
      }
    }

    // Persona Modulation V3 (DISABLED for ultra-short casual to avoid sermon vibes)
    if (!ultraShortCasual) {
      out = modulateByPrimaryEmotion(out, emotion, language);
    }

    const premiumUser = !!isPremiumUser;

    // Free-lite shaping
    if (!premiumUser && engineMode === 'CORE_FAST') {
      const flattenedLines = String(out)
        .split(/\n+/)
        .map((line) => {
          const trimmedLine = String(line || '').trim();
          if (!trimmedLine) return '';
          return trimmedLine.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '');
        })
        .filter(Boolean);

      const flattenedText = flattenedLines.join(' ');
      const sentences = flattenedText.split(/(?<=[.!؟?])\s+/).filter(Boolean);

      const maxSentences = 4;
      const kept = sentences.slice(0, maxSentences).join(' ');
      if (kept) out = kept;
    }

    // Strip any model-generated disclaimers before appending our own.
    out = stripModelGeneratedDisclaimers(out);

    // Safety footer
    const fullFooter = isAr
      ? 'تذكّر: كلامي دعم ومساندة وليس تشخيص طبي. لو ظهرت أفكار إيذاء للنفس، تواصل مع مختص أو شخص تثق به.'
      : 'Remember: this is supportive guidance, not medical advice. If self-harm thoughts appear, please reach out to a professional or someone you trust.';

    const safetyAlreadyPresent = hasAnySafetyDisclaimer(out);
    if (!safetyAlreadyPresent && shouldAppendSafetyFooter({ severityLevel, emotion, convoState })) {
      if (!out.includes(fullFooter)) out = out + '\n\n' + fullFooter;
    }

    // Engine-mode line caps (keep existing behavior)
    const lines = out.split(/\n+/).filter(Boolean);

    if (engineMode === 'CORE_FAST') {
      if (lines.length > 6) out = lines.slice(0, 6).join('\n');
    } else if (engineMode === 'CORE_DEEP') {
      let maxLines = 9;
      if (tone.messageLength === 'short') maxLines = 7;
      else if (tone.messageLength === 'extended' && trustTier >= 4) maxLines = 11;
      if (lines.length > maxLines) out = lines.slice(0, maxLines).join('\n');
    } else if (engineMode === 'PREMIUM_DEEP') {
      const intensity = Number(emotion?.intensity || 0);
      let maxLines = 10;
      if (intensity >= 5) maxLines = 14;
      else if (intensity >= 3) maxLines = 10;
      else if (intensity > 0) maxLines = 8;

      if (tone.messageLength === 'extended' && trustTier >= 4) maxLines += 2;
      else if (tone.messageLength === 'short') maxLines = Math.max(6, maxLines - 2);

      if (lines.length > maxLines) out = lines.slice(0, maxLines).join('\n');
    } else if (convoState?.currentState === 'SAD_SUPPORT' && lines.length > 5) {
      out = lines.slice(0, 5).join('\n');
    }

    // Verbosity enforcement
    if (shortMode && sev !== 'HIGH_RISK') {
      const sentences = splitSentencesArAware(out);
      const deduped = dedupeSentences(sentences);
      let limited = deduped.slice(0, 2).join(' ').trim();
      if (limited.length > 220) limited = limited.slice(0, 220).trim();

      if (!hasQuestionMark(limited)) {
        limited = `${limited} ${isAr ? 'شو اللي خلاك تحس هيك؟' : 'What made you feel that?'}`.trim();
      }

      const finalSentences = dedupeSentences(splitSentencesArAware(limited)).slice(0, 2);
      let finalOut = finalSentences.join(' ').trim();
      if (finalOut.length > 220) finalOut = finalOut.slice(0, 220).trim();
      out = clampEmojis(finalOut, 2);
    }

    // Emojis: limit in short mode, light decoration otherwise
    out = decorateWithEmojis(out, emotion, language, severityLevel, shortMode);

    return out;
  } catch (e) {
    return rawReply;
  }
}

module.exports = { orchestrateResponse };
