'use strict';

// server/src/utils/languageEnforcement.js
// Shared language enforcement utilities for P4 compliance.
// Used by both liteEngine and responseOrchestrator.

// Allowlist: English words that might match Arabizi patterns but are legitimate
const ENGLISH_ALLOWLIST = new Set([
  'wallaby',
  'walla',
  'halo',
  'halogen',
  'halibut',
  'yahoo',
  'yak',
  'yakuza',
  'yam',
  'inshalation',
  'mashup',
  'mash',
]);

/**
 * Detect Arabic script or common Arabic/Arabizi tokens in text.
 * Returns { contaminated: boolean, tokens: string[] } with matched tokens for logging.
 */
function detectArabicContamination(text) {
  if (!text) return { contaminated: false, tokens: [] };
  const str = String(text);
  const matchedTokens = [];
  
  // Check for Arabic script characters
  const arabicMatch = str.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g);
  if (arabicMatch) {
    matchedTokens.push(...arabicMatch.map(m => `[arabic:${m}]`));
  }
  
  // Check for common transliterated Arabic fillers and proverbs
  const arabiziPatterns = [
    { re: /\bya\s+(habibi|habibti|qalbi|rouhi|akhi|ukhti|ibni|benti|zalameh)\b/gi, name: 'ya+term' },
    { re: /\bwallah\b/gi, name: 'wallah' },
    { re: /\binshallah\b/gi, name: 'inshallah' },
    { re: /\bhabibi\b/gi, name: 'habibi' },
    { re: /\bhabibti\b/gi, name: 'habibti' },
    { re: /\byalla\b/gi, name: 'yalla' },
    { re: /\bkhalas\b/gi, name: 'khalas' },
    { re: /\bmashallah\b/gi, name: 'mashallah' },
    { re: /\bsubhanallah\b/gi, name: 'subhanallah' },
    { re: /\balhamdulillah\b/gi, name: 'alhamdulillah' },
    { re: /\bta[\u02bf\u2018\u2019']?[aā]l[i]?\s*a[hḥ]k[iī]\b/gi, name: 'taal-ahki' },
    // Common Arabic proverbs in transliteration
    { re: /\bel[- ]?sabr\b/gi, name: 'el-sabr' },
    { re: /\bmiftah\b/gi, name: 'miftah' },
    { re: /\bel[- ]?faraj\b/gi, name: 'el-faraj' },
    { re: /\bel[- ]?donya\b/gi, name: 'el-donya' },
    { re: /\bdowwara\b/gi, name: 'dowwara' },
    { re: /\bkull[ua]na\b/gi, name: 'kullna' },
    { re: /\bmarayna\b/gi, name: 'marayna' },
    { re: /\bashya\b/gi, name: 'ashya' },
    { re: /\bzay\s+heik\b/gi, name: 'zay-heik' },
  ];
  
  for (const { re, name } of arabiziPatterns) {
    const matches = str.match(re);
    if (matches) {
      // Check allowlist
      const filtered = matches.filter(m => !ENGLISH_ALLOWLIST.has(m.toLowerCase()));
      if (filtered.length > 0) {
        matchedTokens.push(...filtered.map(m => `[arabizi:${name}:${m}]`));
      }
    }
  }
  
  return { contaminated: matchedTokens.length > 0, tokens: matchedTokens };
}

/**
 * Strip Arabic script and common Arabizi from English replies.
 * Logs what was stripped for debugging.
 */
function enforceEnglishOnly(text, options = {}) {
  if (!text) return text;
  let out = String(text);
  const stripped = [];
  
  // Remove Arabic script characters
  const arabicMatches = out.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g);
  if (arabicMatches) {
    stripped.push(...arabicMatches);
    out = out.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g, '');
  }
  
  // Remove common Arabizi fillers and proverbs
  const arabiziPatterns = [
    /\bya\s+(habibi|habibti|qalbi|rouhi|akhi|ukhti|ibni|benti|zalameh)\b,?\s*/gi,
    /\bwallah\b,?\s*/gi,
    /\binshallah\b,?\s*/gi,
    /\bhabibi\b,?\s*/gi,
    /\bhabibti\b,?\s*/gi,
    /\byalla\b,?\s*/gi,
    /\bkhalas\b,?\s*/gi,
    /\bmashallah\b,?\s*/gi,
    /\bsubhanallah\b,?\s*/gi,
    /\balhamdulillah\b,?\s*/gi,
    /\bta[\u02bf\u2018\u2019']?[aā]l[i]?\s*a[hḥ]k[iī]\b,?\s*/gi,
    // Common Arabic proverbs in transliteration
    /\bel[- ]?sabr\b,?\s*/gi,
    /\bmiftah\b,?\s*/gi,
    /\bel[- ]?faraj\b,?\s*/gi,
    /\bel[- ]?donya\b,?\s*/gi,
    /\bdowwara\b,?\s*/gi,
    /\bkull[ua]na\b,?\s*/gi,
    /\bmarayna\b,?\s*/gi,
    /\bashya\b,?\s*/gi,
    /\bzay\s+heik\b,?\s*/gi,
  ];
  
  for (const re of arabiziPatterns) {
    out = out.replace(re, (match) => {
      const lower = match.trim().toLowerCase();
      if (ENGLISH_ALLOWLIST.has(lower)) return match;
      stripped.push(match.trim());
      return '';
    });
  }
  
  // Clean up double spaces and trim
  out = out.replace(/\s{2,}/g, ' ').trim();
  
  // Log if anything was stripped
  if (stripped.length > 0 && options.log !== false) {
    console.log('[LanguageEnforcement] Stripped tokens:', stripped.join(', '));
  }
  
  return out;
}

module.exports = {
  detectArabicContamination,
  enforceEnglishOnly,
  ENGLISH_ALLOWLIST,
};
