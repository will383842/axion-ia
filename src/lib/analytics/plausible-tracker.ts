// Plausible custom-event tracker — helper pur (no JSX, no React).
//
// Extrait de `src/components/analytics/Plausible.tsx` pour respecter
// la frontière module : `src/lib/**` ne doit pas importer depuis
// `src/components/**`. Voir doctrine `no-restricted-imports`
// (eslint.config.mjs A3.2). Le composant `<Plausible />` re-export
// ce helper pour préserver l'API publique historique.

/**
 * Track event custom Plausible côté client.
 * Usage : trackEvent("Booking Submitted", { props: { intervention: "audit" } });
 */
export function trackEvent(
  name: string,
  options?: { props?: Record<string, string | number> },
): void {
  if (typeof window === "undefined") return;
  const plausible = (window as unknown as { plausible?: (n: string, o?: unknown) => void })
    .plausible;
  if (typeof plausible === "function") {
    plausible(name, options);
  }
}
