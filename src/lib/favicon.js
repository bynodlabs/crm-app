export const FAVICON_PULSE_EVENT = 'crm:favicon-pulse';

export function triggerFaviconPulse(durationMs = 3000) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent(FAVICON_PULSE_EVENT, {
      detail: { durationMs },
    }),
  );
}
