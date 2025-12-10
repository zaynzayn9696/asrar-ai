import posthog from 'posthog-js';

export function initPostHog() {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',

    // ⭐ Enable Web Analytics
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,

    // optional but recommended
    person_profiles: 'identified_only',
  });

  window.posthog = posthog;
}
