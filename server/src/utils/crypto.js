// server/src/utils/crypto.js
// Application-level encryption helpers for sensitive message content.
// Uses AES-256-GCM with a 32-byte key from MESSAGE_ENCRYPTION_KEY.

const crypto = require("crypto");

const PREFIX = "enc::"; // marker to distinguish encrypted payloads from legacy plain text

function getKey() {
  const raw = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("MESSAGE_ENCRYPTION_KEY is not set");
  }

  const trimmed = String(raw).trim();

  // 1) If the key is provided as 64-char hex (32 bytes), use it directly.
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === 64) {
    return Buffer.from(trimmed, "hex");
  }

  // 2) Try interpreting as base64; if it yields 32 bytes, use it.
  try {
    const asBase64 = Buffer.from(trimmed, "base64");
    if (asBase64.length === 32) {
      return asBase64;
    }
  } catch (_) {
    // fall through to KDF derivation below
  }

  // 3) Fallback: derive a 32-byte key from the string using SHA-256.
  //    This allows using an arbitrary passphrase-like value in MESSAGE_ENCRYPTION_KEY
  //    while always producing a fixed-size AES-256 key.
  return crypto.createHash("sha256").update(trimmed, "utf8").digest();
}

// Encrypt plain text into a single string: enc::<ivHex>:<cipherHex>:<authTagHex>
function encryptText(plainText) {
  if (plainText == null) return plainText;
  if (plainText === "") return "";

  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit nonce recommended for GCM

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const ivHex = iv.toString("hex");
  const ctHex = ciphertext.toString("hex");
  const tagHex = authTag.toString("hex");

  return `${PREFIX}${ivHex}:${ctHex}:${tagHex}`;
}

// Decrypts the format produced by encryptText.
// If the input does not start with the PREFIX, it is returned as-is
// to remain backward compatible with existing plain text records.
function decryptText(encrypted) {
  if (encrypted == null) return encrypted;
  if (encrypted === "") return "";

  if (!String(encrypted).startsWith(PREFIX)) {
    // assume legacy plain text
    return encrypted;
  }

  const withoutPrefix = String(encrypted).slice(PREFIX.length);
  const parts = withoutPrefix.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted message format");
  }

  const [ivHex, ctHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ctHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");

  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// Backwards-compatible exports used elsewhere in the codebase
function encryptMessage(text) {
  return encryptText(text);
}

function decryptMessage(text) {
  return decryptText(text);
}

module.exports = { encryptText, decryptText, encryptMessage, decryptMessage };
