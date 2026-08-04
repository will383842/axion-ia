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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCspHeader } from "./csp";
import { SUBPROCESSORS } from "@/content/subprocessors";

const RACINE = process.cwd();
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");

/**
 * 🔴 LIRE LE CODE, PAS LES COMMENTAIRES.
 *
 * Première version de ces gardes : `source.includes("isStripeConfigured()")`.
 * Elle restait VERTE alors que j'avais retiré la garde de la route — parce que
 * le commentaire explicatif juste au-dessus, que je venais d'écrire, contient
 * l'appel. Le test se satisfaisait de sa propre documentation.
 *
 * Vérifié en réintroduisant les trois défauts d'un coup : deux gardes sur trois
 * ont rougi, celle-ci non. D'où ce décapage préalable — un contrôle statique
 * doit interroger le code exécuté, jamais la prose qui l'entoure.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const lireCode = (p: string) => sansCommentaires(lire(p));

describe("1. l'interrupteur coupe l'ENTRANT autant que le SORTANT", () => {
  /**
   * 🔴 LE DÉFAUT TROUVÉ.
   *
   * `isStripeConfigured()` gardait la création de session Checkout et les
   * remboursements, mais PAS la route webhook — qui écrit dans
   * `stripeWebhookEvent` puis appelle `dispatchStripeEvent`, lequel mute l'état
   * des réservations et des paiements. Un événement signé aurait modifié des
   * données persistées d'une intégration réputée hors service.
   */
  it("la route webhook consulte `isStripeConfigured`", () => {
    const source = lireCode("src/app/api/stripe/webhook/route.ts");
    expect(
      source.includes("isStripeConfigured()"),
      "la route webhook ne consulte pas l'interrupteur : Stripe serait éteint " +
        "dans un seul sens (rien ne sort, tout entre) alors qu'elle mute " +
        "l'état des réservations via `dispatchStripeEvent`.",
    ).toBe(true);
  });

  it("le refus précède la lecture du corps de la requête", () => {
    const source = lireCode("src/app/api/stripe/webhook/route.ts");
    const garde = source.indexOf("isStripeConfigured()");
    const lecture = source.indexOf("await req.text()");
    expect(garde).toBeGreaterThan(-1);
    expect(lecture).toBeGreaterThan(-1);
    expect(
      garde,
      "refuser AVANT de lire le corps : sinon on traite la charge utile d'une " +
        "intégration désactivée.",
    ).toBeLessThan(lecture);
  });

  it("les deux chemins sortants restent gardés", () => {
    for (const chemin of [
      "src/features/payment/actions.ts",
      "src/features/booking/refund-actions.ts",
    ]) {
      expect(lireCode(chemin).includes("isStripeConfigured()"), `${chemin} a perdu sa garde`).toBe(
        true,
      );
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
