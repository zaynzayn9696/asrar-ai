// server/src/utils/lemonConfig.js

const LEMON_MODE = process.env.LEMON_MODE || "test";
const isLive = LEMON_MODE === "live";

const API_KEY = isLive
  ? process.env.LEMON_LIVE_API_KEY
  : process.env.LEMON_TEST_API_KEY;

const WEBHOOK_SECRET = isLive
  ? process.env.LEMON_LIVE_WEBHOOK_SECRET
  : process.env.LEMON_TEST_WEBHOOK_SECRET;

const STORE_ID = process.env.LEMON_STORE_ID;
const VARIANT_ID = process.env.LEMON_VARIANT_ID;

if (!API_KEY || !WEBHOOK_SECRET || !STORE_ID || !VARIANT_ID) {
  console.warn("[LemonConfig] Missing LemonSqueezy env vars");
}

module.exports = {
  isLive,
  API_KEY,
  WEBHOOK_SECRET,
  STORE_ID,
  VARIANT_ID,
};
