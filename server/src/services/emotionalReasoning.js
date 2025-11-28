// server/src/services/emotionalReasoning.js
// V6 emotional reasoning helpers: anchors, loops, triggers, reasons.

/**
 * Detect root emotional anchors from a single message.
 * Returns stable, lowercase tags like "family_pressure", "future_anxiety".
 */
function detectAnchorsFromMessage(messageText, primaryEmotion, intensity) {
  const text = String(messageText || '').toLowerCase();
  if (!text.trim()) return [];

  const anchors = new Set();
  const safeIntensity = Number.isFinite(Number(intensity)) ? Number(intensity) : 2;

  const strong = safeIntensity >= 3;

  if (/(family|my parents|my mom|my mother|my dad|home|parents)/.test(text)) {
    anchors.add('family_pressure');
  }

  if (/(compare|comparison|better than me|everyone else|others are|behind everyone)/.test(text)) {
    anchors.add('comparison');
  }

  if (/(future|next year|after graduation|career|job|i don\'t know what to do|what if)/.test(text)) {
    anchors.add('future_anxiety');
  }

  if (/(worthless|not enough|not good enough|failure|i hate myself|i\'m a failure)/.test(text)) {
    anchors.add('self_worth');
  }

  if (/(lonely|alone|no one understands|nobody cares|no friends)/.test(text)) {
    anchors.add('loneliness');
  }

  if (/(exam|exams|test|tests|study|studying|university|college|school|grades|gpa|assignment|homework)/.test(text)) {
    anchors.add('academic_fear');
  }

  // If emotion is clearly anxious or sad and intensity is high, bias toward future/self anchors.
  const emo = String(primaryEmotion || '').toUpperCase();
  if (strong && emo === 'ANXIOUS' && !anchors.has('future_anxiety') && /(worry|worried|anxious|panic|overthinking)/.test(text)) {
    anchors.add('future_anxiety');
  }
  if (strong && emo === 'SAD' && !anchors.has('self_worth') && /(useless|no value|don\'t matter)/.test(text)) {
    anchors.add('self_worth');
  }

  return Array.from(anchors);
}

/**
 * Detect whether the user is stuck in an overthinking loop.
 * Returns "OVERTHINKING_LOOP" or "NONE".
 */
function detectLoopTag(messageText, recentMessages) {
  const text = String(messageText || '').toLowerCase();
  const recent = Array.isArray(recentMessages) ? recentMessages : [];

  let evidence = 0;

  if (/(i keep thinking|keep thinking|can\'t stop|cant stop|overthinking|again and again|every night|all night|stuck in my head|my mind keeps|my mind attacks me)/.test(text)) {
    evidence += 2;
  }

  // Look for repeated wording in recent user turns.
  const lastUserContents = recent
    .filter((m) => m && m.role === 'user' && typeof m.content === 'string')
    .slice(-4)
    .map((m) => m.content.toLowerCase());

  const baseSlice = text.slice(0, 80);
  if (baseSlice.length >= 20) {
    for (const prev of lastUserContents) {
      if (prev.includes(baseSlice)) {
        evidence += 1;
        break;
      }
    }
  }

  return evidence > 0 ? 'OVERTHINKING_LOOP' : 'NONE';
}

/**
 * Detect per-message trigger tags for V6 EmotionalTriggerEvent.
 * Returns stable tags like "family_conflict", "academic_pressure".
 */
function detectTriggers(messageText, primaryEmotion, intensity) {
  const text = String(messageText || '').toLowerCase();
  if (!text.trim()) return [];

  const tags = new Set();
  const safeIntensity = Number.isFinite(Number(intensity)) ? Number(intensity) : 2;

  if (/(family|my parents|my mom|my mother|my dad|brother|sister|husband|wife|marriage|divorce|بيت اهلي|عيلتي|أسرتي)/.test(text)) {
    tags.add('family_conflict');
  }

  if (/(exam|exams|test|tests|quiz|quizzes|study|studying|university|college|school|grades|gpa|assignment|homework)/.test(text)) {
    tags.add('academic_pressure');
  }

  if (/(can\'t sleep|cant sleep|insomnia|no sleep|sleep deprived|awake all night|every night i|stay up)/.test(text)) {
    tags.add('sleep_loss');
  }

  if (/(relationship|girlfriend|boyfriend|partner|fiance|fiancé|break up|broke up|breakup|ex-?boyfriend|ex-?girlfriend)/.test(text)) {
    tags.add('relationship_stress');
  }

  if (/(lonely|alone|no one cares|nobody cares|no friends|by myself all the time)/.test(text)) {
    tags.add('loneliness');
  }

  if (/(future|next year|after graduation|career|job|what if|i\'m scared of tomorrow|i\'m afraid of the future)/.test(text)) {
    tags.add('future_fear');
  }

  // If intensity is low, keep the set smaller to avoid overfitting.
  if (safeIntensity <= 2 && tags.size > 2) {
    return Array.from(tags).slice(0, 2);
  }

  return Array.from(tags);
}

/**
 * Infer a simple reason label for the current emotion.
 * Example outputs: "family_pressure", "comparison_anxiety", "future_uncertainty".
 */
function deriveEmotionalReason(messageText, anchors, triggers, userProfile) {
  const anchorSet = new Set(Array.isArray(anchors) ? anchors : []);
  const triggerSet = new Set(Array.isArray(triggers) ? triggers : []);
  const text = String(messageText || '').toLowerCase();

  if (anchorSet.has('family_pressure') || triggerSet.has('family_conflict')) {
    return 'family_pressure';
  }

  if (anchorSet.has('academic_fear') || triggerSet.has('academic_pressure')) {
    return 'academic_fear';
  }

  if (anchorSet.has('future_anxiety') || triggerSet.has('future_fear')) {
    return 'future_uncertainty';
  }

  if (anchorSet.has('comparison')) {
    return 'comparison_anxiety';
  }

  if (anchorSet.has('self_worth')) {
    return 'self_worth';
  }

  if (anchorSet.has('loneliness') || triggerSet.has('loneliness')) {
    return 'loneliness';
  }

  // Light fallback based on long-term profile if available.
  const prof = userProfile || null;
  if (prof && prof.emotionStats) {
    const stats = prof.emotionStats;
    const sadness = stats.SAD?.avgIntensity || 0;
    const anxiety = stats.ANXIOUS?.avgIntensity || 0;
    const anger = stats.ANGRY?.avgIntensity || 0;
    const loneliness = stats.LONELY?.avgIntensity || 0;

    const pairs = [
      ['family_pressure', sadness],
      ['future_uncertainty', anxiety],
      ['loneliness', loneliness],
      ['self_worth', anger],
    ];
    let best = null;
    let bestScore = 0;
    for (const [label, score] of pairs) {
      if (score > bestScore) {
        bestScore = score;
        best = label;
      }
    }
    if (best && bestScore >= 0.3) return best;
  }

  if (/overthink|overthinking|spiral|loop/.test(text)) {
    return 'overthinking_pattern';
  }

  return null;
}

module.exports = {
  detectAnchorsFromMessage,
  detectLoopTag,
  detectTriggers,
  deriveEmotionalReason,
};
