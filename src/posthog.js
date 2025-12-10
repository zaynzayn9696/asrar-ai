import posthog from 'posthog-js';

export function initPostHog() {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',

    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    person_profiles: 'identified_only',
  });

  // expose globally (important for debugging)
  window.posthog = posthog;
}
