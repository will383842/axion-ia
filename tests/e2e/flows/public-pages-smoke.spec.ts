// E2E flow — smoke des pages publiques stratégiques (Sprint 21 / M10).
//
// 🔴 2026-08-21 — CETTE SPEC N'AVAIT JAMAIS APPRIS QUE EN EST ÉTEINT.
//
// Elle listait 16 URLs « 8 pages × 2 langues » et exigeait de chacune un 200 et
// un fragment de titre. Or le locale EN est désactivé depuis le 2026-05-16 :
// `src/proxy.ts` intercepte tout `/en/*` et émet un 301 vers l'équivalent FR.
// Les cas EN suivaient donc la redirection et tombaient sur une page FR dont le
// titre ne pouvait pas matcher un fragment anglais — `/en/case-studies` arrive
// sur « cas concrets », qui ne contient pas « case stud ».
//
// Personne ne l'a vu pendant trois mois parce que la suite ne tournait pas : le
// calcul du delta de bundle détruisait le build avant Playwright (cf.
// `tests/unit/ci/harnais-e2e-mesure-vraiment.spec.ts`).
//
// On ne SUPPRIME pas les cas EN — ce serait perdre la couverture du jour où EN
// sera réactivé, et surtout perdre la garde sur la redirection elle-même, qui
// porte tout le link juice des URLs EN déjà indexées. On assère le CONTRAT RÉEL,
// et il est plus exigeant que l'ancien : un SEUL 301, vers la canonique FR
// EXACTE. L'ancienne version acceptait n'importe quel statut < 400 au bout de
// n'importe quelle chaîne de redirections.
//
// ⚠️ Les destinations sont écrites À LA MAIN, pas dérivées de `mapEnToFr` : un
// test qui recopie son implémentation ne prouve rien. Si le mapping change, ces
// lignes doivent changer aussi — c'est le but.

import { test, expect } from "@playwright/test";

/** Pages FR stratégiques : 200, titre attendu, aucune erreur console. */
const PAGES_FR = [
  ["/fr", /Axion-IA|cabinet IA/i],
  ["/fr/interventions", /intervention/i],
  ["/fr/interventions/essentielle", /essentielle/i],
  ["/fr/audit", /audit/i],
  ["/fr/implementation", /implémentation|implementation/i],
  ["/fr/cas-concrets", /cas concrets|case studies/i],
  ["/fr/blog", /blog/i],
  ["/fr/contact", /contact/i],
] as const;

/**
 * Les mêmes pages en EN : un 301 vers la canonique FR, en UN SEUL saut.
 *
 * Le mapping exhaustif de `en-to-fr-redirect.ts` existe précisément pour éviter
 * les chaînes `301 → 307 → 404` que l'audit GSC du 2026-05-18 avait relevées.
 * Une chaîne à deux sauts perd du link juice et gaspille du budget de crawl :
 * c'est bien « un seul saut » qu'on garde ici.
 */
const REDIRECTIONS_EN = [
  ["/en", "/fr"],
  ["/en/interventions", "/fr/interventions"],
  ["/en/interventions/essential", "/fr/interventions/essentielle"],
  ["/en/audit", "/fr/audit"],
  ["/en/implementation", "/fr/implementation"],
  ["/en/case-studies", "/fr/cas-concrets"],
  ["/en/blog", "/fr/blog"],
  ["/en/contact", "/fr/contact"],
] as const;

test.describe("Pages publiques stratégiques — FR", () => {
  for (const [path, motifTitre] of PAGES_FR) {
    test(`${path} rend 200, un titre valide et aucune erreur console`, async ({ page }) => {
      const erreurs: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const texte = msg.text();
        // Bruit externe (Turnstile, DevTools) et avertissements : pas des défauts.
        if (
          texte.includes("Warning:") ||
          texte.includes("DevTools") ||
          texte.includes("turnstile") ||
          texte.includes("Failed to fetch")
        ) {
          return;
        }
        erreurs.push(texte);
      });

      const reponse = await page.goto(path);
      expect(reponse?.status(), `statut HTTP de ${path}`).toBeLessThan(400);
      await expect(page).toHaveTitle(motifTitre);
      expect(erreurs, `erreurs console sur ${path}`).toEqual([]);
    });
  }
});

test.describe("Locale EN éteint — 301 vers la canonique FR", () => {
  for (const [depuis, vers] of REDIRECTIONS_EN) {
    test(`${depuis} redirige en un seul saut vers ${vers}`, async ({ request, baseURL }) => {
      const reponse = await request.get(depuis, { maxRedirects: 0 });

      expect(
        reponse.status(),
        `${depuis} doit répondre 301 — un 307 serait retesté à chaque crawl, ` +
          "et un 200 signifierait que EN a été réactivé sans mettre cette spec à jour",
      ).toBe(301);

      const destination = reponse.headers()["location"] ?? "";
      const chemin = destination.startsWith("http")
        ? new URL(destination).pathname
        : destination.split("?")[0];

      expect(
        chemin,
        `${depuis} doit pointer sur la canonique FR EXACTE : une destination ` +
          "approximative produit une seconde redirection, voire un 404 doux",
      ).toBe(vers);

      // Et la destination doit exister : un 301 vers le vide est pire qu'un 404.
      const cible = await request.get(vers, { maxRedirects: 0 });
      expect(cible.status(), `${vers} (destination du 301) doit répondre 200`).toBe(200);
      expect(baseURL, "baseURL doit être défini par playwright.config.ts").toBeTruthy();
    });
  }
});
