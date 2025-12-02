 const DEFAULT_ADMIN_EMAIL = 'zaynzayn9696@gmail.com';

 const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

 function isAdminEmail(email) {
  const normalized = (email || '').toLowerCase();

  if (!normalized) {
    return false;
  }

  if (ADMIN_EMAILS.length > 0) {
    return ADMIN_EMAILS.includes(normalized);
  }

  return normalized === DEFAULT_ADMIN_EMAIL;
 }

 function requireAdmin(req, res, next) {
  const email = (req.user?.email || '').toLowerCase();

  if (!isAdminEmail(email)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return next();
 }

 module.exports = requireAdmin;
 module.exports.isAdminEmail = isAdminEmail;
