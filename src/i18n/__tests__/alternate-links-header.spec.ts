/**
 * `routing.ts` — verrou sur `alternateLinks: false` et sur la toggle EN.
 *
 * POURQUOI CE FICHIER EXISTE. L'audit GEO/AEO end-to-end du 2026-08-14 a mesuré
 * (GEO-005, agent C1) que next-intl émettait sur **100 % des réponses HTML** un
 * en-tête `Link: …; hreflang="en"` pointant vers `/en/*`, qui répond 301 → FR
 * depuis la désactivation du locale EN, et un `x-default` divergeant de celui du
 * HTML. On annonçait donc à Google un alternate vers une redirection, sur chaque
 * page, en contradiction avec le hreflang du document lui-même.
 *
 * LE PIÈGE QUE CE FICHIER INTERDIT. La correction « évidente » est de retirer
 * `"en"` de `locales` — et elle casserait tout : `hasLocale`, la table
 * `pathnames` et le typage de `src/lib/routes.ts` en dépendent, et AGENTS.md
 * impose de conserver la toggle `EN_LOCALE_ENABLED` pour pouvoir réactiver EN
 * sans rouvrir le code. La bonne correction est de couper le canal HTTP et de
 * laisser le HTML porter le hreflang, puisqu'il est déjà gaté par
 * `isEnLocaleDisabled()`.
 *
 * Ces deux assertions sont donc solidaires : on verrouille le correctif ET ce
 * qu'il ne doit pas emporter avec lui.
 *
 * ⚠️ RÈGLE DE RÉDACTION : on s'ancre sur la source de `routing.ts`, jamais sur
 * une chaîne nue qui pourrait tomber dans un commentaire — les commentaires de
 * ce fichier CITENT `alternateLinks` et `locales` en toutes lettres.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";

// Vitest s'exécute depuis la racine du dépôt.
const SOURCE = readFileSync(path.join(process.cwd(), "src/i18n/routing.ts"), "utf8");

// Retire les commentaires (ligne et bloc) : les explications de `routing.ts`
// mentionnent `alternateLinks` et `locales`, une recherche naïve y tomberait.
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("routing.ts — en-tête HTTP Link hreflang", () => {
  it("désactive `alternateLinks` (GEO-005) — sinon next-intl annonce un alternate `en` vers un 301", () => {
    expect(
      /\balternateLinks\s*:\s*false\b/.test(CODE),
      "`alternateLinks: false` a disparu de defineRouting(). next-intl réémettrait " +
        'sur CHAQUE page un en-tête Link hreflang="en" vers /en/*, qui répond 301 → FR. ' +
        "Si EN est réactivé un jour, c'est `EN_LOCALE_ENABLED` qu'il faut basculer, " +
        "pas ce drapeau.",
    ).toBe(true);
  });

  it("conserve `en` dans `locales` — la toggle EN ne doit pas être supprimée du code", () => {
    // AGENTS.md §« EN locale désactivé » : `routing.locales` reste ["fr","en"]
    // même EN off. Le filtrage se fait à l'affichage, pas dans le typage.
    expect(routing.locales).toContain("fr");
    expect(
      routing.locales,
      "`en` a été retiré de `routing.locales`. C'est la fausse correction de GEO-005 : " +
        "elle casse `hasLocale`, la table `pathnames` et le typage de `src/lib/routes.ts`, " +
        "et supprime la possibilité de réactiver EN par variable d'environnement.",
    ).toContain("en");
  });

  it("garde `fr` en locale par défaut", () => {
    expect(routing.defaultLocale).toBe("fr");
  });
});
