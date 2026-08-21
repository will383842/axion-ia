// E2E a11y — LA CONSOLE ADMIN. Lot 5, « garde-fous durables ».
//
// 🔴 Le défaut : `a11y.spec.ts` couvre quinze pages, toutes PUBLIQUES. La
// console — celle où Will passe ses journées, et la seule surface dont dépend
// la certification — n'était mesurée nulle part. Zéro page admin sous axe-core.
//
// ⚠️ POURQUOI UN FICHIER ET UN TAG SÉPARÉS, et pas trois lignes ajoutées à la
// liste existante.
//
// Le job nightly `a11y-prod` lance `--grep @a11y` **contre la production**
// (`E2E_BASE_URL` pointe le site live). Ajouter des chemins admin à ce tag
// ferait tenter, chaque nuit, une CONNEXION EN PRODUCTION avec des
// identifiants de seed. Elle échouerait — et un gate qui rougit toutes les
// nuits pour une raison qui n'est pas la sienne finit ignoré. C'est
// littéralement l'avertissement écrit en tête de `a11y.spec.ts` : « un rouge
// qu'on n'arrive pas à qualifier finit ignoré. C'est comme ça qu'un gate
// meurt. »
//
// D'où : tag `@a11y-admin`, et un refus explicite de tourner contre une cible
// distante.

import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { loginAsAdmin, ADMIN_PREFIX } from "./fixtures/admin-auth";

/**
 * Les trois surfaces que le plan désigne (Lot 5), plus celle qui porte le
 * parcours guidé.
 */
const PAGES_ADMIN = [
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/sessions`, label: "liste des sessions" },
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/a-traiter`, label: "à traiter" },
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/dossiers`, label: "dossiers" },
  { path: `/fr/${ADMIN_PREFIX}/qualiopi/mode-auditeur/signatures`, label: "registre auditeur" },
] as const;

/**
 * Les identifiants de seed sont-ils fournis ?
 *
 * 🔴 En CI ils ne le sont pas : la suite Playwright y tourne SANS base seedée,
 * dans une étape `continue-on-error`. Trois issues possibles, une seule
 * honnête :
 *
 *   · échouer  → du bruit rouge permanent dans une étape non bloquante, qu'on
 *     apprend à ignorer — et le jour où le test a raison, personne ne regarde ;
 *   · passer   → PIRE : le rapport déclarerait la console vérifiée alors
 *     qu'aucune page n'a été ouverte ;
 *   · SAUTER explicitement → le rapport dit « skipped », ce qui est la vérité.
 */
function identifiantsFournis(): boolean {
  return (
    (process.env["ADMIN_SEED_EMAIL"] ?? "") !== "" &&
    (process.env["ADMIN_SEED_PASSWORD"] ?? "") !== ""
  );
}

/**
 * La cible est-elle locale ?
 *
 * 🔴 Garde de sécurité, pas de confort. Ce fichier SE CONNECTE : le laisser
 * pointer une base distante ferait taper des identifiants sur un environnement
 * qui n'est pas le nôtre.
 */
function cibleLocale(): boolean {
  const base = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";
  return base.includes("localhost") || base.includes("127.0.0.1");
}

test.describe("a11y console admin WCAG 2.2 AA @a11y-admin", () => {
  test.describe.configure({ timeout: 90_000 });

  test.skip(
    !cibleLocale() || !identifiantsFournis(),
    "Cible locale ET identifiants de seed requis : le nightly mesure la prod en " +
      "lecture seule, sans authentification.",
  );

  for (const { path, label } of PAGES_ADMIN) {
    test(`${label} — 0 violation serious/critical @a11y-admin`, async ({ page }) => {
      // Le login peut échouer si la base n'est pas seedée : on le dit
      // explicitement plutôt que de laisser axe analyser la page de connexion
      // et déclarer la console conforme.
      await loginAsAdmin(page);

      const response = await page.goto(path);
      const status = response?.status() ?? 0;
      expect(status, `Aucune réponse exploitable sur ${path}`).toBeGreaterThanOrEqual(200);
      expect(status, `Statut inattendu sur ${path}`).toBeLessThan(400);

      // 🔴 CANARI — obligatoire, et DIFFÉRENT de celui des pages publiques.
      //
      // `a11y.spec.ts` vérifie `header[data-tone]`, qui n'existe que sur le
      // header PUBLIC : le réutiliser ici échouerait sur toutes les pages
      // admin. Sans canari du tout, une redirection vers `/login` renverrait
      // 200, axe analyserait un formulaire de connexion — presque sans
      // violation — et le job déclarerait la console conforme. Un gate doit
      // d'abord prouver QU'IL EST SUR LA BONNE PAGE.
      //
      // 🔴 2026-08-21 — CE CANARI N'AVAIT JAMAIS PU PASSER.
      //
      // Il visait `nav[aria-label="Navigation admin"]`. Ce libellé existe bien —
      // mais il est porté par un `<aside>` (`AdminSidebarNav.tsx`), et le `<nav>`
      // qu'il contient porte « Sections admin ». Le sélecteur croisait donc une
      // balise et un libellé qui ne se rencontrent jamais : les QUATRE tests de
      // ce fichier échouaient sur « element(s) not found », sans qu'aucune page
      // admin n'ait jamais été analysée par axe.
      //
      // 🔑 Un canari écrit de mémoire est un canari mort. Celui-ci a été posé
      // pour empêcher un faux vert et il produisait un rouge permanent — le
      // même résultat pratique : personne n'apprend rien de ce fichier. On vise
      // désormais le RÔLE et le NOM ACCESSIBLES, qui sont ce que le canari veut
      // vraiment prouver (« la navigation de la console est là »), et qui
      // survivent à un changement de balise.
      await expect(
        page.getByRole("navigation", { name: "Sections admin" }),
        `navigation de la console absente sur ${path} — page probablement non rendue`,
      ).toBeVisible();
      // …et qu'on n'a pas été renvoyé au login malgré tout.
      expect(new URL(page.url()).pathname, `Redirigé hors de ${path}`).not.toContain("/login");

      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {
        console.warn(`[a11y-admin] ${path} — networkidle non atteint en 15 s`);
      });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();

      const bloquantes = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );

      if (bloquantes.length > 0) {
        console.error(
          `[a11y-admin] ${path} — ${bloquantes.length} violations bloquantes :`,
          bloquantes.map((v) => ({ id: v.id, impact: v.impact, help: v.help })),
        );
      }
      expect(bloquantes, `0 violation serious/critical attendue sur ${path}`).toEqual([]);

      const mineures = results.violations.filter(
        (v) => v.impact === "moderate" || v.impact === "minor",
      );
      if (mineures.length > 0) {
        console.warn(
          `[a11y-admin] ${path} — ${mineures.length} mineures/modérées (revue) :`,
          mineures.map((v) => ({ id: v.id, impact: v.impact })),
        );
      }
    });
  }
});
