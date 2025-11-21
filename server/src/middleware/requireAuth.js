// server/src/middleware/requireAuth.js
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, ... }
    return next();
  } catch (err) {
    console.error("[requireAuth] invalid token:", err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = requireAuth;
