// server/src/pipeline/memory/longTerm.js
// Long-term emotional memory (per-user profile)

const prisma = require('../../prisma');
const { detectAnchorsFromMessage, deriveEmotionalReason } = require('../../services/emotionalReasoning');
const OpenAI = require('openai');

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Safely parse a JSON-like field from Prisma (which is already JS) into an object.
 */
function ensureObject(val) {
  if (!val || typeof val !== 'object') return {};
  return { ...val };
}

// Rule-based name detection fallback for clear first-person introductions
// in English and Arabic, used alongside the LLM detector.
function detectNameByPattern(messageText) {
  const text = String(messageText || '').trim();
  if (!text) return null;

  // English patterns: "my name is X", "call me X"
  const enMatch = text.match(/\b(my name is|call me)\s+([A-Za-z]{2,32})/i);
  if (enMatch && enMatch[2]) {
    const candidate = enMatch[2].replace(/[.,!?؟،]+$/gu, '').trim();
    if (candidate.length >= 2 && candidate.length <= 40) {
      return candidate;
    }
  }

  // Basic Arabic patterns: "انا اسمي X", "أنا اسمي X", "اسمي X", "سمّيني X"
  const arPatterns = [
    /(?:انا اسمي|أنا اسمي|اسمي)\s+([^\s،.!?]{2,32})/u,
    /(?:سمّيني|سميني)\s+([^\s،.!?]{2,32})/u,
  ];

  for (const re of arPatterns) {
    const m = re.exec(text);
    if (m && m[1]) {
      const candidate = String(m[1]).replace(/[.,!?؟،]+$/gu, '').trim();
      if (candidate.length >= 2 && candidate.length <= 40) {
        return candidate;
      }
    }
  }

  return null;
}

// LLM-powered name extraction from a single message text (English + Arabic).
// Returns a clean name string or null if no explicit new name is present.
async function detectNameUsingLLM(messageText) {
  const text = String(messageText || '').trim();
  if (!text || !openaiClient) {
    return null;
  }

  // Lightweight cue-based gating so we only call the LLM when the message
  // plausibly contains an explicit name change / "call me" instruction.
  // Includes both English and Arabic phrasing variants.
  const cueRegex = /(my name is|my new name is|from now on[, ]*call me|you can call me|i want you to call me|you should call me|people call me|name me|your new name is|call me|i am called|انا اسمي|أنا اسمي|اسمي الجديد|اسمي صار|اسمي يكون|اسمي|ناديني)/i;

  if (!cueRegex.test(text)) {
    return null;
  }

  // Very small heuristic language hint for the prompt only.
  const hasArabic = /[\u0600-\u06FF]/u.test(text);
  const languageHint = hasArabic ? 'ar' : 'en';

  console.log('[LongTermMemory] detectNameUsingLLM cue', {
    hasArabic,
    messageLength: text.length,
  });

  const systemPrompt = [
    'You are a precise name extractor for a mental wellbeing chat app.',
    'The user message is in Arabic or English.',
    'If the user explicitly says they changed their name or want to be called a specific name,',
    'return ONLY the new name. No punctuation. No extra words. No explanations.',
    'If you are not sure that a new name was provided, return an empty string.',
  ].join(' ');

  const userPrompt = [
    `Language hint: ${languageHint}.`,
    'User message:',
    text,
  ].join('\n');

  try {
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 16,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    let out = completion.choices?.[0]?.message?.content || '';
    out = String(out).trim();

    // Normalise trivial wrappers like quotes.
    out = out.replace(/^["'«»“”\s]+|["'«»“”\s]+$/gu, '').trim();
    if (!out) {
      console.log('[LongTermMemory] detectNameUsingLLM candidate_empty', {
        hasArabic,
      });
      return null;
    }

    // Heuristic extraction: keep only the last contiguous run of
    // Arabic/Latin letters (e.g. "your new name is Alex" -> "Alex").
    const nameMatches = out.match(/[A-Za-z\u0600-\u06FF]{2,40}/gu);
    let candidate = out;
    if (Array.isArray(nameMatches) && nameMatches.length) {
      candidate = nameMatches[nameMatches.length - 1];
    }
    candidate = String(candidate || '').trim();

    // Strip trailing punctuation around the candidate.
    candidate = candidate.replace(/[.,!?؟،]+$/gu, '').trim();

    if (!candidate) {
      console.log('[LongTermMemory] detectNameUsingLLM candidate_empty_after_extract', {
        hasArabic,
      });
      return null;
    }

    // Basic validation: length and presence of letters.
    if (candidate.length < 2 || candidate.length > 40) {
      console.log('[LongTermMemory] detectNameUsingLLM candidate_rejected_length', {
        hasArabic,
        candidateLength: candidate.length,
      });
      return null;
    }
    if (!/[A-Za-z\u0600-\u06FF]/u.test(candidate)) {
      console.log('[LongTermMemory] detectNameUsingLLM candidate_rejected_chars', {
        hasArabic,
      });
      return null;
    }

    // Guard against common non-name tokens that might slip through.
    const lower = candidate.toLowerCase();
    const banned = new Set([
      'رح',
      'من',
      'اليوم',
      'اسمي',
      'انا',
      'أنا',
      'name',
    ]);
    if (banned.has(lower)) {
      console.log('[LongTermMemory] detectNameUsingLLM candidate_rejected_banned', {
        hasArabic,
      });
      return null;
    }

    console.log('[LongTermMemory] detectNameUsingLLM candidate_accepted', {
      hasArabic,
      candidateLength: candidate.length,
    });

    return candidate;
  } catch (err) {
    console.error(
      '[LongTermMemory] detectNameUsingLLM error',
      err && err.message ? err.message : err
    );
    return null;
  }
}

// --- Persona / semantic profile helpers ---

// Very lightweight age detection for EN + AR messages.
// Returns a normalised age string like "24" or null.
function detectAgeFromText(messageText) {
  const text = String(messageText || '').trim();
  if (!text) return null;
  const enMatch = text.match(/\b(i am|i'm|im)\s+(\d{1,2})\s*(?:years? old|yo|yrs?)?\b/i);
  if (enMatch && enMatch[2]) {
    const n = parseInt(enMatch[2], 10);
    if (Number.isFinite(n) && n >= 10 && n <= 80) return String(n);
  }
  const arMatch = text.match(/(?:عمري|أنا عمري|انا عمري)\s+(\d{1,2})/i);
  if (arMatch && arMatch[1]) {
    const n = parseInt(arMatch[1], 10);
    if (Number.isFinite(n) && n >= 10 && n <= 80) return String(n);
  }
  return null;
}

// Small lexicons for location, language, role/domain and themes.
const COUNTRY_KEYWORDS = [
  { value: 'Jordan', tokens: ['jordan', 'jordanian', 'الأردن', 'الاردن', 'اردن', 'أردني', 'اردني'] },
  { value: 'Saudi Arabia', tokens: ['saudi', 'ksa', 'saudi arabia', 'السعودية', 'السعوديه', 'سعودي'] },
  { value: 'United Arab Emirates', tokens: ['uae', 'dubai', 'abu dhabi', 'الإمارات', 'الامارات', 'اماراتي'] },
  { value: 'Qatar', tokens: ['qatar', 'qatari', 'قطر', 'قطري'] },
  { value: 'Egypt', tokens: ['egypt', 'egyptian', 'مصر', 'مصري'] },
];

const CITY_KEYWORDS = [
  { value: 'Amman', tokens: ['amman', 'عمان'] },
  { value: 'Dubai', tokens: ['dubai', 'دبي'] },
  { value: 'Riyadh', tokens: ['riyadh', 'الرياض'] },
  { value: 'Jeddah', tokens: ['jeddah', 'جدة', 'جده'] },
  { value: 'Doha', tokens: ['doha', 'الدوحة', 'الدوحه'] },
  { value: 'Cairo', tokens: ['cairo', 'القاهرة', 'القاهره'] },
];

const ROLE_KEYWORDS = [
  { value: 'student', tokens: ['i am a student', "i'm a student", 'im a student', 'i am student', 'انا طالب', 'انا طالبة', 'طالب جامعي', 'طالبة جامعية'] },
  { value: 'high school student', tokens: ['high school', 'ثانوي', 'مدرسة ثانوية'] },
  { value: 'university student', tokens: ['university student', 'في الجامعة', 'في الجامعه'] },
  { value: 'software engineer', tokens: ['software engineer', 'software developer', 'مبرمج', 'مهندس برمجيات'] },
  { value: 'developer', tokens: ['developer', 'programmer'] },
];

const DOMAIN_KEYWORDS = [
  { value: 'computer science', tokens: ['computer science', 'cs ', 'cs.', 'cs student', 'علم الحاسوب', 'علوم الحاسوب'] },
  { value: 'information technology', tokens: ['information technology', ' it ', 'نظم معلومات', 'تقنية معلومات'] },
  { value: 'marketing', tokens: ['marketing', 'marketer', 'تسويق'] },
  { value: 'medicine', tokens: ['medicine', 'medical school', 'med school', 'طب', 'كلية الطب'] },
];

const LANGUAGE_PRIMARY_KEYWORDS = [
  { value: 'Arabic', tokens: ['my first language is arabic', 'native language is arabic', 'i speak arabic', 'احب احكي عربي', 'لغتي الام العربية', 'لغتي الأم العربية'] },
  { value: 'English', tokens: ['my first language is english', 'native language is english', 'i speak english', 'i prefer english'] },
];

const DIALECT_KEYWORDS = [
  { value: 'Jordanian Arabic', tokens: ['jordanian arabic', 'jordanian dialect', 'لهجة اردنية', 'لهجة أردنية'] },
  { value: 'Gulf Arabic', tokens: ['gulf arabic', 'khaleeji', 'خليجي', 'لهجة خليجية'] },
  { value: 'Egyptian Arabic', tokens: ['egyptian arabic', 'masri', 'مصري', 'لهجة مصرية'] },
  { value: 'Levantine Arabic', tokens: ['levantine arabic', 'shami', 'شامي', 'لهجة شامية'] },
];

const HEALTH_KEYWORDS = [
  { tokens: ['urticaria', 'cholinergic urticaria'], value: 'struggles with chronic urticaria' },
  { tokens: ['skin condition', 'hives', 'حساسية', 'طفح جلدي'], value: 'struggles with a skin condition that flares under stress or heat' },
  { tokens: ['allergy', 'allergic', 'مزمنة', 'chronic'], value: 'has ongoing health issues that cause stress' },
];

const ACADEMIC_KEYWORDS = [
  { tokens: ['exam', 'exams', 'midterms', 'finals', 'university', 'assignment', 'grades', 'homework', 'امتحان', 'امتحانات', 'جامعة', 'اختبار'], value: 'stressed about university or exam performance' },
];

const FAMILY_KEYWORDS = [
  { tokens: ['my parents', 'my family', 'my father', 'my mother', 'امي', 'أمي', 'ابوي', 'أبوي', 'اهلي', 'أهلي'], value: 'feels pressure or misunderstanding from family' },
];

const WORK_KEYWORDS = [
  { tokens: ['job', 'work', '9-5', '9 to 5', 'manager', 'boss', 'شركة', 'دوام', 'startup', 'ستارت اب', 'ستارت أب'], value: 'experiences stress related to work or career' },
];

const PERSONALITY_TOKENS = [
  { match: 'overthink', value: 'overthinks a lot' },
  { match: 'over-think', value: 'overthinks a lot' },
  { match: 'sensitive', value: 'sensitive' },
  { match: 'perfectionist', value: 'perfectionist' },
  { match: 'driven', value: 'driven' },
  { match: 'ambitious', value: 'ambitious' },
];

const COPING_TOKENS = [
  { tokens: ['go to the gym', 'hit the gym', 'gym', 'work out', 'workout', 'exercise', 'تمرين', 'نادي رياضي'], value: 'goes to the gym or exercises to cope' },
  { tokens: ['watch youtube', 'youtube', 'scroll youtube', 'scroll tiktok', 'tiktok', 'تيك توك'], value: 'escapes into online content like YouTube or TikTok to cope' },
  { tokens: ['play games', 'video games', 'gaming'], value: 'uses gaming as a way to cope' },
  { tokens: ['journal', 'journaling', 'أكتب يومياتي'], value: 'likes to journal when stressed' },
];

// Persona kinds that should be stored as a single primary value per userId+kind.
const PERSONA_SINGLETON_KINDS = new Set([
  'profile.age',
  'profile.location.country',
  'profile.location.city',
  'profile.language.primary',
  'profile.language.dialect',
  'profile.role',
  'profile.domain',
  'profile.goal.primary',
  'profile.goal.secondary',
  'profile.theme.health',
  'profile.theme.academic',
  'profile.theme.family',
  'profile.theme.work',
  'trait.personality.keywords',
  'trait.coping.style',
]);

// Best-effort long-term goal extraction via LLM (English + Arabic).
async function detectGoalsUsingLLM(messageText) {
  const text = String(messageText || '').trim();
  if (!text || !openaiClient) return null;

  // Gate on likely goal-related cues to avoid unnecessary calls.
  const cueRegex = /(my (biggest )?goal is|my dream is|i want to|i wanna|i would like to|i plan to|i'm planning to|i am planning to|i hope to|اريد ان|أريد أن|حاب|حابة|نفسي|خطتي|هدفي)/i;
  if (!cueRegex.test(text)) return null;

  const hasArabic = /[\u0600-\u06FF]/u.test(text);
  const languageHint = hasArabic ? 'ar' : 'en';

  const systemPrompt = [
    'You extract at most two long-term personal goals from a single user message in Arabic or English.',
    'Only include goals that are clearly about the user\'s life direction (studies, work, moving country, health, relationships, building a startup).',
    'Ignore trivial or short-term wishes like eating, sleeping, or watching something.',
    'Return STRICT JSON: {"primary": "string or empty", "secondary": "string or empty"}.',
    'Keep each string under 100 characters.',
  ].join(' ');

  const userPrompt = [
    `Language hint: ${languageHint}.`,
    'User message:',
    text.slice(0, 800),
  ].join('\n');

  try {
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 96,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content || '';
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const primary = typeof parsed.primary === 'string' ? parsed.primary.trim() : '';
    const secondary = typeof parsed.secondary === 'string' ? parsed.secondary.trim() : '';
    const out = {};
    if (primary && primary.length <= 120) out.primary = primary;
    if (secondary && secondary.length <= 120) out.secondary = secondary;
    if (!out.primary && !out.secondary) return null;
    return out;
  } catch (err) {
    console.error(
      '[LongTermMemory] detectGoalsUsingLLM error',
      err && err.message ? err.message : err
    );
    return null;
  }
}

function extractSemanticFactsFromMessage(messageText) {
  const raw = String(messageText || '').trim();
  if (!raw) return [];
  const text = raw;
  const lower = raw.toLowerCase();
  const hasArabic = /[\u0600-\u06FF]/u.test(text);
  const facts = [];

  function pushFact(kind, value, confidence) {
    if (!kind || !value) return;
    const v = String(value || '').trim();
    if (!v) return;
    const conf = typeof confidence === 'number' && Number.isFinite(confidence)
      ? confidence
      : 0.9;
    facts.push({ kind, value: v, confidence: conf });
  }

  function hasNear(haystack, a, b, maxDistance) {
    if (!haystack || !a || !b) return false;
    const ia = haystack.indexOf(a);
    if (ia === -1) return false;
    const ib = haystack.indexOf(b);
    if (ib === -1) return false;
    return Math.abs(ia - ib) <= maxDistance;
  }

  const seasonTokensEn = {
    winter: ['winter'],
    summer: ['summer'],
    spring: ['spring'],
    autumn: ['autumn', 'fall'],
  };

  const seasonTokensAr = {
    winter: ['شتاء', 'شتوي', 'الجو الشتوي'],
    summer: ['صيف', 'صيفي', 'الجو الصيفي'],
    spring: ['ربيع', 'ربيعي'],
    autumn: ['خريف', 'خريفي'],
  };

  const weatherTokensEn = {
    rain: ['rain', 'rainy'],
    snow: ['snow', 'snowy'],
    sun: ['sun', 'sunny', 'sunshine'],
    cold: ['cold', 'chilly', 'cool'],
    hot: ['hot', 'warm', 'heat'],
  };

  const weatherTokensAr = {
    rain: ['مطر', 'المطر', 'أمطار', 'ماطر', 'ماطرة'],
    snow: ['ثلج', 'الثلج', 'ثلجية'],
    sun: ['شمس', 'الشمس', 'مشمس'],
    cold: ['بارد', 'الجو البارد', 'برد'],
    hot: ['حار', 'الجو الحار', 'حارّة', 'حر'],
  };

  const petTokensEn = {
    cats: ['cat', 'cats'],
    dogs: ['dog', 'dogs'],
  };

  const petTokensAr = {
    cats: ['قطة', 'قطط', 'القطط'],
    dogs: ['كلب', 'كلاب', 'الكلاب'],
  };

  const hobbyTokensEn = {
    gaming: ['gaming', 'video games', 'playing games', 'play games', 'play video games'],
    gym: ['gym', 'go to the gym', 'work out', 'workout', 'lifting weights'],
    drawing: ['drawing', 'draw', 'sketching', 'sketch'],
    reading: ['reading', 'read books', 'reading books', 'bookworm'],
    football: ['football', 'soccer'],
    basketball: ['basketball'],
  };

  const hobbyTokensAr = {
    gaming: ['ألعاب فيديو', 'العاب فيديو', 'ألعاب', 'العاب'],
    gym: ['الجيم', 'النادي الرياضي', 'نادي رياضي', 'تمرين', 'أتمرن'],
    drawing: ['رسم', 'أرسم', 'برسم'],
    reading: ['القراءة', 'أقرأ', 'قراءة الكتب', 'قراءة'],
    football: ['كرة القدم', 'كرة قدم', 'فوتبول'],
    basketball: ['كرة السلة'],
  };

  const likeVerbsEn = ['love', 'like', 'enjoy', 'adore', 'favorite', 'favourite'];
  const dislikeVerbsEn = ['hate', 'dislike', 'detest'];
  const likeVerbsAr = ['احب', 'أحب', 'بحب', 'بعشق', 'اعشق', 'أعشق', 'المفضل', 'المفضلة'];
  const dislikeVerbsAr = ['اكره', 'أكره', 'بكره', 'ما بحب', 'ما احب', 'ما أحب'];

  function detectPrefsFromMap(tokensMapEn, tokensMapAr, kindLike, kindDislike) {
    const isArabicContext = hasArabic;
    const srcEn = lower;
    const srcAr = text;
    const maxDist = 40;
    Object.keys(tokensMapEn).forEach((code) => {
      let liked = false;
      let disliked = false;

      const enTokens = tokensMapEn[code] || [];
      for (const token of enTokens) {
        for (const v of likeVerbsEn) {
          if (hasNear(srcEn, v, token, maxDist)) {
            liked = true;
            break;
          }
        }
        for (const v of dislikeVerbsEn) {
          if (hasNear(srcEn, v, token, maxDist)) {
            disliked = true;
            break;
          }
        }
      }

      if (isArabicContext) {
        const arTokens = tokensMapAr[code] || [];
        for (const token of arTokens) {
          for (const v of likeVerbsAr) {
            if (hasNear(srcAr, v, token, maxDist)) {
              liked = true;
              break;
            }
          }
          for (const v of dislikeVerbsAr) {
            if (hasNear(srcAr, v, token, maxDist)) {
              disliked = true;
              break;
            }
          }
        }
      }

      if (liked && !disliked) {
        pushFact(kindLike, code, 0.95);
      } else if (disliked && !liked) {
        pushFact(kindDislike, code, 0.95);
      }
    });
  }

  detectPrefsFromMap(seasonTokensEn, seasonTokensAr, 'preference.season.like', 'preference.season.dislike');
  detectPrefsFromMap(weatherTokensEn, weatherTokensAr, 'preference.weather.like', 'preference.weather.dislike');
  detectPrefsFromMap(petTokensEn, petTokensAr, 'preference.pets.like', 'preference.pets.dislike');
  detectPrefsFromMap(hobbyTokensEn, hobbyTokensAr, 'preference.hobby.like', 'preference.hobby.dislike');

  // Additional explicit handling for phrases like:
  // - "my favorite weather is summer"
  // - "favorite weather: rainy and cold"
  // - "my favorite season is winter"
  // and Arabic equivalents using المفضل/المفضّل.
  try {
    const lowerNoPunct = lower.replace(/[.,!?؟،]+/g, ' ');

    function pickFirstFromMaps(maps, src) {
      for (const map of maps) {
        const keys = Object.keys(map || {});
        for (const code of keys) {
          const tokens = map[code] || [];
          for (const tok of tokens) {
            if (tok && src.includes(String(tok).toLowerCase())) {
              return code;
            }
          }
        }
      }
      return null;
    }

    // English: favorite weather / season
    if (lower.includes('favorite weather') || lower.includes('favourite weather')) {
      const primaryCode = pickFirstFromMaps([seasonTokensEn, weatherTokensEn], lowerNoPunct);
      if (primaryCode) {
        pushFact('preference.weather.like', primaryCode, 0.97);
      }
    }
    if (lower.includes('favorite season') || lower.includes('favourite season')) {
      const seasonCode = pickFirstFromMaps([seasonTokensEn], lowerNoPunct);
      if (seasonCode) {
        pushFact('preference.season.like', seasonCode, 0.97);
      }
    }

    // Arabic: phrases like "جوي المفضل" / "الجو المفضل" / "فصلي المفضل".
    if (hasArabic) {
      const favWeatherMarkers = ['جوي المفضل', 'الجو المفضل', 'الجو المفضل عندي'];
      const favSeasonMarkers = ['فصلي المفضل', 'الفصل المفضل'];

      const hasFavWeather = favWeatherMarkers.some((m) => text.includes(m));
      const hasFavSeason = favSeasonMarkers.some((m) => text.includes(m));

      if (hasFavWeather) {
        const primaryCodeAr = pickFirstFromMaps([seasonTokensAr, weatherTokensAr], text);
        if (primaryCodeAr) {
          pushFact('preference.weather.like', primaryCodeAr, 0.97);
        }
      }
      if (hasFavSeason) {
        const seasonCodeAr = pickFirstFromMaps([seasonTokensAr], text);
        if (seasonCodeAr) {
          pushFact('preference.season.like', seasonCodeAr, 0.97);
        }
      }
    }
  } catch (_) {
    // best-effort only; fall back silently if anything goes wrong
  }

  // Favorite drink / food preferences (EN + AR), stored as short
  // preference.drink.like / preference.food.like facts.
  try {
    const MAX_PREF_LEN = 40;

    function normalisePreferenceValue(rawVal) {
      if (!rawVal) return null;
      let v = String(rawVal)
        .replace(/["'«»]/g, '')
        .trim();
      // Cut at first line break if present.
      const nlIdx = v.indexOf('\n');
      if (nlIdx !== -1) {
        v = v.slice(0, nlIdx).trim();
      }
      if (v.length > MAX_PREF_LEN) {
        v = v.slice(0, MAX_PREF_LEN).trim();
      }
      if (v.length < 2) return null;
      return v.toLowerCase();
    }

    // --- Favorite drink ---
    let drinkCandidate = null;

    const drinkMatchEn = raw.match(
      /\bmy favou?rite drink is\s+([^.,!?\n]+)|\bfavou?rite drink\s*[:\-]\s*([^.,!?\n]+)/i
    );
    if (drinkMatchEn) {
      drinkCandidate = (drinkMatchEn[1] || drinkMatchEn[2] || '').trim();
    }

    if (!drinkCandidate && hasArabic) {
      const drinkMatchAr = text.match(
        /(?:مشروبي المفضل هو|مشروبي المفضّل هو|مشروبي المفضل|مشروبي المفضّل)\s+([^،.!؟\n]+)/u
      );
      if (drinkMatchAr && drinkMatchAr[1]) {
        drinkCandidate = String(drinkMatchAr[1]).trim();
      }
    }

    const normDrink = normalisePreferenceValue(drinkCandidate);
    if (normDrink) {
      pushFact('preference.drink.like', normDrink, 0.96);
    }

    // --- Favorite food ---
    let foodCandidate = null;

    const foodMatchEn = raw.match(
      /\bmy favou?rite food is\s+([^.,!?\n]+)|\bfavou?rite food\s*[:\-]\s*([^.,!?\n]+)/i
    );
    if (foodMatchEn) {
      foodCandidate = (foodMatchEn[1] || foodMatchEn[2] || '').trim();
    }

    if (!foodCandidate && hasArabic) {
      const foodMatchAr = text.match(
        /(?:اكلتي المفضلة|أكلتي المفضلة|اكلتي المفضّلة|أكلتي المفضّلة)\s+([^،.!؟\n]+)/u
      );
      if (foodMatchAr && foodMatchAr[1]) {
        foodCandidate = String(foodMatchAr[1]).trim();
      }
    }

    const normFood = normalisePreferenceValue(foodCandidate);
    if (normFood) {
      pushFact('preference.food.like', normFood, 0.96);
    }
  } catch (_) {
    // best-effort only
  }

  const socialIntrovertEn = ['introvert', 'introverted'];
  const socialExtrovertEn = ['extrovert', 'extroverted'];
  const socialAmbivertEn = ['ambivert'];
  const socialIntrovertAr = ['', ''];
  const socialExtrovertAr = ['', ''];

  let socialStyle = null;

  for (const token of socialIntrovertEn) {
    if (lower.includes(token)) {
      socialStyle = 'introvert';
      break;
    }
  }

  if (!socialStyle) {
    for (const token of socialExtrovertEn) {
      if (lower.includes(token)) {
        socialStyle = 'extrovert';
        break;
      }
    }
  }

  if (!socialStyle) {
    for (const token of socialAmbivertEn) {
      if (lower.includes(token)) {
        socialStyle = 'ambivert';
        break;
      }
    }
  }

  if (!socialStyle && hasArabic) {
    for (const token of socialIntrovertAr) {
      if (text.includes(token)) {
        socialStyle = 'introvert';
        break;
      }
    }
  }

  if (!socialStyle && hasArabic) {
    for (const token of socialExtrovertAr) {
      if (text.includes(token)) {
        socialStyle = 'extrovert';
        break;
      }
    }
  }

  if (socialStyle) {
    pushFact('trait.social.style', socialStyle, 0.95);
  }

  const crowdTokensEn = ['crowd', 'crowds', 'crowded'];
  const crowdNegEn = ['anxious', 'anxiety', 'panic', 'overwhelmed', 'hate', 'dislike'];

  let dislikesCrowds = false;
  for (const t of crowdTokensEn) {
    if (!lower.includes(t)) continue;
    let hasNegative = false;
    for (const v of crowdNegEn) {
      if (hasNear(lower, v, t, 40)) {
        hasNegative = true;
        break;
      }
    }
    if (hasNegative) {
      dislikesCrowds = true;
      break;
    }
  }

  if (dislikesCrowds) {
    pushFact('preference.crowds', 'dislike', 0.9);
  }

  // --- Persona: age ---
  const age = detectAgeFromText(text);
  if (age) {
    pushFact('profile.age', age, 0.98);
  }

  // --- Persona: location (country/city) ---
  for (const entry of COUNTRY_KEYWORDS) {
    for (const tok of entry.tokens) {
      if (lower.includes(tok.toLowerCase())) {
        pushFact('profile.location.country', entry.value, 0.95);
        break;
      }
    }
  }
  for (const entry of CITY_KEYWORDS) {
    for (const tok of entry.tokens) {
      if (lower.includes(tok.toLowerCase())) {
        pushFact('profile.location.city', entry.value, 0.95);
        break;
      }
    }
  }

  // --- Persona: language primary & dialect ---
  for (const entry of LANGUAGE_PRIMARY_KEYWORDS) {
    for (const tok of entry.tokens) {
      if (lower.includes(tok.toLowerCase())) {
        pushFact('profile.language.primary', entry.value, 0.9);
        break;
      }
    }
  }
  for (const entry of DIALECT_KEYWORDS) {
    for (const tok of entry.tokens) {
      if (lower.includes(tok.toLowerCase())) {
        pushFact('profile.language.dialect', entry.value, 0.9);
        break;
      }
    }
  }

  // --- Persona: role & domain ---
  for (const entry of ROLE_KEYWORDS) {
    for (const tok of entry.tokens) {
      if (lower.includes(tok.toLowerCase())) {
        pushFact('profile.role', entry.value, 0.95);
        break;
      }
    }
  }
  for (const entry of DOMAIN_KEYWORDS) {
    for (const tok of entry.tokens) {
      if (lower.includes(tok.toLowerCase())) {
        pushFact('profile.domain', entry.value, 0.95);
        break;
      }
    }
  }

  // --- Persona: themes (health, academic, family, work) ---
  for (const entry of HEALTH_KEYWORDS) {
    for (const tok of entry.tokens) {
      if (lower.includes(tok.toLowerCase())) {
        pushFact('profile.theme.health', entry.value, 0.92);
        break;
      }
    }
  }
  for (const entry of ACADEMIC_KEYWORDS) {
    for (const tok of entry.tokens) {
      if (lower.includes(tok.toLowerCase())) {
        pushFact('profile.theme.academic', entry.value, 0.92);
        break;
      }
    }
  }
  for (const entry of FAMILY_KEYWORDS) {
    for (const tok of entry.tokens) {
      if (lower.includes(tok.toLowerCase())) {
        pushFact('profile.theme.family', entry.value, 0.9);
        break;
      }
    }
  }
  for (const entry of WORK_KEYWORDS) {
    for (const tok of entry.tokens) {
      if (lower.includes(tok.toLowerCase())) {
        pushFact('profile.theme.work', entry.value, 0.9);
        break;
      }
    }
  }

  // --- Persona: personality keywords ---
  const personalityValues = [];
  for (const p of PERSONALITY_TOKENS) {
    if (lower.includes(p.match.toLowerCase()) && !personalityValues.includes(p.value)) {
      personalityValues.push(p.value);
    }
  }
  if (personalityValues.length) {
    pushFact('trait.personality.keywords', personalityValues.join(', '), 0.9);
  }

  // --- Persona: coping style ---
  for (const c of COPING_TOKENS) {
    for (const tok of c.tokens) {
      if (lower.includes(tok.toLowerCase())) {
        pushFact('trait.coping.style', c.value, 0.9);
        break;
      }
    }
  }

  return facts;
}

/**
 * Update long-term emotional profile for a user.
 *
 * @param {number} userId
 * @param {Object} event
 * @param {{ primaryEmotion:string, intensity:number }} event.emotion
 * @param {string[]} [event.topics]
 * @param {string} [event.characterId]
 * @param {number|null} [event.intensityDelta]
 * @param {string|null} [event.trend]
 * @param {Object|null} [outcome]
 */
async function updateLongTerm(userId, event, outcome) {
  if (!userId || !event || !event.emotion) return;

  const emo = event.emotion;
  const topics = Array.isArray(event.topics) ? event.topics.filter(Boolean) : [];
  const personaId = event.characterId || null;
  const now = new Date();

  const intensity01 = Math.max(0, Math.min(1, (emo.intensity || 1) / 5));
  const delta = typeof event.intensityDelta === 'number' ? event.intensityDelta : null;

  let profile = await prisma.userEmotionProfile.findUnique({
    where: { userId },
  });

  let emotionStats = ensureObject(profile && profile.emotionStats);
  let topicProfile = ensureObject(profile && profile.topicProfile);
  let personaAffinity = ensureObject(profile && profile.personaAffinity);
  let emotionalAnchors = Array.isArray(profile && profile.emotionalAnchors)
    ? profile.emotionalAnchors.slice()
    : [];
  let volatilityIndex = profile && typeof profile.volatilityIndex === 'number'
    ? profile.volatilityIndex
    : 0;

  // Update per-emotion stats
  const label = emo.primaryEmotion || 'NEUTRAL';
  if (!emotionStats[label]) {
    emotionStats[label] = {
      count: 0,
      avgIntensity: 0,
      lastSeenAt: null,
    };
  }
  const eStat = emotionStats[label];
  const newCount = (eStat.count || 0) + 1;
  const prevAvg = typeof eStat.avgIntensity === 'number' ? eStat.avgIntensity : 0;
  const nextAvg = (prevAvg * (eStat.count || 0) + intensity01) / newCount;
  emotionStats[label] = {
    count: newCount,
    avgIntensity: nextAvg,
    lastSeenAt: now,
  };

  // Update topic profile
  for (const t of topics) {
    if (!t) continue;
    if (!topicProfile[t]) {
      topicProfile[t] = {
        count: 0,
        lastSeenAt: null,
        score: 0,
      };
    }
    const tp = topicProfile[t];
    const prevCount = tp.count || 0;
    tp.count = prevCount + 1;
    tp.lastSeenAt = now;
    // Simple decayed score: keep small, bounded values.
    const prevScore = typeof tp.score === 'number' ? tp.score : 0;
    tp.score = Math.min(prevScore * 0.9 + intensity01, 10);
    topicProfile[t] = tp;
  }

  // Persona affinity per character (optional but useful)
  if (personaId) {
    if (!personaAffinity[personaId]) {
      personaAffinity[personaId] = {
        uses: 0,
        avgOutcome: 0,
        lastUsedAt: null,
        lastTrend: null,
      };
    }
    const pa = personaAffinity[personaId];
    const prevUses = pa.uses || 0;

    // Outcome score: heuristic based on intensityDelta or external outcome.
    let outcomeScore = 0;
    if (outcome && typeof outcome.score === 'number') {
      outcomeScore = outcome.score;
    } else if (delta != null) {
      // If intensity is going down, treat it as positive (improvement).
      outcomeScore = delta < 0 ? 1 : delta > 0 ? -1 : 0;
    }

    const prevAvgOutcome = typeof pa.avgOutcome === 'number' ? pa.avgOutcome : 0;
    const newUses = prevUses + 1;
    const nextAvgOutcome = (prevAvgOutcome * prevUses + outcomeScore) / newUses;

    personaAffinity[personaId] = {
      uses: newUses,
      avgOutcome: nextAvgOutcome,
      lastUsedAt: now,
      lastTrend: event.trend || pa.lastTrend || null,
    };
  }

  // Volatility index: exponential moving average of absolute intensity deltas.
  if (delta != null) {
    const absDelta01 = Math.min(Math.abs(delta) / 5, 1);
    const alpha = 0.1;
    volatilityIndex = volatilityIndex > 0
      ? (1 - alpha) * volatilityIndex + alpha * absDelta01
      : absDelta01;
  }

  // Fetch message text for anchors / reasoning.
  let messageText = '';
  if (event.messageId) {
    try {
      const msg = await prisma.message.findUnique({
        where: { id: event.messageId },
        select: { content: true },
      });
      if (msg && typeof msg.content === 'string') {
        messageText = msg.content;
      }
    } catch (err) {
      // best-effort only
    }
  }

  // NEW: best-effort identity (name) detection and persistence to UserMemoryFact.
  if (messageText) {
    try {
      let detectedName = detectNameByPattern(messageText);
      if (!detectedName) {
        detectedName = await detectNameUsingLLM(messageText);
      }
      if (detectedName) {
        const kind = 'identity.name';
        const existing = await prisma.userMemoryFact.findFirst({
          where: { userId, kind },
          select: { id: true },
        });

        const isArabicName = /[\u0600-\u06FF]/u.test(detectedName);
        const isLatinName = /[A-Za-z]/.test(detectedName);

        if (existing && existing.id) {
          await prisma.userMemoryFact.update({
            where: { id: existing.id },
            data: {
              value: detectedName,
              confidence: 1.0,
              sourceMessageId: event.messageId || null,
            },
          });
          console.log('[LongTermMemory] identity.name updated', {
            userId,
            hasName: true,
            sourceMessageId: event.messageId || null,
            isArabic: isArabicName,
            isLatin: isLatinName,
            nameLength: detectedName.length,
            mode: 'update',
          });
        } else {
          await prisma.userMemoryFact.create({
            data: {
              userId,
              kind,
              value: detectedName,
              confidence: 1.0,
              sourceMessageId: event.messageId || null,
            },
          });
          console.log('[LongTermMemory] identity.name updated', {
            userId,
            hasName: true,
            sourceMessageId: event.messageId || null,
            isArabic: isArabicName,
            isLatin: isLatinName,
            nameLength: detectedName.length,
            mode: 'create',
          });
        }
        console.log('[LongTermMemory] identity.name upserted', {
          userId,
          value: detectedName,
          sourceMessageId: event.messageId || null,
        });
      } else {
        console.log('[LongTermMemory] identity.name detection_skipped_or_rejected', {
          userId,
          hasMessage: true,
          sourceMessageId: event.messageId || null,
        });
      }
    } catch (err) {
      console.error(
        '[LongTermMemory] identity.name update error',
        err && err.message ? err.message : err
      );
    }
  }

  if (messageText) {
    try {
      const semanticFacts = extractSemanticFactsFromMessage(messageText);
      if (Array.isArray(semanticFacts) && semanticFacts.length) {
        for (const fact of semanticFacts) {
          if (!fact || !fact.kind || !fact.value) continue;
          const kind = String(fact.kind || '').trim();
          const value = String(fact.value || '').trim();
          if (!kind || !value) continue;
          const confidence =
            typeof fact.confidence === 'number' && Number.isFinite(fact.confidence)
              ? fact.confidence
              : 0.9;
          const data = {
            userId,
            kind,
            value,
            confidence,
            sourceMessageId: event.messageId || null,
          };

          // Persona singleton kinds: one primary value per userId+kind.
          if (PERSONA_SINGLETON_KINDS.has(kind)) {
            let existingPersonaFact = null;
            try {
              existingPersonaFact = await prisma.userMemoryFact.findFirst({
                where: { userId, kind },
                select: { id: true },
              });
            } catch (_) {
              existingPersonaFact = null;
            }

            if (existingPersonaFact && existingPersonaFact.id) {
              await prisma.userMemoryFact.update({
                where: { id: existingPersonaFact.id },
                data,
              });
            } else {
              await prisma.userMemoryFact.create({ data });
            }

            console.log('[LongTermMemory] persona_fact_upserted', {
              userId,
              kind,
              value,
              sourceMessageId: event.messageId || null,
            });
          } else {
            // Preference-style facts can have multiple values per kind.
            let existingFact = null;
            try {
              existingFact = await prisma.userMemoryFact.findFirst({
                where: { userId, kind, value },
                select: { id: true },
              });
            } catch (_) {
              existingFact = null;
            }

            if (existingFact && existingFact.id) {
              await prisma.userMemoryFact.update({
                where: { id: existingFact.id },
                data,
              });
            } else {
              await prisma.userMemoryFact.create({ data });
            }

            // Log preference_fact_upserted only for true preference-style kinds,
            // never for persona/profile singleton facts.
            if (kind.startsWith('preference.') || kind === 'trait.social.style') {
              try {
                console.log('[LongTermMemory] preference_fact_upserted', {
                  userId,
                  kind,
                  value,
                  sourceMessageId: event.messageId || null,
                });
              } catch (_) {}
            }
          }
        }
      }
    } catch (err) {
      console.error(
        '[LongTermMemory] semantic preferences update error',
        err && err.message ? err.message : err
      );
    }
  }

  // Emotional anchors V2
  try {
    const detectedAnchors = detectAnchorsFromMessage(messageText, emo.primaryEmotion, emo.intensity);
    if (Array.isArray(detectedAnchors) && detectedAnchors.length) {
      for (const a of detectedAnchors) {
        if (a && !emotionalAnchors.includes(a)) {
          emotionalAnchors.push(a);
        }
      }
    }
  } catch (_) {}

  // Deep emotional reason label (why, not just what)
  let reasonLabel = null;
  try {
    reasonLabel = deriveEmotionalReason(messageText, emotionalAnchors, [], profile || null) || null;
  } catch (_) {
    reasonLabel = null;
  }

  // Lightweight snapshot for quick access when building prompts.
  const recentKernelSnapshot = {
    lastEmotion: label,
    lastIntensity: emo.intensity || 0,
    lastUpdatedAt: now.toISOString(),
    reasonLabel,
  };

  // Upsert profile with new Phase 4 fields.
  await prisma.userEmotionProfile.upsert({
    where: { userId },
    create: {
      userId,
      emotionStats,
      topicProfile,
      personaAffinity,
      volatilityIndex,
      recentKernelSnapshot,
      lastUpdatedAt: now,
      emotionalAnchors,
    },
    update: {
      emotionStats,
      topicProfile,
      personaAffinity,
      volatilityIndex,
      recentKernelSnapshot,
      lastUpdatedAt: now,
      emotionalAnchors,
    },
  });
}

module.exports = {
  updateLongTerm,
};

