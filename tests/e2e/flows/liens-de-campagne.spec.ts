// L'écran de fabrication des liens de campagne — recette par l'INTERFACE.
//
// Pourquoi ce fichier existe alors que le module pur a déjà 14 tests unitaires :
// ces 14 tests prouvent que la FONCTION calcule juste. Ils ne prouvent pas que
// l'écran s'ouvre, que la garde de rôle laisse passer, que les listes sont
// peuplées, que la frappe recompose le lien, ni que le bouton de copie existe.
// Une fonction juste derrière un écran qui ne s'ouvre pas ne sert à personne —
// et c'est exactement le mode de défaillance qu'un test unitaire ne voit jamais.
//
// Pré-requis : serveur de dev lancé sur une base SEMÉE (`pnpm db:seed`), et
// `E2E_BASE_URL` pointant dessus.

import { expect, test } from "@playwright/test";
import { ADMIN_PREFIX, loginAsAdmin } from "../fixtures/admin-auth";

const CHEMIN = `/fr/${ADMIN_PREFIX}/annonces/liens`;

test.describe("@campagnes fabrique de liens de campagne", () => {
  // 🔴 BUDGET DÉCLARÉ, forme exigée par le cliquet
  // `tests/unit/e2e-harness/budget-des-specs-admin.spec.ts` : toute suite qui
  // ouvre une session admin l'annonce, et au moins 90 s.
  //
  // `test.setTimeout()` ne compte PAS — le cliquet lit `describe.configure`, et
  // il a raison : un budget posé test par test se perd au premier test ajouté
  // sans lui.
  //
  // Pourquoi si haut : la vérification du mot de passe est délibérément coûteuse
  // (Argon2id), et sous `next dev` la PREMIÈRE navigation vers chaque route la
  // COMPILE — 15 s à 3 min sur un poste chargé.
  test.describe.configure({ timeout: 240_000 });

  // 🔑 Sous `next dev`, chaque route se compile AU PREMIER APPEL : le tableau de
  // bord admin a mis 15 à 18 s sur ce poste, et l'écran des liens n'était pas
  // encore compilé. Avec le délai par défaut de 30 s, l'échec accusait la
  // connexion — qui avait pourtant réussi (`POST … 303`, puis dashboard en 200).
  // On nomme donc la cause ici plutôt que de relever la borne globale, ce qui
  // rendrait tous les autres tests complaisants.

  test("l'écran s'ouvre, fabrique un lien juste, et le recompose à la frappe", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(CHEMIN);

    // ── 1. L'écran s'ouvre, et la garde de rôle ne renvoie pas au login.
    expect(new URL(page.url()).pathname, "renvoyé au login").not.toContain("/login");
    await expect(page.getByRole("heading", { name: "Liens de campagne" })).toBeVisible();

    const destination = page.getByLabel("Vers quelle page");
    const canal = page.getByLabel("Depuis quel canal");
    const nom = page.getByLabel("Nom de la campagne");
    const visuel = page.getByLabel("Visuel ou variante");

    // ── 2. Les listes sont PEUPLÉES. Une liste vide rendrait l'écran inerte
    //      sans lever la moindre erreur.
    expect(await destination.locator("option").count()).toBeGreaterThanOrEqual(3);
    expect(await canal.locator("option").count()).toBeGreaterThanOrEqual(5);

    // ── 3. Un lien est proposé AVANT toute saisie — l'écran s'ouvre utile.
    const lien = page.locator("code").first();
    await expect(lien).toContainText("/fr/apporteur-affaires");
    await expect(lien).toContainText("utm_source=facebook");
    await expect(lien).toContainText("utm_medium=paid");

    // ── 4. L'avertissement dit ce qui manque, sans bloquer.
    await expect(page.getByText(/Sans nom de campagne/)).toBeVisible();

    // ── 5. La frappe recompose le lien, ACCENTS NORMALISÉS.
    await nom.fill("Apporteurs Été 2026");
    await visuel.fill("Vidéo A");
    await expect(lien).toContainText("utm_campaign=apporteurs-ete-2026");
    await expect(lien).toContainText("utm_content=video-a");
    // Et l'avertissement disparaît une fois les deux champs remplis.
    await expect(page.getByText(/Sans nom de campagne/)).toHaveCount(0);

    // ── 6. Changer de canal change la SOURCE et le MEDIUM ensemble — le medium
    //      est déduit, jamais saisi.
    await canal.selectOption("leboncoin");
    await expect(lien).toContainText("utm_source=leboncoin");
    await expect(lien).toContainText("utm_medium=referral");

    // ── 7. Changer de destination change le chemin, pas les paramètres.
    await destination.selectOption("devenir-commercial-ia");
    await expect(lien).toContainText("/fr/devenir-commercial-ia");
    await expect(lien).toContainText("utm_campaign=apporteurs-ete-2026");

    // ── 8. TÉMOIN NÉGATIF — l'ancienne URL du tunnel n'est proposée nulle part.
    //      La nommer dans une publicité ajouterait une redirection à chaque clic.
    const optionsDestination = await destination.locator("option").allTextContents();
    expect(optionsDestination.join(" ").toLowerCase()).not.toContain("facebook");

    // ── 9. Le bouton de copie existe et est actionnable.
    await expect(page.getByRole("button", { name: /Copier le lien/ })).toBeEnabled();
  });

  test("le tableau des campagnes vues s'affiche sans planter sur une base sans campagne", async ({
    page,
  }) => {
    // Cas le plus fréquent au démarrage — et celui qu'on oublie de tester :
    // l'écran doit dire « rien encore », pas rendre un tableau vide muet ni
    // lever une erreur de rendu.
    await loginAsAdmin(page);
    await page.goto(CHEMIN);
    await expect(page.getByRole("heading", { name: /Ce qui a réellement amené/ })).toBeVisible();
  });
});
