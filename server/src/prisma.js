// server/src/prisma.js
// Prisma client with middleware to transparently encrypt/decrypt Message content.
// IMPORTANT: Sensitive message content must never be logged. Only log IDs and
// high-level meta information in this file or any callers.

const { PrismaClient } = require("@prisma/client");
const { encryptText, decryptText } = require("./utils/crypto");

// Fail fast if MESSAGE_ENCRYPTION_KEY is missing or invalid, so we never
// accidentally store plaintext while thinking it's encrypted.
function ensureEncryptionKeyOrExit() {
  try {
    // This will throw if the key is missing or misconfigured.
    encryptText("__encryption_key_validation__");
  } catch (err) {
    console.error("[Encryption] MESSAGE_ENCRYPTION_KEY misconfigured:", err.message || err);
    process.exit(1);
  }
}

ensureEncryptionKeyOrExit();

const prisma = new PrismaClient();

// Helper to apply encryption on write
function encryptMessageData(data) {
  if (!data) return;
  if (typeof data.content === "string") {
    data.content = encryptText(data.content);
  }
}

// Helper to apply decryption on read
function decryptMessageRecord(record) {
  if (!record) return record;
  if (typeof record.content === "string") {
    try {
      record.content = decryptText(record.content);
    } catch (err) {
      console.error("[Encryption] Failed to decrypt Message.content:", err.message || err);
    }
  }
  return record;
}

prisma.$use(async (params, next) => {
  if (params.model !== "Message") {
    return next(params);
  }

  const { action, args } = params;

  // Encrypt on write operations
  switch (action) {
    case "create":
      encryptMessageData(args?.data);
      break;
    case "createMany":
      if (Array.isArray(args?.data)) {
        args.data.forEach(encryptMessageData);
      } else if (args?.data) {
        encryptMessageData(args.data);
      }
      break;
    case "update":
    case "updateMany":
      encryptMessageData(args?.data);
      break;
    case "upsert":
      if (args?.create) encryptMessageData(args.create);
      if (args?.update) encryptMessageData(args.update);
      break;
    default:
      break;
  }

  const result = await next(params);

  // Decrypt on read operations
  if (["findUnique", "findFirst", "create", "update", "upsert", "delete"].includes(action)) {
    return decryptMessageRecord(result);
  }

  if (action === "findMany") {
    if (Array.isArray(result)) {
      return result.map(decryptMessageRecord);
    }
    return result;
  }

  // createMany / updateMany / deleteMany return BatchPayload (no records)
  return result;
});

module.exports = prisma;
