const KNOWN_UNKNOWN_CODE = 'UNKNOWN';

function normalizeCountry(headers) {
  if (!headers) return KNOWN_UNKNOWN_CODE;
  const h = headers;
  const raw =
    h['cf-ipcountry'] ||
    h['x-vercel-ip-country'] ||
    h['x-country'] ||
    h['x-appengine-country'] ||
    h['x-geo-country'] ||
    null;

  if (!raw || typeof raw !== 'string') return KNOWN_UNKNOWN_CODE;
  const code = raw.trim().toUpperCase();
  if (!code || code === 'XX') return KNOWN_UNKNOWN_CODE;
  if (code.length === 2) return code;
  return KNOWN_UNKNOWN_CODE;
}

function parseDeviceAndBrowser(userAgentRaw) {
  const ua = (userAgentRaw || '').toString();
  const uaLower = ua.toLowerCase();

  let deviceType = 'desktop';
  if (
    /mobile|iphone|ipod|android.*mobile|blackberry|phone|opera mini|windows phone/i.test(
      ua,
    )
  ) {
    deviceType = 'mobile';
  }

  let browser = 'Other';
  if (uaLower.includes('firefox')) {
    browser = 'Firefox';
  } else if (uaLower.includes('chrome') && !uaLower.includes('edge') && !uaLower.includes('edg') && !uaLower.includes('opr')) {
    browser = 'Chrome';
  } else if (uaLower.includes('safari') && !uaLower.includes('chrome')) {
    browser = 'Safari';
  } else if (uaLower.includes('opr') || uaLower.includes('opera')) {
    browser = 'Other';
  } else if (uaLower.includes('edg') || uaLower.includes('edge')) {
    browser = 'Other';
  }

  return { deviceType, browser };
}

function requestMetadata(req, res, next) {
  try {
    const headers = req.headers || {};
    const country = normalizeCountry(headers);
    const ua = headers['user-agent'] || headers['User-Agent'] || '';
    const { deviceType, browser } = parseDeviceAndBrowser(ua);

    req.requestMetadata = {
      country,
      deviceType,
      browser,
    };
  } catch (_) {
    // Best-effort only; never block the request because of metadata parsing.
    req.requestMetadata = {
      country: KNOWN_UNKNOWN_CODE,
      deviceType: 'desktop',
      browser: 'Other',
    };
  }

  return next();
}

module.exports = requestMetadata;
