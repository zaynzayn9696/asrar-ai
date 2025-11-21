const toInt = (v, fallback) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

const LIMITS = {
  FREE_CHARACTER_ID: process.env.FREE_CHARACTER_ID || 'hana',
  FREE_DAILY: toInt(process.env.FREE_DAILY, 5),
  PRO_DAILY: toInt(process.env.PRO_DAILY, 100),
  PRO_MONTHLY: toInt(process.env.PRO_MONTHLY, 3000),
  PREMIUM_TESTER_EMAIL:
    (process.env.PREMIUM_TESTER_EMAIL || 'zaynzayn9696@gmail.com').toLowerCase(),
  TESTER_LIMIT: toInt(process.env.TESTER_LIMIT, 999999),
};

function getPlanLimits(email, plan) {
  const isTester = (email || '').toLowerCase() === LIMITS.PREMIUM_TESTER_EMAIL;
  if (isTester) {
    return {
      dailyLimit: LIMITS.TESTER_LIMIT,
      monthlyLimit: LIMITS.TESTER_LIMIT,
      freeCharacterId: LIMITS.FREE_CHARACTER_ID,
      isTester: true,
    };
  }
  if (plan === 'pro') {
    return {
      dailyLimit: LIMITS.PRO_DAILY,
      monthlyLimit: LIMITS.PRO_MONTHLY,
      freeCharacterId: LIMITS.FREE_CHARACTER_ID,
      isTester: false,
    };
  }
  return {
    dailyLimit: LIMITS.FREE_DAILY,
    monthlyLimit: 0,
    freeCharacterId: LIMITS.FREE_CHARACTER_ID,
    isTester: false,
  };
}

module.exports = { LIMITS, getPlanLimits };
