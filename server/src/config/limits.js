const toInt = (v, fallback) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

const LIMITS = {
  FREE_CHARACTER_ID: process.env.FREE_CHARACTER_ID || 'daloua',
  FREE_CHARACTER_IDS:
    (process.env.FREE_CHARACTER_IDS &&
      String(process.env.FREE_CHARACTER_IDS)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)) || ['sheikh-al-hara', 'abu-mukh', 'daloua'],
  PROHIBITED_FOR_FREE_IDS: ['walaa', 'hiba'],
  FREE_DAILY: toInt(process.env.FREE_DAILY, 5),
  PRO_DAILY: toInt(process.env.PRO_DAILY, 0),
  FREE_MONTHLY: toInt(process.env.FREE_MONTHLY, 50),
  PRO_MONTHLY: toInt(process.env.PRO_MONTHLY, 500),
  PREMIUM_TESTER_EMAIL:
    (process.env.PREMIUM_TESTER_EMAIL || 'zaynzayn9696@gmail.com').toLowerCase(),
  TESTER_LIMIT: toInt(process.env.TESTER_LIMIT, 999999),
};

function getPlanLimits(email, plan) {
  const isTester = (email || '').toLowerCase() === LIMITS.PREMIUM_TESTER_EMAIL;
  // Ensure monthly limits never collapse to 0 due to misconfigured env vars.
  // Free plan: minimum 50 messages/month.
  // Pro/Premium: minimum 500 messages/month.
  const freeMonthlyLimit = LIMITS.FREE_MONTHLY > 0 ? LIMITS.FREE_MONTHLY : 50;
  const proMonthlyLimit = LIMITS.PRO_MONTHLY > 0 ? LIMITS.PRO_MONTHLY : 500;
  if (isTester) {
    return {
      dailyLimit: LIMITS.TESTER_LIMIT,
      monthlyLimit: LIMITS.TESTER_LIMIT,
      freeCharacterId: LIMITS.FREE_CHARACTER_ID,
      freeCharacterIds: LIMITS.FREE_CHARACTER_IDS,
      premiumOnlyCharacterIds: LIMITS.PROHIBITED_FOR_FREE_IDS,
      isTester: true,
    };
  }
  if (plan === 'pro' || plan === 'premium') {
    return {
      dailyLimit: LIMITS.PRO_DAILY,
      monthlyLimit: proMonthlyLimit,
      freeCharacterId: LIMITS.FREE_CHARACTER_ID,
      freeCharacterIds: LIMITS.FREE_CHARACTER_IDS,
      premiumOnlyCharacterIds: LIMITS.PROHIBITED_FOR_FREE_IDS,
      isTester: false,
    };
  }
  return {
    dailyLimit: LIMITS.FREE_DAILY,
    monthlyLimit: freeMonthlyLimit,
    freeCharacterId: LIMITS.FREE_CHARACTER_ID,
    freeCharacterIds: LIMITS.FREE_CHARACTER_IDS,
    premiumOnlyCharacterIds: LIMITS.PROHIBITED_FOR_FREE_IDS,
    isTester: false,
  };
}

module.exports = { LIMITS, getPlanLimits };
