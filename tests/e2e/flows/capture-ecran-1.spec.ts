// La capture à l'écran 1 du dossier — recette PAR L'INTERFACE, contre la base.
//
// Ce que les tests unitaires ne peuvent pas prouver, et que celui-ci prouve :
// qu'un visiteur qui remplit l'écran 1 puis FERME L'ONGLET laisse une ligne
// rappelable en base. C'est le comportement entier du dispositif, du clic au
// disque — et c'est le seul qui compte.
//
// Pré-requis : serveur de dev sur une base réelle SEMÉE, `E2E_BASE_URL` posé.
//
// ⚠️ ET `PII_ENCRYPTION_KEY` IDENTIQUE À CELLE DU SERVEUR. C'est elle — et non
// `IP_HASH_SALT`, dont le nom le laisserait croire — qui sert de clé HMAC à
// `hashEmailForLookup`. Avec deux clés différentes, le test calcule une
// empreinte que la base ne contient pas : la ligne EXISTE, la recherche ne rend
// rien, et l'échec accuse la capture au lieu d'accuser la configuration du test.
// C'est exactement ce qui s'est produit à la première exécution.

import { expect, test } from "@playwright/test";
import { PrismaClient } from "../../../prisma/generated/client/index.js";
import { hashEmailForLookup } from "../../../src/lib/security/email-hash";

const prisma = new PrismaClient();
const DOSSIER = "/fr/devenir-commercial-ia/candidature";

test.afterAll(async () => {
  await prisma.$disconnect();
});

/** Remplit l'écran 1 et valide. Rend l'adresse utilisée. */
async function remplirEcran1(page: import("@playwright/test").Page): Promise<string> {
  const email = `recette-ecran1-${Date.now()}@exemple-test.invalid`;
  // 🔑 Sous `next dev`, la PREMIÈRE navigation compile la route — jusqu'à 3 min.
  await page.goto(DOSSIER, { timeout: 240_000 });

  // Écran 0 → 1.
  // Écran 0 → 1. Le libellé exact est « Je commence » ; le viser par son rôle
  // et son texte plutôt que par une classe, qui bougerait au premier restyle.
  await page.getByRole("button", { name: /je commence/i }).click();

  await page.locator("#ca-prenom").fill("Recette");
  await page.locator("#ca-nom").fill("Écran-Un");
  await page.locator("#ca-email").fill(email);
  await page.locator("#ca-telephone").fill("0612345678");
  await page.locator("#ca-ville").fill("Grenoble");
  await page.locator("#ca-cp").fill("38000");
  await page.locator('[name="consent"]').check();
  return email;
}

test.describe("@capture-dossier l'écran 1 enregistre le contact", () => {
  test.setTimeout(300_000);

  test("le consentement est demandé À L'ÉCRAN 1, pas au dernier", async ({ page }) => {
    // C'est ce qui rend l'écriture licite : l'accord précède la capture.
    await page.goto(DOSSIER, { timeout: 240_000 });
    await page.getByRole("button", { name: /je commence/i }).click();
    await expect(
      page.locator('[name="consent"]'),
      "la case de consentement doit être visible dès l'écran 1",
    ).toBeVisible();
  });

  test("sans consentement, l'écran 1 REFUSE d'avancer", async ({ page }) => {
    await page.goto(DOSSIER, { timeout: 240_000 });
    await page.getByRole("button", { name: /je commence/i }).click();
    await page.locator("#ca-prenom").fill("Recette");
    await page.locator("#ca-nom").fill("Sans-Accord");
    await page.locator("#ca-email").fill("sans-accord@exemple-test.invalid");
    await page.locator("#ca-telephone").fill("0612345678");
    await page.locator("#ca-ville").fill("Grenoble");
    await page.locator("#ca-cp").fill("38000");
    // On NE coche PAS.
    await page.getByRole("button", { name: /^continuer/i }).click();

    await expect(
      page.locator("#ca-consent-error"),
      "avancer sans accord laisserait partir une capture sans base",
    ).toBeVisible();
  });

  test("🔑 UN ABANDON APRÈS L'ÉCRAN 1 LAISSE UNE PERSONNE RAPPELABLE", async ({ page }) => {
    // Le test qui justifie tout le dispositif. Avant, ce scénario ne laissait
    // RIEN : le brouillon vivait dans le navigateur du visiteur.
    const email = await remplirEcran1(page);
    await page.getByRole("button", { name: /^continuer/i }).click();

    // On est passé à l'écran 2 — et on s'arrête là, comme un vrai abandon.
    await expect(page.locator("#ca-prenom")).toHaveCount(0);

    // La capture part sans bloquer la navigation : on lui laisse le temps.
    const empreinte = hashEmailForLookup(email);
    expect(empreinte).not.toBeNull();

    let ligne: { id: string; contactEmailHash: string | null; details: unknown } | null = null;
    for (let essai = 0; essai < 30 && ligne === null; essai += 1) {
      ligne = await prisma.submission.findFirst({
        where: { contactEmailHash: empreinte },
        select: { id: true, contactEmailHash: true, details: true },
        orderBy: { submittedAt: "desc" },
      });
      if (!ligne) await page.waitForTimeout(1000);
    }

    expect(
      ligne,
      "abandon après l'écran 1 : aucune ligne en base — la personne est perdue " +
        "sans laisser de numéro à rappeler, ce que ce dispositif existe pour empêcher",
    ).not.toBeNull();

    const details = ligne?.details as { origine?: string; etape?: string };
    expect(details?.etape).toBe("premier-contact");
    // Le marqueur qui distingue cette capture d'un premier contact venu du
    // tunnel — sans lui, impossible de compter les abandons de dossier.
    expect(details?.origine).toBe("ecran-1-du-dossier");
  });

  test("repasser deux fois l'écran 1 ne crée pas DEUX lignes", async ({ page }) => {
    // Idempotence vue de l'utilisateur : corriger une faute et revenir en
    // arrière ne doit pas valoir deux séries de rappels J+2 / J+7.
    const email = await remplirEcran1(page);
    await page.getByRole("button", { name: /^continuer/i }).click();
    await page.waitForTimeout(2500);

    // Retour arrière, puis on revalide.
    await page
      .getByRole("button", { name: /retour|précédent/i })
      .first()
      .click();
    await page.getByRole("button", { name: /^continuer/i }).click();
    await page.waitForTimeout(2500);

    const empreinte = hashEmailForLookup(email);
    const combien = await prisma.submission.count({ where: { contactEmailHash: empreinte } });
    expect(combien, "une seule ligne, quel que soit le nombre d'allers-retours").toBe(1);
  });
});
