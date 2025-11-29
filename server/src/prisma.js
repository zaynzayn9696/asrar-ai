const { PrismaClient } = require('@prisma/client');
const { encryptMessage, decryptMessage } = require('./utils/crypto');

let prisma;

/**
 * Singleton Prisma client for the whole server.
 * This file MUST export the actual PrismaClient instance directly.
 */
if (!global._asrarPrisma) {
  const client = new PrismaClient();

  // Prisma middleware: transparently encrypt/decrypt Message.content.
  // - On writes to the Message model, content is encrypted before hitting the DB.
  // - On reads from any model, any field named `content` that looks like an
  //   encrypted payload is decrypted back into plain text.
  client.$use(async (params, next) => {
    // Encrypt Message.content on write
    if (params.model === 'Message') {
      const action = params.action;

      if (action === 'create' || action === 'update' || action === 'upsert') {
        if (params.args && params.args.data) {
          params.args.data = encryptMessageContent(params.args.data);
        }
      } else if (action === 'createMany') {
        if (params.args && Array.isArray(params.args.data)) {
          params.args.data = params.args.data.map((row) => encryptMessageContent(row));
        }
      } else if (action === 'updateMany') {
        if (params.args && params.args.data) {
          params.args.data = encryptMessageContent(params.args.data);
        }
      }
    }

    const result = await next(params);

    // Decrypt Message.content on read (including nested relations such as
    // Conversation.include({ messages: { select: { content: true } } })).
    if (result == null) return result;
    return decryptMessageContentDeep(result);
  });

  global._asrarPrisma = client;
}
prisma = global._asrarPrisma;

module.exports = prisma;

function encryptMessageContent(data) {
  if (!data || typeof data !== 'object') return data;

  // Shallow clone so we don't mutate caller-owned objects.
  const copy = { ...data };

  if (typeof copy.content === 'string' && copy.content) {
    // Avoid double-encrypting rows that are already in the enc:: format.
    if (!copy.content.startsWith('enc::')) {
      try {
        copy.content = encryptMessage(copy.content);
      } catch (err) {
        // Do not log plaintext. Propagate so callers can fail fast.
        throw err;
      }
    }
  }

  return copy;
}

function decryptMessageContentDeep(value) {
  if (value == null) return value;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = decryptMessageContentDeep(value[i]);
    }
    return value;
  }

  if (typeof value === 'object') {
    // If this object has a `content` field, try to decrypt it. The helper is
    // backward compatible: legacy plain text (no enc:: prefix) is returned
    // as-is without requiring the key or throwing.
    if (typeof value.content === 'string') {
      try {
        value.content = decryptMessage(value.content);
      } catch (err) {
        // On decryption failure, keep the stored value so callers still receive
        // something, and only log a non-sensitive error message.
        console.error(
          '[Prisma][MessageEncryption] Failed to decrypt message content:',
          err && err.message ? err.message : err
        );
      }
    }

    for (const key of Object.keys(value)) {
      const child = value[key];
      if (child && (typeof child === 'object' || Array.isArray(child))) {
        value[key] = decryptMessageContentDeep(child);
      }
    }

    return value;
  }

  return value;
}
