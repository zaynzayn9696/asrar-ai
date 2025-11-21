// server/src/middleware/requireAuth.js
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const token = req.cookies?.token; // 👈 cookie name MUST be 'token'

    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // set req.user in a consistent way
    req.user = {
      id: payload.id,
      email: payload.email,
    };

    next();
  } catch (err) {
    console.error("requireAuth error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
