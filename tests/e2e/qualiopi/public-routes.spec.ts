/**
 * Audit des routes PUBLIQUES — audit de certification Qualiopi 2026-07-25.
 *
 * Passe les routes publiques statiques au harnais commun. `expect.soft` partout :
 * une route en défaut ne doit pas masquer l'état des autres — l'objet est de
 * RÉCOLTER, pas de s'arrêter au premier problème.
 *
 * ⚠️ L'en-tête annonçait « 119 routes » ; la liste en contenait 118, dont une
 * — `/fr/sections` — qui ne correspondait à AUCUNE route du dépôt et rendait
 * 404 jusqu'en production. Un chiffre écrit dans un commentaire n'est pas un
 * inventaire : celui-ci a survécu à la route qu'il comptait. Retirée le
 * 2026-08-21, en même temps que le conditionnement des deux routes gatées
 * ci-dessous.
 *
 * Cible par défaut : http://localhost:3000. Pour auditer la production :
 *   E2E_BASE_URL=https://axion-ia.com npx playwright test tests/e2e/qualiopi/public-routes.spec.ts --project=chromium
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test, expect } from "@playwright/test";
import { auditerPage } from "./_harness/audit-page";

// Lecture fs plutôt qu'`import ... from "*.json"` : la configuration ESM du dépôt
// exige un `import attribute` que Playwright ne fournit pas au chargement des specs.
const ICI = dirname(fileURLToPath(import.meta.url));
const toutesLesRoutes = JSON.parse(
  readFileSync(join(ICI, "_harness", "routes-publiques.json"), "utf8"),
) as string[];

/**
 * Deux routes n'existent QUE si la certification est revendicable.
 *
 * 🔴 2026-08-21 — la liste les contenait sans condition, et le premier relevé
 * réel de la suite les a rendues en 404. Ce n'était pas un défaut du produit :
 * `sitemap-images-services.xml/route.ts` les déclare dans
 * `PAGES_RESERVEES_AUX_CERTIFIES`, et elles sont donc fermées tant que
 * `QUALIOPI_CERTIFICATION_OBTENUE` ne vaut pas `"true"`. Vérifié : les deux
 * rendent 200 en production, où le drapeau est posé.
 *
 * Les GARDER sans condition, c'est deux rouges permanents sans rapport avec un
 * défaut — donc un gate qu'on n'ose plus rendre bloquant. Les SUPPRIMER, c'est
 * perdre leur couverture le jour où le drapeau est posé. On suit donc le
 * drapeau, exactement comme les pages elles-mêmes.
 *
 * ⚠️ Cela suppose que le processus Playwright et le serveur voient le MÊME
 * drapeau. C'est le cas en CI (même bloc `env` de job) et en local. Si un jour
 * ils divergent, ces deux routes rendront un faux rouge — et le message
 * d'échec, qui porte le statut HTTP, le dira.
 */
const ROUTES_SI_CERTIFIE = new Set([
  "/fr/certification-qualiopi",
  "/fr/financement-opco-france-travail",
]);
const certificationRevendicable = process.env["QUALIOPI_CERTIFICATION_OBTENUE"] === "true";
const routes = certificationRevendicable
  ? toutesLesRoutes
  : toutesLesRoutes.filter((r) => !ROUTES_SI_CERTIFIE.has(r));

test.describe("@qualiopi-public routes publiques", () => {
  test.describe.configure({ mode: "parallel" });

  for (const route of routes) {
    test(`page ${route}`, async ({ page }, info) => {
      const r = await auditerPage(page, route);
      await info.attach(`${route.replace(/\//g, "_")}.json`, {
        body: JSON.stringify(r, null, 2),
        contentType: "application/json",
      });

      expect.soft(r.statut, "HTTP").toBe(200);
      expect.soft(r.erreursConsole, "erreurs console").toEqual([]);
      expect.soft(r.requetesEnEchec, "requêtes en échec").toEqual([]);
      expect.soft(r.axeBloquant, "a11y serious/critical").toEqual([]);
      expect.soft(r.textesInterdits, "texte interdit").toEqual([]);
      // Le message porte le DÉTAIL : sans lui, l'échec dit « ça déborde » et
      // rien d'autre, et 56 routes rouges ne se distinguent pas d'un artefact
      // de mesure. Le JSON attaché ci-dessus garde la trace complète.
      expect
        .soft(
          r.debordementA,
          "débordement horizontal — ce qui POUSSE : " +
            JSON.stringify(r.debordementCoupables) +
            // La police va DANS le message d'échec, pas seulement dans le JSON
            // attaché : un débordement de quelques pour cent ne se lit pas
            // pareil selon que la page est rendue avec sa fonte ou avec le
            // repli `local("Arial")`, dont `size-adjust` ne corrige que les
            // métriques verticales. C'est l'information qui manquait pendant
            // toute la session du 2026-08-21.
            " · police : " +
            JSON.stringify(r.fonte),
        )
        .toEqual([]);
    });
  }
});
