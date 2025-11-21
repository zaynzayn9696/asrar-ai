// server/src/middleware/requireAuth.js
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  console.log("[requireAuth] incoming cookies:", req.cookies);
  console.log("[requireAuth] incoming auth header:", req.headers.authorization);

  let token = req.cookies?.token;

  if (token) {
    console.log("[requireAuth] using token from cookie");
  } else {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
      console.log("[requireAuth] using token from Authorization header");
    }
  }

  if (!token) {
    console.log("[requireAuth] no token from cookie or header");
    return res
      .status(401)
      .json({ error: "Not authenticated (no token cookie or bearer)" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    console.log("[requireAuth] token OK, payload:", payload);
    req.user = payload;
    return next();
  } catch (err) {
    console.error("[requireAuth] invalid token:", err.message);
    return res
      .status(401)
      .json({ error: "Invalid token", detail: err.message });
  }
}

module.exports = requireAuth;
