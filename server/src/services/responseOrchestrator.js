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
  const sentences = raw
    .split(/(?<=[.!؟?])\s+/)
    .filter(Boolean);
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
  const state = String(convoState?.currentState || 'NEUTRAL').toUpperCase();
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
 * We keep this strictly for self-harm / suicidal intent or wanting to
 * seriously harm someone else.
 *
 * Approximation: classifier severityLevel === "HIGH_RISK" OR the emotion
 * notes clearly mention self-harm / suicide / harming others.
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

/**
 * Lightly decorates the reply with 1–2 emojis based on primary emotion.
 * Avoids duplicating emojis or touching safety disclaimer lines.
 * @param {string} text
 * @param {{ primaryEmotion?:string }} emotion
 * @param {'ar'|'en'|'mixed'} language
 * @param {'CASUAL'|'VENTING'|'SUPPORT'|'HIGH_RISK'} severityLevel
 */
function decorateWithEmojis(text, emotion, language, severityLevel) {
  const raw = String(text || '');
  if (!raw) return raw;

  // Skip if emojis already present to avoid spam
  try {
    const emojiRe = /[\u{1F300}-\u{1FAFF}]/u;
    if (emojiRe.test(raw)) return raw;
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

  if (!suffix) return raw;

  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Avoid decorating disclaimer/footer lines
    if (hasAnySafetyDisclaimer(line)) continue;
    lines[i] = line + suffix;
    return lines.join('\n');
  }

  // Fallback: append at very end
  return raw + suffix;
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
      'حلو إن في لمحة أمل، نقدر نبني عليها بخطوات صغيرة.',
      "I love that there is some hope here; we can build on it with small steps."
    );
  }

  return text;
}

/**
 * Applies tone softening, cultural adaptation, empathy, safety guardrails, and state-machine guidance.
 * The rewrite is gentle (not drastic) and avoids clinical framing.
 * @param {Object} params
 * @param {string} params.rawReply
 * @param {string} params.persona
 * @param {{ primaryEmotion:string, intensity:number, confidence:number, cultureTag:string }} params.emotion
 * @param {{ currentState?:string }} params.convoState
 * @param {{ summaryText?:string }|null} params.longTermSnapshot
 * @param {Array<{topic:string, emotion:string, score:number}>} params.triggers
 * @param {'ar'|'en'|'mixed'} params.language
 * @param {'CASUAL'|'VENTING'|'SUPPORT'|'HIGH_RISK'} params.severityLevel
 * @param {{ style?: {warmth?:string, humor?:string, directness?:string, energy?:string} }} params.personaCfg
 * @param {'CORE_FAST'|'CORE_DEEP'|'PREMIUM_DEEP'=} params.engineMode
 * @param {boolean=} params.isPremiumUser
 * @param {{ trustScore?:number, trustLevel?:number }=} params.trustSnapshot
 * @returns {Promise<string>}
 */
async function orchestrateResponse({ rawReply, persona, emotion, convoState, longTermSnapshot, triggers, language, severityLevel, personaCfg, engineMode, isPremiumUser, trustSnapshot }) {
  try {
    if (!rawReply || typeof rawReply !== 'string') return '';
    const isAr = language === 'ar';
    const { tier: trustTier } = computeTrustTier(trustSnapshot);

    let out = rawReply.trim();

    // Tone softening (trust-aware)
    out = isAr ? softenArabic(out, trustTier) : softenEnglish(out, trustTier);

    // Trigger sensitivity
    out = avoidTriggerReintensification(out, triggers);

    // State-specific adjustments
    out = applyStateAdjustments(out, convoState, language);

    // Choose opener style from tone profile
    let tone = getToneProfile({ severityLevel, convoState, personaCfg });
    if (String(severityLevel || '').toUpperCase() !== 'HIGH_RISK') {
      if (trustTier >= 3 && tone.empathyLevel === 'low') {
        tone = { ...tone, empathyLevel: 'medium' };
      }
      if (trustTier >= 4 && tone.messageLength === 'short') {
        tone = { ...tone, messageLength: 'normal' };
      } else if (trustTier >= 5 && tone.messageLength === 'normal') {
        tone = { ...tone, messageLength: 'extended' };
      }
    }
    const trimmed = String(out).trim();
    if (tone.empathyLevel === 'high') {
      out = addEmpathy(out, language);
    } else if (tone.empathyLevel === 'medium') {
      const lightOpener = isAr ? 'شكراً إنك شاركتني. أنا هنا معك. ' : "Thanks for sharing that with me. I'm here with you. ";
      if (!trimmed.startsWith('شكراً إنك شاركتني') && !trimmed.startsWith("Thanks for sharing")) {
        out = lightOpener + out;
      }
    } else {
      // For low-empathy/casual states, avoid a single fixed opener to reduce
      // repetitive greetings like "Hey, it's good to hear from you." and let
      // the persona + system prompt drive natural variety instead.
      // As a light touch, only soften very abrupt starts.
      const genericStartRe = isAr
        ? /^(طيب|شوف|اسمع)\b/
        : /^(So\b|Look\b|Listen\b)/i;
      if (genericStartRe.test(trimmed)) {
        const alt = isAr
          ? 'خلّينا نحكي بهدوء وبساطة. '
          : "Let's talk through this calmly and simply. ";
        out = alt + trimmed;
      }
    }

    // Persona Modulation V3 — emotion-aware tone tweak
    out = modulateByPrimaryEmotion(out, emotion, language);

    const premiumUser = !!isPremiumUser;

    // Free-lite shaping: for non-premium users in CORE_FAST, keep the reply
    // short, simple, and without heavy list structures, before adding safety
    // footers. Arabic content is preserved; we only trim length/structure.
    if (!premiumUser && engineMode === 'CORE_FAST') {
      const flattenedLines = String(out)
        .split(/\n+/)
        .map((line) => {
          const trimmedLine = String(line || '').trim();
          if (!trimmedLine) return '';
          // Remove simple bullet/number prefixes to avoid long lists.
          return trimmedLine
            .replace(/^[-*•]\s+/, '')
            .replace(/^\d+\.\s+/, '');
        })
        .filter(Boolean);

      const flattenedText = flattenedLines.join(' ');
      const sentences = flattenedText
        .split(/(?<=[.!؟?])\s+/)
        .filter(Boolean);

      const maxSentences = 4; // ~1–2 short paragraphs
      const kept = sentences.slice(0, maxSentences).join(' ');
      if (kept) {
        out = kept;
      }
    }

    // Strip any model-generated disclaimers before appending our own.
    out = stripModelGeneratedDisclaimers(out);

    // Conditionally append safety footer, but never duplicate it.
    const fullFooter = isAr
      ? 'تذكّر: كلامي دعم ومساندة وليس تشخيص طبي. لو ظهرت أفكار إيذاء للنفس، تواصل مع مختص أو شخص تثق به.'
      : 'Remember: this is supportive guidance, not medical advice. If self-harm thoughts appear, please reach out to a professional or someone you trust.';
    const mildFooter = isAr
      ? 'أنا هنا للدعم، لكن لا أستبدل الرعاية المتخصّصة. لو حسّيت أن الموضوع محتاج أكثر، تكلم مع شخص تثق به أو مختص.'
      : "I'm here to support you, but I can't replace professional care. For serious or urgent concerns, consider talking to a trusted person or a professional.";

    const safetyAlreadyPresent = hasAnySafetyDisclaimer(out);

    if (!safetyAlreadyPresent && shouldAppendSafetyFooter({ severityLevel, emotion, convoState })) {
      if (!out.includes(fullFooter)) out = out + '\n\n' + fullFooter;
    }

    // Final gentle polish: avoid overly long replies
    const lines = out.split(/\n+/).filter(Boolean);
    if (engineMode === 'CORE_FAST') {
      // Free-lite path is already sentence-trimmed; this keeps at most ~1–2 paragraphs.
      if (lines.length > 6) {
        out = lines.slice(0, 6).join('\n');
      }
    } else if (engineMode === 'CORE_DEEP') {
      let maxLines = 9;
      if (tone.messageLength === 'short') {
        maxLines = 7;
      } else if (tone.messageLength === 'extended' && trustTier >= 4) {
        maxLines = 11;
      }
      if (lines.length > maxLines) {
        out = lines.slice(0, maxLines).join('\n');
      }
    } else if (engineMode === 'PREMIUM_DEEP') {
      const intensity = Number(emotion?.intensity || 0);
      let maxLines = 10; // default medium
      if (intensity >= 5) {
        maxLines = 14; // full structured guidance
      } else if (intensity >= 3) {
        maxLines = 10; // 8–10 lines typical
      } else if (intensity > 0) {
        maxLines = 8; // gentler for low intensity
      }
      if (tone.messageLength === 'extended' && trustTier >= 4) {
        maxLines += 2;
      } else if (tone.messageLength === 'short') {
        maxLines = Math.max(6, maxLines - 2);
      }
      if (lines.length > maxLines) {
        out = lines.slice(0, maxLines).join('\n');
      }
    } else if (convoState?.currentState === 'SAD_SUPPORT' && lines.length > 5) {
      out = lines.slice(0, 5).join('\n');
    }

    // Final pass: add a small emoji decoration based on emotional tone.
    out = decorateWithEmojis(out, emotion, language, severityLevel);

    return out;
  } catch (e) {
    // Fail softly
    return rawReply;
  }
}

module.exports = { orchestrateResponse };
