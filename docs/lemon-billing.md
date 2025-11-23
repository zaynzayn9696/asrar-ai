# LemonSqueezy Premium Billing – Implementation Summary

This file summarizes the changes to add Premium subscriptions via LemonSqueezy and how to switch from test to live.

## Files changed/added (server)
- server/prisma/schema.prisma
  - Added fields to `User`:
    - `isPremium Boolean @default(false)` (already present)
    - `lemonCustomerId String? @unique`
    - `lemonSubscriptionId String?`
- server/src/utils/lemonConfig.js (new)
  - Centralized Lemon env selection:
    - `LEMON_MODE` ("test" or "live") → picks API key & webhook secret.
    - `STORE_ID`, `VARIANT_ID` from env.
- server/src/index.js
  - Added `express.json({ verify })` hook to capture `req.rawBody` only for `/api/billing/webhook` to verify signatures.
- server/src/routes/billing.js
  - `POST /api/billing/webhook` (public): verifies `X-Signature` (HMAC-SHA256) and handles subscription events to set `isPremium` and store `lemonCustomerId` / `lemonSubscriptionId`.
  - `POST /api/billing/create-checkout` (auth): creates a Lemon checkout with `checkout_data.email` and `custom: { app_user_id: <user.id> }`, and redirects back to `FRONTEND_URL/dashboard?billing=success`.
- server/src/routes/auth.js
  - `/api/auth/me` now includes `isPremium`, `lemonCustomerId`, `lemonSubscriptionId` in the response.
- server/src/routes/admin.js
  - `/api/admin/stats` now includes `premiumUsersCount`.

## Files changed/added (frontend)
- src/api/billing.js (new)
  - `createCheckoutSession()` calling `/api/billing/create-checkout` with `credentials: "include"`.
- src/Dashboard.jsx
  - Shows an "Upgrade to Premium" button when not premium.
  - On click → calls `createCheckoutSession()` and redirects to Lemon checkout.
  - On return with `?billing=success` → refreshes `/api/auth/me`, shows success banner, and cleans the URL.
  - Character locking: Hana always free, others locked when not premium. Clicking a locked character opens a small modal with an Upgrade CTA.

## Environment variables (already provided)
- LEMON_MODE=test | live
- LEMON_TEST_API_KEY, LEMON_TEST_WEBHOOK_SECRET
- LEMON_LIVE_API_KEY, LEMON_LIVE_WEBHOOK_SECRET
- LEMON_STORE_ID, LEMON_VARIANT_ID
- FRONTEND_URL, BACKEND_URL

## Switch from TEST to LIVE
1) In the backend environment:
   - Set `LEMON_MODE=live`.
   - Set `LEMON_LIVE_API_KEY` and `LEMON_LIVE_WEBHOOK_SECRET` to the live values from LemonSqueezy.
2) Ensure your LemonSqueezy dashboard webhook for the Store points to:
   - `POST {BACKEND_URL}/api/billing/webhook`
3) Ensure the product variant ID and store ID are live values:
   - `LEMON_STORE_ID`, `LEMON_VARIANT_ID`.

## Prisma migration commands
- Run (in server/):
  - `npx prisma migrate dev --name add_lemon_fields`
  - `npx prisma generate`

## Notes
- Webhook signature verification uses the raw request body and `X-Signature` (hex HMAC-SHA256).
- We log event name and key IDs for debugging, without secrets.
- Existing auth flows are unchanged (login/register/Google). Premium is determined by `isPremium` (or legacy `plan === 'pro'` for backwards compat in the UI).

### About the migration provider switch
Previous migrations were authored for `sqlite`, but the current datasource is `postgresql` (Neon). Prisma requires re-initializing migration history when switching providers. To keep things clean and aligned with the actual database, I:
- Backed up the old sqlite migrations directory.
- Created a Postgres baseline migration (`init_postgres`).
- Re-applied the Lemon fields in a follow-up migration.

Because Prisma detected historical drift (a prior mismatched migration), it prompted to reset the `public` schema to synchronize state. This was applied to the development database only. If you have production data, do not follow this procedure there—use a carefully planned SQL migration instead.
