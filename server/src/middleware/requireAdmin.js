const ADMIN_EMAIL = 'zaynzayn9696@gmail.com';

function requireAdmin(req, res, next) {
  const email = (req.user?.email || '').toLowerCase();

  if (email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return next();
}

module.exports = requireAdmin;
