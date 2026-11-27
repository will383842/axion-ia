// Parcours 2 — déclaration d'une entreprise par l'interface (données fictives, bac à sable).
// Ce que la main actuelle fait (règle « 6 mois », contrat 2.6) : les écarts avec les règles cibles
// (60 jours, 30 jours de repos…) sont consignés dans le rapport, pas masqués ici.
import { expect, test, type Page } from "@playwright/test";
import { ADMIN_PREFIX, loginAsAdmin } from "../fixtures/admin-auth";
import {
  aujourdhuiParis,
  capture,
  emailsCaptures,
  refuserCookies,
  semer,
  siretDe,
  type ApporteurSeme,
} from "./outillage/aides";

// Budget de la suite : les attentes internes (60 s) et la connexion admin (180 s) doivent pouvoir expirer
// avant lui (cliquet delai-interne-sous-le-budget). Même valeur que outillage/playwright.config.ts.
test.describe.configure({ timeout: 300_000 });

test.skip(
  process.env["APPORTEUR_BAC_A_SABLE"] !== "1",
  "bac à sable seulement : poser APPORTEUR_BAC_A_SABLE=1",
);
test.use({ viewport: { width: 1280, height: 900 } });

async function remplir(page: Page, siret: string, nom: string, extra: Record<string, string> = {}) {
  await page.getByLabel("Numéro SIRET de l'établissement", { exact: false }).first().fill(siret);
  await page.getByLabel("Nom de l'entreprise", { exact: false }).first().fill(nom);
  await page.locator('input[name="personneNom"]').fill("Dupont Fictif");
  await page.locator('input[name="personneFonction"]').fill("Directrice");
  await page
    .locator('input[name="personneEmail"]')
    .fill(extra["email"] ?? "contact.fictif@exemple.invalid");
  await page.locator('input[name="personneTelephone"]').fill(extra["tel"] ?? "0639980001");
  await page.locator('input[name="dateContact"]').fill(extra["date"] ?? aujourdhuiParis());
}

let a: ApporteurSeme;
let b: ApporteurSeme;
const SIRET = siretDe("987654325"); // SIREN fabriqué, clé de Luhn volontairement fausse : aucune entreprise réelle ; le SIRET complété est valide
const NOM = `Boulangerie Fictive ${Date.now()}`;

test.describe.serial("@apporteur parcours 2 — déclaration", () => {
  test.beforeAll(() => {
    a = semer("decl-a");
    b = semer("decl-b");
  });

  test("2.1 déclaration valide : « Déclaration reçue », puis visible dans « Vos déclarations »", async ({
    page,
  }) => {
    await page.goto(a.lien, { waitUntil: "domcontentloaded" });
    await refuserCookies(page);
    await expect(page.getByText("Aucune déclaration pour le moment.")).toBeVisible(); // état vide
    await capture(page, "p2-01-etat-vide");
    await remplir(page, SIRET, NOM);
    await page.getByRole("button", { name: "Déclarer cette entreprise" }).click();
    await expect(page.getByText("Déclaration reçue")).toBeVisible({ timeout: 60_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(NOM).first()).toBeVisible();
    await capture(page, "p2-02-declaree");
  });

  test("2.2 échec : SIRET invalide, date future, e-mail invalide", async ({ page }) => {
    await page.goto(a.lien, { waitUntil: "domcontentloaded" });
    await remplir(page, "12345678901234", "Entreprise Bidon");
    await page.getByRole("button", { name: "Déclarer cette entreprise" }).click();
    await expect(page.getByText(/SIRET n'est pas valide/)).toBeVisible();
    // Date future : le navigateur la refuse lui-même (max = aujourd'hui) avant tout envoi.
    await remplir(page, SIRET, "Entreprise Bidon", { date: "2099-01-01" });
    expect(
      await page
        .locator('input[name="dateContact"]')
        .evaluate((e: HTMLInputElement) => e.validity.rangeOverflow),
    ).toBe(true);
    await remplir(page, SIRET, "Entreprise Bidon", {
      email: "pas-un-email",
      date: aujourdhuiParis(),
    });
    // E-mail mal formé : refusé par le navigateur (type=email) avant tout envoi.
    expect(
      await page
        .locator('input[name="personneEmail"]')
        .evaluate((e: HTMLInputElement) => e.validity.valid),
    ).toBe(false);
    await capture(page, "p2-03-erreurs");
  });

  test("2.3 doublon du même apporteur : « Vous avez déjà déclaré cet établissement. »", async ({
    page,
  }) => {
    await page.goto(a.lien, { waitUntil: "domcontentloaded" });
    await remplir(page, SIRET, NOM);
    await page.getByRole("button", { name: "Déclarer cette entreprise" }).click();
    await expect(page.getByText("Vous avez déjà déclaré cet établissement.")).toBeVisible({
      timeout: 60_000,
    });
    await capture(page, "p2-04-doublon-meme-apporteur");
  });

  test("2.4 doublon d'un AUTRE apporteur : état actuel de main (déclaration reçue, arbitrage par la console), rien ne révèle le premier", async ({
    page,
  }) => {
    await page.goto(b.lien, { waitUntil: "domcontentloaded" });
    await remplir(page, SIRET, NOM);
    await page.getByRole("button", { name: "Déclarer cette entreprise" }).click();
    // ÉCART au rapport : la règle cible (« personne d'autre ne peut la déclarer ») n'est pas appliquée à
    // la déclaration ; deux apporteurs peuvent réserver le même SIREN, la console arbitre.
    await expect(page.getByText("Déclaration reçue")).toBeVisible({ timeout: 60_000 });
    const texte = await page.locator("main").innerText();
    expect(texte).not.toContain("decl-a");
    await capture(page, "p2-05-doublon-autre-apporteur");
  });

  test("2.5 console : la déclaration est « À traiter » ; l'alerte interne est en file", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`/fr/${ADMIN_PREFIX}/apporteurs/entreprises?onglet=a-traiter`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText(NOM).first()).toBeVisible();
    await capture(page, "p2-06-console-a-traiter");
    // L'alerte interne de la déclaration est bien en file (rien n'est envoyé).
    expect((await emailsCaptures(NOM)).length).toBeGreaterThan(0);
  });
});
