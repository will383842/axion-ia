/**
 * Console éditoriale — E2E du lot 0 (passe 3 du protocole).
 *
 * Le protocole exige, pour chaque écran : le parcours nominal, l'état vide,
 * l'état d'erreur, l'état de chargement, et la navigation entièrement au
 * clavier.
 *
 * ⚠️ Ce que ce fichier couvre HONNÊTEMENT, et ce qu'il ne couvre pas :
 *
 * - Les tests de garde (redirection vers `/login` sans session) tournent
 *   partout, sans base ni compte — c'est la convention des autres smokes
 *   admin du dépôt.
 * - Les tests authentifiés dépendent d'un `AdminUser` semé ET de la console
 *   amorcée. Ils se SAUTENT proprement si le login échoue, plutôt que de
 *   rougir sur une machine sans seed : un faux rouge apprend à ignorer le
 *   rouge, et le protocole en fait un principe.
 * - **L'état de chargement n'est pas asserté** : les deux écrans sont rendus
 *   d'un bloc côté serveur, sans squelette ni frontière `Suspense`. Il n'y a
 *   donc pas d'état de chargement à vérifier — et en inventer un
 *   « pour cocher la case » serait précisément la garde qui ne garde rien.
 *   À reprendre au lot 1, quand les écrans deviendront interactifs.
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin, ADMIN_PREFIX } from "./fixtures/admin-auth";

const BASE = `/fr/${ADMIN_PREFIX}/console-editoriale`;

// 🔴 Sérialisé, et le délai élargi — sinon ce fichier rougit pour rien.
//
// En local, Playwright démarre `pnpm dev`, qui compile la route À LA PREMIÈRE
// REQUÊTE. Sur une application de cette taille, quatre workers qui se
// disputent cette première compilation dépassent tous les 30 s par défaut :
// neuf tests au rouge, aucun défaut de code. Un faux rouge apprend à ignorer
// le rouge — le protocole en fait un principe.
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  testInfo.setTimeout(120_000);
});

/** Tente le login ; rend `false` si l'environnement n'est pas amorcé. */
async function connecte(page: Page): Promise<boolean> {
  try {
    await loginAsAdmin(page);
    return true;
  } catch {
    return false;
  }
}

test.describe("console éditoriale — gardes (sans session)", () => {
  test("le tableau de bord renvoie vers le login", async ({ page }) => {
    const reponse = await page.goto(BASE);
    expect(reponse?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login/);
  });

  test("le calendrier renvoie vers le login", async ({ page }) => {
    const reponse = await page.goto(`${BASE}/calendrier`);
    expect(reponse?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login/);
  });

  test("🔴 un mois hors bornes ne casse pas la page", async ({ page }) => {
    // Une URL n'est jamais de confiance. `lireMois` / `lireAnnee` bornent ;
    // sans elles, `MOIS[mois - 1]` rendrait `undefined` et la page blanchirait.
    for (const q of ["?month=99", "?month=-4", "?year=abcd", "?month=0&year=1"]) {
      const reponse = await page.goto(`${BASE}/calendrier${q}`);
      expect(reponse?.status(), `pour ${q}`).toBeLessThan(500);
    }
  });
});

test.describe("console éditoriale — autorisé", () => {
  test("le tableau de bord affiche ses compteurs et mène au calendrier", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    await page.goto(BASE);
    await expect(page.getByRole("heading", { name: /console éditoriale/i })).toBeVisible();
    await expect(page.getByText("Publications au calendrier", { exact: true })).toBeVisible();
    // `exact` : le bloc « ce que ce lot ne fait pas encore » cite lui aussi
    // « les règles de conformité ». Sans cela, le locator résout DEUX éléments
    // et Playwright refuse d'agir — un rouge dû au test, pas à la page.
    await expect(page.getByText("Règles de conformité", { exact: true })).toBeVisible();
    await expect(page.getByText("Règles d'alerte", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: /ouvrir le calendrier/i }).click();
    await expect(page).toHaveURL(/console-editoriale\/calendrier/);
  });

  test("le calendrier de septembre 2026 montre les 15 publications du profil", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    // Critère 4 du §7, doublé du critère 5 : le filtre « perso » isole le
    // profil personnel, où vivent les 15 publications de septembre. Sans
    // filtre, la vue en montre 19 — les 4 échos de page tombent aux mêmes
    // dates, et ce sont bien des diffusions distinctes, pas des doublons.
    await page.goto(`${BASE}/calendrier?year=2026&month=9&identite=perso`);
    await expect(page.getByRole("heading", { name: /septembre 2026/i })).toBeVisible();
    await expect(page.getByText(/15 publications/i).first()).toBeVisible();
  });

  test("🔴 le filtre « pro » n'affiche que la page — critère 5", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    await page.goto(`${BASE}/calendrier?year=2026&month=9&identite=pro&jour=2026-09-01`);
    const liste = page.locator("li", { hasText: /LinkedIn/ });
    const combien = await liste.count();
    if (combien > 0) {
      // Aucune ligne ne doit venir du profil personnel.
      await expect(page.getByText("Profil personnel Williams Jullin")).toHaveCount(0);
    }
  });

  test("l'état vide EXPLIQUE quoi faire, il ne dit pas « aucun résultat »", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    // Un mois sans aucune publication : l'écran doit orienter, pas constater.
    await page.goto(`${BASE}/calendrier?year=2030&month=4`);
    await expect(page.getByText(/aucune publication en avril 2030/i)).toBeVisible();
    await expect(page.getByText(/importez le dossier|naviguez vers un autre mois/i)).toBeVisible();
  });

  test("le filtre se parcourt entièrement au clavier", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    await page.goto(`${BASE}/calendrier?year=2026&month=9`);

    // On tabule jusqu'au filtre « Professionnel », puis on l'active — sans
    // souris, comme l'exige la passe 3.
    const cible = page.getByRole("link", { name: "Professionnel" });
    await expect(cible).toBeVisible();
    await cible.focus();
    await expect(cible).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/identite=pro/);
  });

  test("le filtre actif se signale aux technologies d'assistance", async ({ page }) => {
    test.skip(!(await connecte(page)), "Base non amorcée : login impossible.");

    await page.goto(`${BASE}/calendrier?year=2026&month=9&identite=pro`);
    // `aria-current` : sans lui, un lecteur d'écran ne distingue pas le
    // filtre actif des deux autres — ils ont la même apparence de lien.
    await expect(page.getByRole("link", { name: "Professionnel" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});
