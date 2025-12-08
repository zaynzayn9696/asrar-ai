// server/src/services/responseOrchestrator.js
// Phase 3 — Emotionally Adaptive Response Orchestrator
// Transforms raw AI replies to be warmer, culturally aware, safe, and aligned
// with the conversation state machine. Non-blocking, heuristic, and lightweight.

/**
 * Softens directive language in English.
 * @param {string} text
 */
function softenEnglish(text) {
  return text
    .replace(/\byou must\b/gi, 'you might')
    .replace(/\byou should\b/gi, 'you could consider')
    .replace(/\byou need to\b/gi, 'it may help to')
    .replace(/\bjust do\b/gi, 'you could try');
}

/**
 * Softens directive language in Arabic (simple heuristics).
 * @param {string} text
 */
function softenArabic(text) {
  return text
    .replace(/\bلازم\b/g, 'يمكن')
    .replace(/\bيجب\b/g, 'ممكن')
    .replace(/\bلا تفعل\b/g, 'حاول تتجنب')
    .replace(/\bافعل\b/g, 'ممكن تحاول');
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
 * Decide if a safety footer should be appended. Once the conversation is in a
 * support/struggle state, append the footer on every assistant reply while in
 * that state. Do not append in NEUTRAL small talk.
 * @param {{ primaryEmotion?: string, intensity?: number }} emotion
 * @param {{ currentState?: string, state?: string }=} convoState
 */
function shouldAppendSafetyFooter(emotion, convoState) {
  const SUPPORT_STATES = [
    'SAD_SUPPORT',
    'ANXIETY_CALMING',
    'LONELY_COMPANIONSHIP',
    'ANGER_DEESCALATE',
  ];
  const state = String(convoState?.currentState || convoState?.state || '').toUpperCase();
  const label = String(emotion?.primaryEmotion || '').toUpperCase();
  const intense = Number(emotion?.intensity || 0) >= 3;
  const severeNegative = ['SAD', 'ANXIOUS', 'LONELY', 'ANGRY'].includes(label) && intense;
  return severeNegative && SUPPORT_STATES.includes(state);
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
 * @returns {Promise<string>}
 */
async function orchestrateResponse({ rawReply, persona, emotion, convoState, longTermSnapshot, triggers, language, severityLevel, personaCfg, engineMode, isPremiumUser }) {
  try {
    if (!rawReply || typeof rawReply !== 'string') return '';
    const isAr = language === 'ar';

    let out = rawReply.trim();

    // Tone softening
    out = isAr ? softenArabic(out) : softenEnglish(out);

    // Trigger sensitivity
    out = avoidTriggerReintensification(out, triggers);

    // State-specific adjustments
    out = applyStateAdjustments(out, convoState, language);

    // Choose opener style from tone profile
    const tone = getToneProfile({ severityLevel, convoState, personaCfg });
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

    // Conditionally append safety footer, but never duplicate it.
    const fullFooter = isAr
      ? 'تذكّر: كلامي دعم ومساندة وليس تشخيص طبي. لو ظهرت أفكار إيذاء للنفس، تواصل مع مختص أو شخص تثق به.'
      : 'Remember: this is supportive guidance, not medical advice. If self-harm thoughts appear, please reach out to a professional or someone you trust.';
    const mildFooter = isAr
      ? 'أنا هنا للدعم، لكن لا أستبدل الرعاية المتخصّصة. لو حسّيت أن الموضوع محتاج أكثر، تكلم مع شخص تثق به أو مختص.'
      : "I'm here to support you, but I can't replace professional care. For serious or urgent concerns, consider talking to a trusted person or a professional.";

    const lowerOut = String(out || '').toLowerCase();
    const safetyAlreadyPresent = (() => {
      if (!lowerOut) return false;
      // English
      if (lowerOut.includes('supportive guidance, not medical advice')) return true;
      if (lowerOut.includes("i'm here to support you, but i can't replace professional care")) return true;
      // Arabic
      if (lowerOut.includes('كلامي دعم ومساندة وليس تشخيص طبي')) return true;
      if (lowerOut.includes('أنا هنا للدعم، لكن لا أستبدل الرعاية المتخصّصة')) return true;
      return false;
    })();

    if (!safetyAlreadyPresent) {
      if (severityLevel === 'HIGH_RISK' || shouldAppendSafetyFooter(emotion, convoState)) {
        if (!out.includes(fullFooter)) out = out + '\n\n' + fullFooter;
      } else if (tone.includeSoftDisclaimer) {
        if (!out.includes(mildFooter)) out = out + '\n\n' + mildFooter;
      }
    }

    // Final gentle polish: avoid overly long replies
    const lines = out.split(/\n+/).filter(Boolean);
    if (engineMode === 'CORE_FAST') {
      // Free-lite path is already sentence-trimmed; this keeps at most ~1–2 paragraphs.
      if (lines.length > 6) {
        out = lines.slice(0, 6).join('\n');
      }
    } else if (engineMode === 'CORE_DEEP') {
      if (lines.length > 9) {
        out = lines.slice(0, 9).join('\n');
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
      if (lines.length > maxLines) {
        out = lines.slice(0, maxLines).join('\n');
      }
    } else if (convoState?.currentState === 'SAD_SUPPORT' && lines.length > 5) {
      out = lines.slice(0, 5).join('\n');
    }

    return out;
  } catch (e) {
    // Fail softly
    return rawReply;
  }
}

module.exports = { orchestrateResponse };
