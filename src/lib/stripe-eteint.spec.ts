/**
 * Stripe est ÉTEINT — et doit l'être dans les trois sens.
 *
 * Audit de bout en bout du 2026-08-04. L'intégration est doublement dormante :
 * le flux de réservation payante qu'elle servait a été remplacé par Calendly,
 * et `isStripeConfigured()` renvoie false tant que `STRIPE_ENABLED` n'est pas
 * posé — il ne l'est pas en production. Vérifié en base : 0 ligne dans
 * `payments`, `bookings`, `stripe_webhook_events`. Rien n'a jamais transité.
 *
 * Mais « éteint » se disait alors dans un seul sens : rien ne SORTAIT, tout
 * pouvait ENTRER. Ces cas verrouillent les trois surfaces qui doivent rester
 * cohérentes entre elles :
 *
 *   1. le code           — sortant ET entrant gardés par le même drapeau
 *   2. la CSP            — pas d'origine autorisée pour une intégration éteinte
 *   3. la notice RGPD    — pas de sous-traitant déclaré actif s'il ne traite rien
 *
 * Elles sont pilotées par des mécanismes différents (drapeau d'env, en-tête
 * HTTP, contenu statique) : rien ne les tient ensemble sinon ce fichier.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCspHeader } from "./csp";
import { SUBPROCESSORS } from "@/content/subprocessors";

const RACINE = process.cwd();
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");

describe("1. aucune surface Stripe entrante ni sortante n'existe", () => {
  /**
   * Suppression du système booking (2026-08-26) : la route webhook, la
   * création de session Checkout (`features/payment/actions.ts`) et les
   * remboursements (`features/booking/refund-actions.ts`) sont SUPPRIMÉS,
   * plus seulement gardés par `isStripeConfigured()`. Ces cas verrouillent
   * l'absence : les réintroduire exige de repasser par une décision explicite
   * (et de re-gater CSP + notice RGPD dans le même mouvement).
   *
   * Aucun encaissement Stripe Qualiopi n'existe (paiements manuels) — la
   * suppression ne perd rien.
   */
  it("la route webhook n'existe plus", () => {
    expect(
      existsSync(join(RACINE, "src/app/api/stripe")),
      "src/app/api/stripe est réapparu : la surface entrante Stripe a été " +
        "supprimée avec le système booking (2026-08-26). La réintroduire " +
        "exige une garde isStripeConfigured() AVANT toute lecture du corps.",
    ).toBe(false);
  });

  it("les chemins sortants (Checkout, remboursements) n'existent plus", () => {
    for (const chemin of [
      "src/features/payment/actions.ts",
      "src/features/booking/refund-actions.ts",
    ]) {
      expect(existsSync(join(RACINE, chemin)), `${chemin} est réapparu`).toBe(false);
    }
  });
});

describe("2. la CSP n'autorise rien pour une intégration éteinte", () => {
  const csp = (actif: boolean): string => {
    const avant = process.env["STRIPE_ENABLED"];
    if (actif) process.env["STRIPE_ENABLED"] = "true";
    else delete process.env["STRIPE_ENABLED"];
    try {
      return buildCspHeader({ nonce: "test", strict: false });
    } finally {
      if (avant === undefined) delete process.env["STRIPE_ENABLED"];
      else process.env["STRIPE_ENABLED"] = avant;
    }
  };

  it("Stripe éteint → aucune origine Stripe autorisée", () => {
    const h = csp(false);
    expect(h).not.toContain("api.stripe.com");
    expect(h).not.toContain("checkout.stripe.com");
  });

  it("Stripe allumé → les origines reviennent d'elles-mêmes", () => {
    // Le gating plutôt que la suppression : qui rallumera Stripe ne doit pas
    // découvrir un iframe blanc faute d'avoir pensé à la CSP.
    const h = csp(true);
    expect(h).toContain("https://api.stripe.com");
    expect(h).toContain("https://checkout.stripe.com");
  });

  it("le reste de la CSP est intact dans les deux cas", () => {
    for (const h of [csp(false), csp(true)]) {
      expect(h).toContain("https://calendly.com");
      expect(h).toContain("https://challenges.cloudflare.com");
      expect(h).toContain("https://*.r2.cloudflarestorage.com");
      expect(h).toContain("default-src 'self'");
    }
  });
});

describe("3. la notice RGPD ne déclare pas un sous-traitant inactif", () => {
  const stripe = SUBPROCESSORS.find((s) => s.name.includes("Stripe"));

  it("Stripe figure bien au registre (on ne le supprime pas)", () => {
    // Le retirer effacerait l'information « il existe une intégration codée ».
    // Le bon état est « déclaré, non activé », pas « absent ».
    expect(stripe).toBeDefined();
  });

  it("il est déclaré en attente d'activation, pas actif", () => {
    expect(
      stripe?.activationStatus,
      "la page /sous-processeurs est une notice publique : y déclarer Stripe " +
        "« actif » affirme qu'il traite des données personnelles, alors qu'il " +
        "n'en a jamais reçu (0 ligne dans payments/bookings/stripe_webhook_events).",
    ).toBe("pending_activation");
  });
});

describe("4. aucun Stripe côté navigateur", () => {
  it("le SDK client n'est pas une dépendance", () => {
    const pkg = JSON.parse(lire("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const toutes = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(
      Object.keys(toutes).some((d) => d.startsWith("@stripe/")),
      "un paquet @stripe/* côté client pèserait sur le budget First Load JS " +
        "pour une intégration éteinte.",
    ).toBe(false);
  });
});
