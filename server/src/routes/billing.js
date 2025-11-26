const express = require('express');
const crypto = require('node:crypto');
const prisma = require('../prisma');
const requireAuth = require('../middleware/requireAuth');
const { API_KEY, WEBHOOK_SECRET, STORE_ID, VARIANT_ID, isLive } = require('../utils/lemonConfig');

const router = express.Router();

// ---------- WEBHOOK (PUBLIC) ----------
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.get('X-Signature') || req.get('x-signature');
    const eventName = req.get('X-Event-Name') || req.get('x-event-name') || '';
    const raw = req.rawBody || (req.body ? JSON.stringify(req.body) : '');

    if (!signature || !WEBHOOK_SECRET) {
      return res.status(400).send('Missing signature or webhook secret');
    }

    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    hmac.update(raw);
    const digest = hmac.digest('hex');

    const a = Buffer.from(digest, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).send('Invalid signature');
    }

    const payload = req.body || {};
    const meta = payload.meta || {};
    const data = payload.data || {};
    const attrs = (data && data.attributes) || {};

    // Clear log for incoming webhook
    try {
      console.log("[Billing] Webhook received:", {
        eventName: attrs?.event_name,
        eventType: data?.type,
        objectType: attrs?.billable_type,
        billableId: attrs?.billable_id,
      });
    } catch (_) {}

    // Determine subscription event + status
    const eventNameBody = attrs?.event_name || '';
    const subscriptionStatus = attrs?.status || '';
    const isSubscriptionEvent = !!eventNameBody && eventNameBody.startsWith('subscription_');
    const isActiveStatus = ['active', 'on_trial'].includes(String(subscriptionStatus));
    const isInactiveStatus = ['canceled', 'expired', 'past_due', 'unpaid'].includes(String(subscriptionStatus));

    // Only proceed for subscription-related events
    if (isSubscriptionEvent || data?.type === 'subscriptions') {
      // Try to locate app_user_id from several possible locations
      const checkoutData = attrs?.checkout_data || {};
      const customA = checkoutData?.custom || {};
      const customB = checkoutData?.custom_data || {};
      const customMeta = meta?.custom_data || meta?.custom || {};
      const appUserIdRaw =
        customA.app_user_id ?? customB.app_user_id ?? customMeta.app_user_id ?? customMeta.user_id ?? null;

      const customerEmail = (attrs?.user_email || attrs?.customer_email || '').toLowerCase();

      let user = null;
      if (appUserIdRaw != null && appUserIdRaw !== '') {
        const parsed = parseInt(String(appUserIdRaw), 10);
        if (!Number.isNaN(parsed)) {
          user = await prisma.user.findUnique({ where: { id: parsed } });
        }
      }
      if (!user && customerEmail) {
        user = await prisma.user.findUnique({ where: { email: customerEmail } });
      }

      if (!user) {
        console.warn('[Billing] No matching user for webhook', {
          appUserId: appUserIdRaw,
          customerEmail,
          eventName: eventNameBody,
          status: subscriptionStatus,
        });
        return res.status(200).json({ received: true });
      }

      // Extract Lemon IDs
      const lemonCustomerId = attrs?.customer_id != null ? String(attrs.customer_id) : '';
      const lemonSubscriptionId = data?.id ? String(data.id) : (attrs?.subscription_id != null ? String(attrs.subscription_id) : '');

      if (isActiveStatus) {
        console.log('[Billing] Marking user as PREMIUM', {
          userId: user.id,
          lemonCustomerId,
          lemonSubscriptionId,
          subscriptionStatus,
        });
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isPremium: true,
            plan: 'premium',
            lemonCustomerId: lemonCustomerId || user.lemonCustomerId,
            lemonSubscriptionId: lemonSubscriptionId || user.lemonSubscriptionId,
          },
        });
        try {
          await prisma.usage.upsert({
            where: { userId: user.id },
            update: { monthlyCount: 0 },
            create: {
              userId: user.id,
              dailyCount: 0,
              monthlyCount: 0,
            },
          });
        } catch (_) {}
      } else if (isInactiveStatus) {
        console.log('[Billing] Marking user as FREE', {
          userId: user.id,
          subscriptionStatus,
        });
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isPremium: false,
            plan: 'free',
          },
        });
        // No DB write needed for limits; limits are derived per plan.
      }

      return res.status(200).json({ received: true });
    }

    // Not a subscription event: acknowledge
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[lemon-webhook] error:', err && err.message ? err.message : err);
    return res.status(500).send('error');
  }
});

// Protect routes below
router.use(requireAuth);

// Ensure fetch exists (Render should be Node 18+, but guard anyway)
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// ---------- CREATE CHECKOUT ----------
router.post('/create-checkout', async (req, res) => {
  try {
    console.log('[Billing] /create-checkout hit');

    const user = req.user;
    console.log('[Billing] user from auth', {
      id: user?.id,
      email: user?.email,
    });

    if (!user || !user.email) {
      console.error('[Billing] No authenticated user');
      return res.status(401).json({ error: 'Not authenticated (no token cookie or bearer)' });
    }

    console.log('[Billing] Lemon config', {
      hasApiKey: !!API_KEY,
      hasStoreId: !!STORE_ID,
      hasVariantId: !!VARIANT_ID,
      storeId: STORE_ID,
      variantId: VARIANT_ID,
    });

    if (!API_KEY || !STORE_ID || !VARIANT_ID) {
      console.error('[Billing] Missing LemonSqueezy env vars');
      return res.status(500).json({ error: 'LemonSqueezy not configured' });
    }

    const payload = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: user.email,
            custom: { app_user_id: String(user.id) },
          },
          product_options: {
            redirect_url: `${process.env.FRONTEND_URL}/dashboard?billing=success`,
          },
        },
        relationships: {
          store: { data: { type: 'stores', id: String(STORE_ID) } },
          variant: { data: { type: 'variants', id: String(VARIANT_ID) } },
        },
      },
    };

    console.log('[Billing] Sending request to LemonSqueezy', {
      url: 'https://api.lemonsqueezy.com/v1/checkouts',
      mode: isLive ? 'live' : 'test',
      body: payload,
    });

    const lsRes = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
      },
      body: JSON.stringify(payload),
    });

    const text = await lsRes.text();
    console.log('[Billing] LemonSqueezy response', lsRes.status, text);

    if (!lsRes.ok) {
      return res.status(500).json({
        error: 'LemonSqueezy error',
        status: lsRes.status,
        detail: text,
      });
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error('[Billing] Failed to parse LemonSqueezy JSON', e);
      return res.status(500).json({
        error: 'Invalid response from LemonSqueezy',
        raw: text,
      });
    }

    const url = json?.data?.attributes?.url;
    if (!url) {
      console.error('[Billing] No checkout URL in response', json);
      return res.status(500).json({
        error: 'No checkout URL returned',
        raw: json,
      });
    }

    console.log('[Billing] Checkout URL created', url);
    return res.json({ url });
  } catch (err) {
    console.error('[Billing] create-checkout error', err);
    return res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// ---------- SUBSCRIPTION DETAIL ----------
router.get('/subscription', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(401).json({ message: 'User not found' });
    const subId = user.lemonSubscriptionId ? String(user.lemonSubscriptionId) : '';
    if (!subId) {
      return res.json({ status: 'free' });
    }

    if (!API_KEY) {
      return res.status(500).json({ message: 'LemonSqueezy not configured' });
    }

    const url = `https://api.lemonsqueezy.com/v1/subscriptions/${subId}`;
    const lsRes = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: 'application/vnd.api+json',
      },
    });
    const text = await lsRes.text();
    if (!lsRes.ok) {
      return res.status(500).json({ message: 'Failed to fetch subscription', status: lsRes.status, detail: text });
    }
    let json;
    try { json = JSON.parse(text); } catch (_) { json = null; }
    const attrs = json?.data?.attributes || {};
    const status = String(attrs?.status || 'unknown');
    const cancelled = !!attrs?.cancelled || status === 'canceled' || status === 'cancelled';
    const renewsAt = attrs?.renews_at || null;
    const endsAt = attrs?.ends_at || null;
    const currentPeriodEnd = attrs?.current_period_end || null;
    const nextRenewal = cancelled ? (endsAt || currentPeriodEnd || null) : (renewsAt || currentPeriodEnd || null);
    return res.json({
      id: subId,
      status,
      cancelled,
      renewsAt,
      endsAt,
      nextRenewal,
      mode: isLive ? 'live' : 'test',
    });
  } catch (err) {
    console.error('[Billing] subscription fetch error', err?.message || err);
    return res.status(500).json({ message: 'Failed to load subscription' });
  }
});

// ---------- CANCEL AT PERIOD END ----------
router.post('/cancel', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(401).json({ message: 'User not found' });
    const subId = user.lemonSubscriptionId ? String(user.lemonSubscriptionId) : '';
    if (!subId) {
      return res.status(400).json({ message: 'No active subscription to cancel' });
    }
    if (!API_KEY) {
      return res.status(500).json({ message: 'LemonSqueezy not configured' });
    }
    const url = `https://api.lemonsqueezy.com/v1/subscriptions/${subId}/cancel`;
    const lsRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: 'application/vnd.api+json',
      },
    });
    const text = await lsRes.text();
    if (!lsRes.ok) {
      return res.status(500).json({ message: 'Failed to cancel subscription', status: lsRes.status, detail: text });
    }
    let json;
    try { json = JSON.parse(text); } catch (_) { json = null; }
    const attrs = json?.data?.attributes || {};
    const status = String(attrs?.status || 'unknown');
    const cancelled = !!attrs?.cancelled || status === 'canceled' || status === 'cancelled';
    const renewsAt = attrs?.renews_at || null;
    const endsAt = attrs?.ends_at || null;
    const currentPeriodEnd = attrs?.current_period_end || null;
    const nextRenewal = cancelled ? (endsAt || currentPeriodEnd || null) : (renewsAt || currentPeriodEnd || null);

    // We keep user.plan/isPremium unchanged until webhook downgrades on actual end.
    return res.json({
      id: subId,
      status,
      cancelled,
      renewsAt,
      endsAt,
      nextRenewal,
      mode: isLive ? 'live' : 'test',
    });
  } catch (err) {
    console.error('[Billing] cancel error', err?.message || err);
    return res.status(500).json({ message: 'Failed to cancel subscription' });
  }
});

// ---------- TEST (AUTH) ----------
router.get('/test', (req, res) => {
  res.json({
    ok: true,
    message: 'Billing is protected and working',
    userId: req.user.id,
  });
});

module.exports = router;
