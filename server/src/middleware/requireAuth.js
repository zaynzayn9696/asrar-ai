// server/src/middleware/requireAuth.js
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  let token = req.cookies?.token;

  if (!token) {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token) {
    // Keep error logs only
    console.error("[requireAuth] No token from cookie or header");
    return res
      .status(401)
      .json({ error: "Not authenticated (no token cookie or bearer)" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // No need to log payload — just assign it
    req.user = payload;

    return next();
  } catch (err) {
    // Errors should still be logged
    console.error("[requireAuth] Invalid token:", err.message);
    return res
      .status(401)
      .json({ error: "Invalid token", detail: err.message });
  }
}

module.exports = requireAuth;
