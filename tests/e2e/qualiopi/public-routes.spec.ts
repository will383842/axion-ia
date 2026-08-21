/**
 * Audit des routes PUBLIQUES — audit de certification Qualiopi 2026-07-25.
 *
 * Passe les 119 routes publiques statiques au harnais commun. `expect.soft`
 * partout : une route en défaut ne doit pas masquer l'état des 118 autres —
 * l'objet est de RÉCOLTER, pas de s'arrêter au premier problème.
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
const routes = JSON.parse(
  readFileSync(join(ICI, "_harness", "routes-publiques.json"), "utf8"),
) as string[];

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
