// server/scripts/encrypt_legacy_messages.js
// One-time migration script to encrypt legacy Message.content rows that are still plain text.
//
// How to run:
//   1) Ensure server/.env has a valid MESSAGE_ENCRYPTION_KEY (32-byte key, hex or base64).
//   2) From the project root (same level as `server/`), run:
//        node server/scripts/encrypt_legacy_messages.js
//   3) The script will ask for confirmation before modifying any data.
//
// Notes:
//   - Uses the same Prisma client and AES-256-GCM encryptText() logic as the main app.
//   - Only touches rows where Message.content does NOT start with "enc::".
//   - Safe to re-run; already-encrypted rows are skipped by the WHERE clause.

const path = require("path");
const readline = require("readline");

// Load env from server/.env so MESSAGE_ENCRYPTION_KEY is available BEFORE prisma is required
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// This prisma instance has the encryption middleware attached
const prisma = require("../src/prisma");

async function askForConfirmation() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q) =>
    new Promise((resolve) => {
      rl.question(q, (answer) => resolve(answer));
    });

  const answer = await question(
    "Are you sure you want to encrypt legacy messages? This cannot be easily undone. (yes/no): "
  );
  rl.close();

  const normalized = String(answer || "").trim().toLowerCase();
  return normalized === "yes" || normalized === "y";
}

async function run() {
  console.log("[Migration] Starting legacy message encryption script...");

  const confirmed = await askForConfirmation();
  if (!confirmed) {
    console.log("[Migration] Aborted by user.");
    return;
  }

  const batchSize = 100;
  let totalProcessed = 0;

  // We rely on the Prisma middleware to perform encryption on write.
  // This script simply finds rows whose content DOES NOT start with "enc::"
  // and re-saves the same content value, triggering encryption in the middleware.
  while (true) {
    const legacyMessages = await prisma.message.findMany({
      where: {
        NOT: {
          content: {
            startsWith: "enc::",
          },
        },
      },
      orderBy: { id: "asc" },
      take: batchSize,
    });

    if (!legacyMessages.length) {
      break;
    }

    console.log(`{[Migration]} Found ${legacyMessages.length} legacy messages in this batch...`);

    for (const msg of legacyMessages) {
      try {
        await prisma.message.update({
          where: { id: msg.id },
          data: {
            // This value is currently plain text (or at least not prefixed with enc::).
            // Prisma middleware will encrypt it using encryptText() before persisting.
            content: msg.content,
          },
        });
        totalProcessed += 1;
      } catch (err) {
        // Log and continue; do not abort whole migration due to a single bad row.
        console.error(
          `[Migration] Failed to encrypt message id=${msg.id}:`,
          err && err.message ? err.message : err
        );
      }
    }
  }

  console.log(`[Migration] Completed. Total messages encrypted: ${totalProcessed}.`);
}

run()
  .catch((err) => {
    console.error("[Migration] Unexpected error:", err && err.message ? err.message : err);
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch (_) {}
  });
