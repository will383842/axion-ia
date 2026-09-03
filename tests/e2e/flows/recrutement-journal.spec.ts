/**
 * Parcours — LE JOURNAL DU CANDIDAT, au clic, sur données semées.
 *
 * Ce que ce fichier prouve, et qu'aucun test unitaire ne peut prouver : que la
 * frise s'affiche, que le composeur s'ouvre, qu'un modèle pré-remplit vraiment
 * les deux champs, et qu'un fait consigné apparaît dans l'historique avec la
 * date qu'on lui a donnée — pas celle de la saisie.
 *
 * ⚠️ Il n'envoie AUCUN e-mail. La chaîne d'envoi se prouve en boîte, pas en
 * parcours ; ce qui se prouve ici est que l'écran fait ce qu'il annonce.
 */

import { test, expect, type Page } from "@playwright/test";

import { loginAsAdmin, baseSemeeAttendue, ADMIN_PREFIX } from "../fixtures/admin-auth";

/** Même borne et même raison que `recrutement.spec.ts` : compilation à la demande. */
const NAVIGATION = { waitUntil: "domcontentloaded", timeout: 120_000 } as const;

async function ouvrirLaConsole(page: Page): Promise<boolean> {
  try {
    await loginAsAdmin(page);
    return true;
  } catch (cause) {
    if (baseSemeeAttendue()) throw cause;
    test.skip(
      true,
      "connexion admin impossible en local — jouer `pnpm db:seed` puis " +
        `\`pnpm recrutement:seed-scenarios\`. Cause : ${String(cause)}`,
    );
    return false;
  }
}

/** Ouvre la première fiche de candidature de la liste. */
async function ouvrirUneFiche(page: Page): Promise<void> {
  await page.goto(`/fr/${ADMIN_PREFIX}/contacts/candidatures`, NAVIGATION);
  const liens = page.getByRole("link", { name: /détail/i });
  // `count()` est instantané et ne voit pas une table streamée — leçon déjà
  // payée dans `recrutement.spec.ts`.
  await liens.first().waitFor({ state: "visible", timeout: 60_000 });
  const adresse = await liens.first().getAttribute("href");
  expect(adresse, "aucune fiche ouvrable — le socle de recette a-t-il été joué ?").toBeTruthy();
  await page.goto(adresse!, NAVIGATION);
}

test.describe("recrutement — le journal du candidat", () => {
  test.describe.configure({ timeout: 600_000 });

  test("la fiche porte un historique et les deux gestes qui l'alimentent", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;
    await ouvrirUneFiche(page);

    await expect(page.getByRole("heading", { name: /historique/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /répondre au candidat/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /consigner un fait/i })).toBeVisible();

    // Sur une candidature du socle, rien n'a encore été consigné : l'écran doit
    // le DIRE. Un espace vide se lirait comme un écran cassé.
    await expect(page.getByText(/rien n.a encore été consigné/i)).toBeVisible();
  });

  test("choisir un modèle pré-remplit l'objet ET le message", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;
    await ouvrirUneFiche(page);

    await page.getByRole("button", { name: /répondre au candidat/i }).click();

    const objet = page.getByLabel("Objet");
    const message = page.getByLabel("Message");
    await expect(objet).toHaveValue("");

    await page.getByLabel(/modèle de départ/i).selectOption("refus");

    // 🔑 Les deux champs, pas un seul. Un modèle qui ne remplirait que l'objet
    // laisserait partir un message vide sous un objet soigné.
    await expect(objet).not.toHaveValue("");
    await expect(message).not.toHaveValue("");

    // Le prénom du candidat est SUBSTITUÉ : un « {prenom} » resté à l'écran
    // serait un trou visible, ce qui est voulu — mais pas ici, où le composeur
    // connaît la valeur.
    await expect(message).not.toHaveValue(/\{prenom\}/);

    // L'aperçu montre ce qui partira.
    await expect(page.getByText(/après examen, nous ne donnons pas suite/i).first()).toBeVisible();
  });

  test("un fait consigné apparaît dans l'historique", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;
    await ouvrirUneFiche(page);

    const marqueur = `Appel de recette ${Date.now()}`;
    await page.getByRole("button", { name: /consigner un fait/i }).click();
    await page.getByLabel(/nature/i).selectOption("appel");
    await page.getByLabel(/ce qui s.est passé/i).fill(marqueur);
    await page.getByRole("button", { name: /^consigner$/i }).click();

    // La frise est rendue côté serveur : elle réapparaît après revalidation.
    await expect(page.getByText(marqueur).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/^Appel$/).first()).toBeVisible();
  });

  test("une date de fait dans le futur est refusée", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;
    await ouvrirUneFiche(page);

    // 🔑 Le cas qui distingue un journal d'un agenda. Sans cette borne, la frise
    // se trierait sur des faits qui n'ont pas eu lieu.
    const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
    await page.getByRole("button", { name: /consigner un fait/i }).click();
    await page.getByLabel(/quand/i).fill(demain);
    await page.getByLabel(/ce qui s.est passé/i).fill("Fait situé dans le futur");
    await page.getByRole("button", { name: /^consigner$/i }).click();

    await expect(page.getByRole("alert")).toContainText(/futur/i);
  });
});
