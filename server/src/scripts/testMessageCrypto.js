// server/src/scripts/testMessageCrypto.js
// Dev-only sanity check for message encryption round-trip.
//
// How to run (from project root):
//   node server/src/scripts/testMessageCrypto.js
//
// Requires: MESSAGE_ENCRYPTION_KEY in server/.env (any string; will be
// converted to a 32-byte AES-256 key via SHA-256 if not a raw key).

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { encryptMessage, decryptMessage } = require('../utils/crypto');

function assertEqual(label, a, b) {
  if (a !== b) {
    console.error(`[FAIL] ${label}:`, { expected: a, got: b });
    process.exitCode = 1;
  } else {
    console.log(`[OK] ${label}`);
  }
}

function run() {
  const sample = 'This is a secret test message with Arabic: مرحباً بالعالم';

  console.log('[Test] MESSAGE_ENCRYPTION_KEY set?', !!process.env.MESSAGE_ENCRYPTION_KEY);

  const encrypted = encryptMessage(sample);
  console.log('[Test] Encrypted payload sample (truncated):', String(encrypted).slice(0, 60) + '...');

  const decrypted = decryptMessage(encrypted);
  assertEqual('Round-trip decrypt equals original', sample, decrypted);

  const legacy = 'legacy-plain-text-message';
  const legacyOut = decryptMessage(legacy);
  assertEqual('Legacy plaintext passes through decryptMessage unchanged', legacy, legacyOut);

  console.log('[Test] Message crypto sanity checks completed.');
}

run();
