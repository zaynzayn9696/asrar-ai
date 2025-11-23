const express = require('express');
const crypto = require('node:crypto');
const prisma = require('../prisma');
const requireAuth = require('../middleware/requireAuth');
const { API_KEY, WEBHOOK_SECRET, STORE_ID, VARIANT_ID } = require('../utils/lemonConfig');

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

    console.log('[lemon-webhook] event:', eventName, 'subId:', data?.id, 'status:', attrs?.status);

    // Handle subscription lifecycle
    if (data?.type === 'subscriptions' || String(eventName).startsWith('subscription_')) {
      const subId = data?.id ? String(data.id) : null;
      const customerId = attrs?.customer_id != null ? String(attrs.customer_id) : null;
      const status = attrs?.status || '';

      const custom = meta?.custom_data || {};
      const appUserIdRaw = custom.app_user_id ?? custom.user_id;
      const userEmail = (attrs?.user_email || '').toLowerCase();

      let user = null;
      if (appUserIdRaw != null && appUserIdRaw !== '') {
        const parsed = Number(appUserIdRaw);
        if (Number.isFinite(parsed)) {
          user = await prisma.user.findUnique({ where: { id: parsed } });
        }
      }
      if (!user && userEmail) {
        user = await prisma.user.findUnique({ where: { email: userEmail } });
      }

      if (!user) {
        console.warn('[lemon-webhook] user not found for event', {
          eventName,
          appUserIdRaw,
          userEmail,
        });
        return res.status(200).send('ok');
      }

      const eventActive = ['subscription_created', 'subscription_resumed', 'subscription_updated'].includes(eventName);
      const eventCancelled = ['subscription_cancelled', 'subscription_expired', 'subscription_paused', 'subscription_unpaid', 'subscription_past_due'].includes(eventName);
      let isPremium = user.isPremium;
      if (eventActive) {
        isPremium = true;
      } else if (eventCancelled) {
        isPremium = false;
      } else if (status) {
        isPremium = ['active', 'on_trial'].includes(status);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          isPremium,
          lemonCustomerId: customerId,
          lemonSubscriptionId: subId,
        },
      });
    }

    return res.status(200).send('ok');
  } catch (err) {
    console.error('[lemon-webhook] error:', err && err.message ? err.message : err);
    return res.status(500).send('error');
  }
});

// Protect routes below
router.use(requireAuth);

// ---------- CREATE CHECKOUT ----------
router.post('/create-checkout', async (req, res) => {
  try {
    if (!API_KEY || !STORE_ID || !VARIANT_ID) {
      console.warn('[billing/create-checkout] Missing Lemon env vars');
      return res.status(500).json({ message: 'Billing not configured' });
    }

    const email = req.user?.email;
    const appUserId = req.user?.id;

    const body = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: email || '',
            custom: { app_user_id: appUserId },
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

    const r = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const json = await r.json().catch(() => null);
    if (!r.ok) {
      console.error('[billing/create-checkout] Lemon error', r.status, json);
      return res.status(500).json({ message: 'Failed to create checkout' });
    }

    const url = json?.data?.attributes?.url;
    if (!url) {
      console.error('[billing/create-checkout] No URL in Lemon response', json);
      return res.status(500).json({ message: 'Invalid Lemon response' });
    }

    return res.json({ url });
  } catch (err) {
    console.error('[billing/create-checkout] error', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Internal server error' });
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
