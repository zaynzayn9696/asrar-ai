import posthog from 'posthog-js';

export function initPostHog() {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    person_profiles: 'identified_only', // change to "always" if you want anonymous profiles
    capture_pageview: true,
    autocapture: true,
  });
}

export default posthog;
