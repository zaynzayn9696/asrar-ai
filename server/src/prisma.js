const { PrismaClient } = require('@prisma/client');

let prisma;

/**
 * Singleton Prisma client for the whole server.
 * This file MUST export the actual PrismaClient instance directly.
 */
if (!global._asrarPrisma) {
  global._asrarPrisma = new PrismaClient();
}
prisma = global._asrarPrisma;

module.exports = prisma;
