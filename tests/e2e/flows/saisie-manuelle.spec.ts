// La saisie manuelle d'un contact — recette PAR L'INTERFACE, contre la base.
//
// Ce que les tests unitaires ne peuvent pas prouver : que l'écran est
// ATTEIGNABLE, que la garde de rôle laisse passer, que le panneau de doublon
// s'affiche vraiment, et que la ligne écrite porte bien ce que la fiche
// affichera. Une action juste derrière un écran qu'on ne peut pas ouvrir ne
// sert à personne.
//
// Pré-requis : serveur de dev sur base réelle SEMÉE, `E2E_BASE_URL` posé, et
// ⚠️ `PII_ENCRYPTION_KEY` IDENTIQUE à celle du serveur — c'est elle, et non
// `IP_HASH_SALT`, qui sert de clé HMAC à `hashEmailForLookup`. Avec deux clés
// différentes, le test cherche une empreinte que la base ne contient pas :
// l'échec accuse alors l'écriture au lieu de la configuration du test.

import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../prisma/generated/client/index.js";
import { hashEmailForLookup } from "../../../src/lib/security/email-hash";
import { ADMIN_PREFIX, loginAsAdmin } from "../fixtures/admin-auth";

const prisma = new PrismaClient();
const ECRAN = `/fr/${ADMIN_PREFIX}/contacts/commercial/nouveau`;

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("@saisie-manuelle un contact saisi depuis la console", () => {
  // 🔴 BUDGET DÉCLARÉ, forme exigée par le cliquet
  // `tests/unit/e2e-harness/budget-des-specs-admin.spec.ts` : toute suite qui
  // ouvre une session admin doit annoncer son budget, et au moins 90 s.
  //
  // `test.setTimeout()` ne compte PAS — le cliquet lit `describe.configure`.
  // J'avais posé le premier, et la garde a rougi : elle a raison, un budget
  // posé test par test se perd au premier test ajouté sans lui.
  //
  // Pourquoi si haut : la vérification du mot de passe est délibérément
  // coûteuse (Argon2id), et sous `next dev` la PREMIÈRE navigation vers chaque
  // route la COMPILE — 15 s à 3 min sur un poste chargé.
  test.describe.configure({ timeout: 300_000 });

  test("l'écran s'ouvre, et il DIT qu'aucun e-mail ne partira", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(ECRAN, { timeout: 240_000 });

    expect(new URL(page.url()).pathname, "renvoyé au login").not.toContain("/login");
    await expect(page.getByRole("heading", { name: "Nouveau contact apporteur" })).toBeVisible();

    // 🔑 L'écran doit ANNONCER son effet. Un administrateur qui ignore ce que
    // son geste déclenche finit par ne plus oser s'en servir.
    const html = (await page.content()).toLowerCase();
    expect(html).toContain("aucun e-mail");
  });

  test("🔑 un contact saisi ARRIVE EN BASE, sans consentement fabriqué", async ({ page }) => {
    const email = `saisie-${Date.now()}@exemple-test.invalid`;
    await loginAsAdmin(page);
    await page.goto(ECRAN, { timeout: 240_000 });

    await page.locator("#cm-prenom").fill("Camille");
    await page.locator("#cm-nom").fill("Saisie");
    await page.locator("#cm-email").fill(email);
    await page.locator("#cm-telephone").fill("0612345678");
    await page.locator("#cm-origine").selectOption("salon");
    await page.locator("#cm-note").fill("Rencontrée au salon, à rappeler.");
    await page.getByRole("button", { name: /enregistrer le contact/i }).click();

    await expect(page.getByText(/contact enregistré/i)).toBeVisible({ timeout: 60_000 });

    const empreinte = hashEmailForLookup(email);
    const ligne = await prisma.submission.findFirst({
      where: { contactEmailHash: empreinte },
      select: { source: true, details: true },
    });
    expect(ligne, "le contact saisi n'est pas arrivé en base").not.toBeNull();
    expect(String(ligne?.source), "une ligne saisie doit se distinguer d'un formulaire").toBe(
      "import",
    );

    const d = ligne?.details as { origine?: string; origineSaisie?: string; consentement?: string };
    expect(d?.origine).toBe("saisie-manuelle");
    expect(d?.origineSaisie).toBe("salon");
    // 🔴 Le FAIT, pas un `optin` inventé.
    expect(String(d?.consentement)).toContain("aucun");
  });

  test("saisir DEUX FOIS la même adresse montre le doublon au lieu d'écrire", async ({ page }) => {
    const email = `doublon-${Date.now()}@exemple-test.invalid`;
    await loginAsAdmin(page);

    // Première saisie.
    await page.goto(ECRAN, { timeout: 240_000 });
    await page.locator("#cm-prenom").fill("Premier");
    await page.locator("#cm-email").fill(email);
    await page.getByRole("button", { name: /enregistrer le contact/i }).click();
    await expect(page.getByText(/contact enregistré/i)).toBeVisible({ timeout: 60_000 });

    // Seconde saisie, même adresse.
    await page.goto(ECRAN, { timeout: 240_000 });
    await page.locator("#cm-prenom").fill("Second");
    await page.locator("#cm-email").fill(email);
    await page.getByRole("button", { name: /enregistrer le contact/i }).click();

    await expect(
      page.getByText(/cette adresse est déjà connue/i),
      "le doublon doit être montré AVANT d'écrire — après, il faudrait fusionner",
    ).toBeVisible({ timeout: 60_000 });

    // Et rien n'a été écrit : une seule ligne.
    const empreinte = hashEmailForLookup(email);
    const combien = await prisma.submission.count({ where: { contactEmailHash: empreinte } });
    expect(combien, "une seule ligne tant que le doublon n'est pas confirmé").toBe(1);
  });
});
