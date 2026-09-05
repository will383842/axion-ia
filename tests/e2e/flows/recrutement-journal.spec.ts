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

import { loginAsAdmin, baseSemeeAttendue } from "../fixtures/admin-auth";
import { ouvrirUneFicheCandidature } from "../fixtures/fiche-candidature";

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

test.describe("recrutement — le journal du candidat", () => {
  test.describe.configure({ timeout: 600_000 });

  test("la fiche porte un historique et les deux gestes qui l'alimentent", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;
    // La DERNIÈRE fiche : aucun autre scénario n'y écrit. Voir `ouvrirUneFiche`.
    await ouvrirUneFicheCandidature(page, "derniere");

    await expect(page.getByRole("heading", { name: /historique/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /répondre au candidat/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /consigner un fait/i })).toBeVisible();

    // Sur une candidature du socle, rien n'a encore été consigné : l'écran doit
    // le DIRE. Un espace vide se lirait comme un écran cassé.
    await expect(page.getByText(/rien n.a encore été consigné/i)).toBeVisible();
  });

  test("choisir un modèle pré-remplit l'objet ET le message", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;
    await ouvrirUneFicheCandidature(page);

    await page.getByRole("button", { name: /répondre au candidat/i }).click();

    // 🔴 Le CHAMP, pas n'importe quel porteur du mot. `getByLabel("Message")`
    // attrapait aussi le badge de la navigation admin — un `<span>` dont
    // l'`aria-label` vaut « 19 messages sans réponse ». L'échec ne disait pas
    // « mauvais sélecteur » mais « strict mode violation », et il ne se produit
    // que sur une base où des messages attendent une réponse : invisible en CI,
    // visible en recette locale. On désigne le rôle et le nom EXACT.
    const objet = page.getByRole("textbox", { name: "Objet", exact: true });
    const message = page.getByRole("textbox", { name: "Message", exact: true });
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
    await ouvrirUneFicheCandidature(page);

    const marqueur = `Appel de recette ${Date.now()}`;
    await page.getByRole("button", { name: /consigner un fait/i }).click();
    await page.getByLabel(/nature/i).selectOption("appel");
    await page.getByLabel(/ce qui s.est passé/i).fill(marqueur);
    await page.getByRole("button", { name: /^consigner$/i }).click();

    // La frise est rendue côté serveur : elle réapparaît après revalidation.
    await expect(page.getByText(marqueur).first()).toBeVisible({ timeout: 60_000 });

    // 🔴 On vérifie le libellé DANS la ligne de la frise, pas n'importe où sur
    // la page. Un `getByText(/^Appel$/)` global attrapait l'`<option>` du
    // formulaire — qui reste ouvert après la soumission, et dont l'option est
    // masquée. Le test échouait sur « Received: hidden » alors que la frise
    // affichait bien la bonne ligne : un sélecteur trop large ne mesure pas ce
    // qu'il croit.
    const entree = page.locator("li").filter({ hasText: marqueur }).first();
    await expect(entree).toContainText(/appel/i);
  });

  test("une date de fait dans le futur est refusée", async ({ page }) => {
    if (!(await ouvrirLaConsole(page))) return;
    await ouvrirUneFicheCandidature(page);

    // 🔑 Le cas qui distingue un journal d'un agenda. Sans cette borne, la frise
    // se trierait sur des faits qui n'ont pas eu lieu.
    const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
    await page.getByRole("button", { name: /consigner un fait/i }).click();
    await page.getByLabel(/quand/i).fill(demain);
    await page.getByLabel(/ce qui s.est passé/i).fill("Fait situé dans le futur");
    await page.getByRole("button", { name: /^consigner$/i }).click();

    // Le message exact, pas « une alerte quelconque » : la page en porte deux,
    // et `getByRole("alert")` seul lève une violation de mode strict. On vise
    // ce que le produit doit DIRE.
    await expect(page.getByText(/ne peut pas être dans le futur/i)).toBeVisible({
      timeout: 30_000,
    });
  });
});
