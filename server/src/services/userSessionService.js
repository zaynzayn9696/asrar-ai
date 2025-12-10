const prisma = require('../prisma');

/**
 * Record a lightweight, privacy-safe user session based on request metadata.
 *
 * No message content, prompts, or conversation text is ever stored here.
 * Only:
 * - userId
 * - country (from edge headers)
 * - deviceType (mobile/desktop)
 * - browser (Chrome/Safari/Firefox/Other)
 * - createdAt
 */
async function recordUserSession({ userId, req, idleMinutes = 30 }) {
  if (!userId) return null;

  const idleMs = idleMinutes * 60 * 1000;
  const now = new Date();
  const cutoff = new Date(now.getTime() - idleMs);

  // Best-effort read of request metadata; all fields are optional.
  const meta = (req && req.requestMetadata) || {};
  const country = typeof meta.country === 'string' ? meta.country : null;
  const deviceType = typeof meta.deviceType === 'string' ? meta.deviceType : null;
  const browser = typeof meta.browser === 'string' ? meta.browser : null;

  // Fetch the most recent session for this user.
  const latest = await prisma.userSession.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (latest && latest.createdAt > cutoff) {
    // User is still within the active window; treat as the same session.
    return latest;
  }

  // Otherwise, start a new lightweight session.
  const session = await prisma.userSession.create({
    data: {
      userId,
      country,
      deviceType,
      browser,
    },
  });

  return session;
}

module.exports = {
  recordUserSession,
};
