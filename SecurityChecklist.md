# Asrar AI Security Checklist

This checklist summarizes the current security posture of the Asrar AI application and the concrete hardening steps that were implemented.

---

## 1. Authentication & Sessions

- **HttpOnly auth cookie**
  - Backend uses a `token` cookie for authentication, set as `HttpOnly`.
  - In production (`RENDER=true` or `NODE_ENV=production`), cookies are also set with `Secure` and `SameSite='none'` and can be scoped by `COOKIE_DOMAIN`.
  - Logout clears the same cookie using consistent options.

- **Password handling**
  - User passwords are never logged.
  - Passwords are hashed using `bcryptjs` before storage.
  - Password change endpoint re-checks the current password before accepting a new one.

- **Auth middleware**
  - All sensitive routes (chat, user, admin, billing, etc.) are protected by `requireAuth`, which verifies the JWT from the cookie (and optionally bearer) and attaches `req.user`.

---

## 2. Authorization & Admin Controls

- **Central admin email configuration (backend)**
  - New helper in `server/src/middleware/requireAdmin.js`:
    - `DEFAULT_ADMIN_EMAIL` remains `zaynzayn9696@gmail.com` for backwards compatibility.
    - `ADMIN_EMAILS` is derived from `process.env.ADMIN_EMAILS` or `process.env.ADMIN_EMAIL` (comma-separated list, case-insensitive).
    - `isAdminEmail(email)` normalizes and checks membership against the configured list.
  - `requireAdmin` now uses `isAdminEmail` and fails closed (403) when no match.
  - All admin routes (`server/src/routes/admin.js`) use `requireAuth` + `requireAdmin`, and any additional inline checks now delegate to `isAdminEmail` instead of hardcoded strings.

- **Central admin email configuration (frontend)**
  - `src/App.jsx`:
    - Introduces `DEFAULT_ADMIN_EMAIL`, `RAW_ADMIN_EMAILS`, and `ADMIN_EMAILS` derived from `VITE_ADMIN_EMAILS` or `VITE_ADMIN_EMAIL` (comma-separated, case-insensitive).
    - `AdminRoute` now checks `ADMIN_EMAILS.includes(user.email.toLowerCase())` instead of a hardcoded email.
  - `src/AsrarHeader.jsx`:
    - Uses the same `ADMIN_EMAILS` logic to decide whether to show the Admin navigation link.
  - **Effect:** Admin access is controlled by env configuration on both backend and frontend. Changing the admin(s) no longer requires code edits.

- **Premium tester email**
  - `server/src/config/limits.js` uses `PREMIUM_TESTER_EMAIL` (env-backed, with a default) to grant higher usage limits to a tester account.
  - This does *not* grant admin privileges; it only affects rate limits.

---

## 3. Data Protection & Encryption

- **Message content encryption**
  - Prisma middleware (`prisma.js`) automatically encrypts `Message.content` on write and decrypts on read, so sensitive conversation text is not stored in plaintext.
  - Encryption and decryption logic runs transparently for all Prisma operations involving `content` fields.

- **Exports and data access**
  - User data export endpoint returns only the authenticated user’s data and messages, already decrypted by Prisma middleware.
  - Account deletion endpoint removes user records and associated messages/usage in a transaction and attempts best-effort avatar file cleanup.

---

## 4. Logging Practices

- **No logging of message content**
  - Chat routes and emotional engine services are designed not to log raw user message text, prompts, or model replies.
  - Identifiers (user IDs, conversation IDs) and timing/metrics are used instead.

- **Debug log cleanup**
  - `server/src/routes/chat.js`:
    - Removed debug logs like `"[DEBUG] prisma in chat.js type:"` and repeated `"[CONVO CREATED]"` logs that could be noisy.
    - Retained only operational logs that reference IDs and counts (e.g. delete-all operations) and high-level error logs via `console.error`.

- **Billing logging reduction**
  - `server/src/routes/billing.js`:
    - The LemonSqueezy checkout request log remains, but the response logging is now limited to `status` and `length` of the response body.
    - The full response body is no longer printed to logs, reducing the risk of leaking PII or payment-adjacent data.

- **Error logging**
  - Error logs generally capture error messages and stack traces but avoid including sensitive user content.

---

## 5. File Upload Security

### 5.1 Avatar / photo uploads (user profile)

- **Storage path**
  - Avatars are stored under `server/uploads` with sanitized filenames and restricted extensions (`.jpg`, `.jpeg`, `.png`, `.webp`), defaulting to `.jpg`.

- **Hardened MIME-type filter (fail-closed)**
  - `server/src/routes/user.js` now:
    - Maintains an explicit allowlist of image MIME types: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`.
    - Normalizes common HEIC/HEIF cases from mobile devices to `image/jpeg` based on filename.
    - Rejects any file whose MIME type is missing or does not start with `image/`.
    - Rejects any image whose MIME type is not in the allowlist.
    - On any exception in the filter, the upload is rejected rather than allowed.
  - **Effect:** The avatar upload middleware now fails closed instead of allowing unknown/erroneous types, reducing the risk of arbitrary file uploads.

### 5.2 Audio uploads (voice chat)

- **Storage path**
  - Voice recordings are stored under `server/uploads/voice` with sanitized filenames.

- **Audio MIME-type allowlist**
  - Voice upload filter allows only specific audio types: `audio/webm`, `audio/ogg`, `audio/mpeg`, `audio/wav`, `audio/mp4`, `audio/aac`.
  - Non-allowed MIME types are rejected with an error.

---

## 6. Usage Limits & Abuse Mitigation

- **Per-user usage tracking**
  - `ensureUsage` creates or updates a per-user usage record, with daily and monthly counts and reset timestamps.

- **Plan-based limits**
  - `getPlanLimits` computes daily/monthly limits based on plan (`free`, `pro`, `premium`) and tester status.
  - Chat routes check plan limits and return `429` with structured error payload when limits are exceeded.

- **Premium-only features**
  - Voice chat is gated behind premium plans or tester status; non-premium users receive a structured `403` with explicit error code.

---

## 7. Frontend Security Posture

- **No dangerous HTML rendering**
  - Reviewed key components (`ChatPage`, `Dashboard`, `Settings`, `AdminDashboard`, `LoginPage`) do not use `dangerouslySetInnerHTML` and render user/content data as plain text.

- **Auth state handling**
  - `useAuth` manages auth state and loads the current user from `/api/auth/me`.
  - Frontend generally relies on HttpOnly cookies for session state (no JWT is exposed to JS unless explicitly stored for legacy reasons).

- **Admin UI protections**
  - Admin routes on the client (`/admin` route and Admin link in header) now honor the same configurable admin email list via `VITE_ADMIN_EMAILS` / `VITE_ADMIN_EMAIL`.
  - This complements, but does not replace, backend enforcement.

---

## 8. Configuration & Secrets

- **Environment-driven configuration**
  - API base URL on the frontend is configured via `VITE_API_BASE_URL`.
  - Admin emails are configured via:
    - Backend: `ADMIN_EMAILS` (comma-separated) or `ADMIN_EMAIL`.
    - Frontend: `VITE_ADMIN_EMAILS` (comma-separated) or `VITE_ADMIN_EMAIL`.
  - LemonSqueezy billing is configured via `API_KEY`, `WEBHOOK_SECRET`, `STORE_ID`, `VARIANT_ID`, and `FRONTEND_URL`.
  - Message encryption uses `MESSAGE_ENCRYPTION_KEY` (symmetric key) for Prisma middleware.

- **Secrets handling**
  - API keys and encryption keys are expected to be provided via environment variables and not committed to source control.

---

## 9. Recommended Operational Practices

These are process-level recommendations, not enforced by code:

- **Log management**
  - Route logs through a central logging system and restrict access to logs.
  - Periodically review logs for unexpected sensitive content; tighten logging further if needed.

- **Environment configuration**
  - Set `ADMIN_EMAILS` / `VITE_ADMIN_EMAILS` in production to the current admin list and avoid relying on the default email.
  - Set `PREMIUM_TESTER_EMAIL` only in staging or controlled testing environments.

- **Key rotation**
  - Rotate `MESSAGE_ENCRYPTION_KEY`, JWT signing secrets, and billing API keys according to your security policy.

- **Backups and retention**
  - Align DB backups and message retention with your privacy policy. The manual retention endpoint can help prune old messages.

- **Security reviews**
  - Re-run this checklist after major feature additions (new routes, new upload types, new integrations) and periodically review third-party dependencies for vulnerabilities.
