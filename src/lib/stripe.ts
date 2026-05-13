// Stripe SDK singleton (Sprint X.2 — Booking V1)
//
// Pattern Next.js : un seul Stripe() global pour réutiliser le keep-alive
// HTTP côté server runtime (Hetzner CPX32 — éviter de re-handshake TLS sur
// chaque action).
//
// SOURCE :
//   - ADR 0013 : Stripe Checkout V1 + mode hybride manuel
//   - 03-ARCHITECTURE-CIBLE §5.2 + 04-PLAN-EXECUTION Sprint X.2
//
// SECURITÉ :
//   - `STRIPE_SECRET_KEY` est server-only (jamais exposée client)
//   - `apiVersion` figée → upgrade explicit + ADR avant bump (event shape change)
//
// CONTEXTE :
//   - Server-only import. Pas de variante client (publishable key utilisée
//     via NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY directement côté composant).
//   - Stripe Node SDK v22+ (CommonJS, fonctionne en Server Action + Route Handler).

import Stripe from "stripe";

const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined;
};

/**
 * Version API Stripe figée. Bump = ADR explicit + revue webhook event shapes.
 * Stripe pousse parfois des breaking changes sur les events ; on contrôle.
 */
export const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

function createStripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) {
    // En dev : pas de clé = on no-op au lieu de crasher au boot.
    // Le code qui utilise `stripe` doit gérer l'absence via `isStripeConfigured()`.
    // En prod : la clé doit être présente, sinon explicit fail à l'usage.
    throw new Error(
      "STRIPE_SECRET_KEY manquant. Configurer via .env (dev) ou Coolify env vars (prod).",
    );
  }
  return new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    appInfo: {
      name: "Axion-IA",
      url: "https://axion-ia.com",
    },
  });
}

/**
 * Singleton Stripe — appelle createStripe() au premier accès uniquement.
 * Throw si STRIPE_SECRET_KEY manquant (intentionnel : on veut détecter au
 * premier appel paiement, pas crasher tout le boot).
 */
export function getStripe(): Stripe {
  if (!globalForStripe.stripe) {
    globalForStripe.stripe = createStripe();
  }
  return globalForStripe.stripe;
}

/**
 * Helper pour gates : true si Stripe est configuré et utilisable.
 * Utilisé par les Server Actions pour fallback en mode manuel hybride
 * (ADR 0013 : si Stripe indispo, admin saisit paiement hors-Stripe).
 */
export function isStripeConfigured(): boolean {
  return Boolean(process.env["STRIPE_SECRET_KEY"]);
}

/**
 * Secret webhook (différent de la clé API). Utilisé par
 * `stripe.webhooks.constructEvent(rawBody, sig, secret)` dans le route handler.
 */
export function getWebhookSecret(): string {
  const s = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!s) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET manquant. Configurer côté Stripe Dashboard puis Coolify env vars.",
    );
  }
  return s;
}
