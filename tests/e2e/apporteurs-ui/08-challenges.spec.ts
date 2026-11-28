// Parcours 8 — challenges : création dans la console (brouillon), publication validée par trois cases,
// encart dans l'espace de l'apporteur (sans classement), pas deux primes sur une même période.
// Données fictives, bac à sable (APPORTEUR_CHALLENGES_CONSOLE_ENABLED et …_ESPACE_ENABLED = true).
import { expect, test, type Page } from "@playwright/test";
import { ADMIN_PREFIX, loginAsAdmin } from "../fixtures/admin-auth";
import { aujourdhuiParis, refuserCookies } from "./outillage/aides";
import { apporteurMonde, capturer, monde, type ApporteurMonde } from "./outillage/campagne";

test.describe.configure({ timeout: 300_000 });
test.skip(
  process.env["APPORTEUR_BAC_A_SABLE"] !== "1",
  "bac à sable seulement : poser APPORTEUR_BAC_A_SABLE=1",
);
test.use({ viewport: { width: 1280, height: 900 } });

const jourParis = (decalage: number): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(
    new Date(Date.now() + decalage * 86_400_000),
  );
const REGLEMENT =
  "Ce challenge est une invitation libre, ouverte à tous les apporteurs aux mêmes conditions.\n" +
  "Rien n'est attendu de vous : ne pas obtenir la prime ne change rien à votre contrat ni à vos commissions.";
const liste = `/fr/${ADMIN_PREFIX}/apporteurs/challenges`;

async function remplir(
  page: Page,
  v: {
    titre: string;
    debut: string;
    fin: string;
    seuil: string;
    prime: string;
    reglement?: string;
  },
): Promise<void> {
  await page.getByLabel(/^Titre/).fill(v.titre);
  await page.getByLabel("Premier jour (heure de Paris)").fill(v.debut);
  await page.getByLabel("Dernier jour (heure de Paris)").fill(v.fin);
  await page.getByLabel("Seuil (nombre)").fill(v.seuil);
  await page.getByLabel("Prime HT (€)").fill(v.prime);
  await page.getByLabel(/^Règlement/).fill(v.reglement ?? REGLEMENT);
}

let ap: ApporteurMonde;
const TITRE_A = `Challenge du mois fictif ${Date.now()}`;
const TITRE_B = `Challenge concurrent fictif ${Date.now()}`;
let urlA = "";

test.describe.serial("@apporteur parcours 8 — challenges", () => {
  test.beforeAll(() => {
    ap = apporteurMonde("chal");
    monde("purger-challenges");
  });

  test("8.1 console : un brouillon se crée ; l'espace n'en montre rien", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${liste}/nouveau`, { waitUntil: "domcontentloaded" });
    await remplir(page, {
      titre: TITRE_A,
      debut: aujourdhuiParis(),
      fin: jourParis(30),
      seuil: "2",
      prime: "300",
    });
    await capturer(page, "p8-01-console-formulaire");
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await page.waitForURL(/\/apporteurs\/challenges\/[0-9a-f-]{36}\?retour=brouillon/, {
      timeout: 60_000,
    });
    urlA = new URL(page.url()).pathname;
    await expect(page.locator("main")).toContainText(TITRE_A);
    await capturer(page, "p8-02-console-brouillon");
    await page.goto(ap.lien, { waitUntil: "domcontentloaded" });
    await refuserCookies(page);
    await expect(page.getByText(TITRE_A)).toHaveCount(0);
    await expect(page.getByText(/prime de/i)).toHaveCount(0);
    await capturer(page, "p8-03-espace-sans-encart");
  });

  test("8.2 erreurs de saisie : titre vide, seuil hors limites, fin avant début, règlement à formule de pression", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${liste}/nouveau`, { waitUntil: "domcontentloaded" });
    // Champ vide : le navigateur bloque (required) avant tout envoi.
    expect(
      await page.getByLabel(/^Titre/).evaluate((e: HTMLInputElement) => e.validity.valueMissing),
    ).toBe(true);
    await remplir(page, {
      titre: "Titre",
      debut: jourParis(10),
      fin: jourParis(5),
      seuil: "0",
      prime: "-3",
    });
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    const alerte = page.getByRole("alert").filter({ hasText: /dernier jour|seuil|prime/i });
    await expect(alerte).toBeVisible({ timeout: 60_000 });
    await expect(alerte).toContainText("Le dernier jour ne peut pas précéder le premier.");
    await expect(alerte).toContainText("Le seuil est un entier de 1 à 999.");
    await expect(alerte).toContainText("La prime est un montant en euros, supérieur à 0.");
    await capturer(page, "p8-04-console-erreurs");
    await remplir(page, {
      titre: "Titre",
      debut: jourParis(10),
      fin: jourParis(20),
      seuil: "2",
      prime: "100",
      reglement:
        "Dépêchez-vous : dernière chance, offre limitée, il ne reste plus que quelques jours !",
    });
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await expect(page.locator("form p[role=alert]")).toContainText(/pression ou interdite/, {
      timeout: 60_000,
    });
    await capturer(page, "p8-05-console-formule-interdite");
  });

  test("8.3 publication : trois cases exigées, double clic = une publication ; l'encart apparaît sans classement", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(urlA, { waitUntil: "domcontentloaded" });
    const publier = page.getByRole("button", { name: "Publier le challenge" });
    // Sans les cases : le navigateur bloque, rien n'est publié.
    await publier.click();
    expect(
      await page
        .locator('input[name="case1"]')
        .evaluate((e: HTMLInputElement) => e.validity.valueMissing),
    ).toBe(true);
    await expect(page.getByText(/Ce challenge est publié/)).toHaveCount(0);
    await capturer(page, "p8-06-console-publication-sans-cases");
    for (const c of ["case1", "case2", "case3"]) await page.locator(`input[name="${c}"]`).check();
    await capturer(page, "p8-07-console-cases-cochees");
    await publier.dblclick();
    await expect(page.getByText(/Ce challenge est publié/)).toBeVisible({ timeout: 60_000 });
    await capturer(page, "p8-08-console-publie");
    // Espace : l'encart dit la règle, jamais un classement ni une pression.
    await page.goto(ap.lien, { waitUntil: "domcontentloaded" });
    await refuserCookies(page);
    const encart = page.locator("section[aria-labelledby='titre-challenge']");
    await expect(encart).toBeVisible();
    await expect(encart).toContainText(TITRE_A);
    await expect(encart).toContainText(/Une prime de .*300.* HT/);
    await expect(encart).toContainText("Rien n'est attendu de vous");
    const texte = (await encart.innerText()).toLowerCase();
    for (const interdit of [
      "classement",
      "rang",
      "meilleur",
      "podium",
      "top ",
      "plus que",
      "dernier jour pour",
      "compte à rebours",
    ])
      expect(texte, `l'encart ne contient pas « ${interdit} »`).not.toContain(interdit);
    await capturer(page, "p8-09-espace-encart");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(encart).toBeVisible();
    await encart.getByRole("link", { name: /Lire le règlement/ }).click();
    await expect(page.locator("main")).toContainText("invitation libre");
    await capturer(page, "p8-10-espace-reglement");
  });

  test("8.4 pas deux primes sur une même période : un second challenge qui chevauche ne se publie pas", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${liste}/nouveau`, { waitUntil: "domcontentloaded" });
    await remplir(page, {
      titre: TITRE_B,
      debut: jourParis(10),
      fin: jourParis(40),
      seuil: "1",
      prime: "150",
    });
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await page.waitForURL(/\/apporteurs\/challenges\/[0-9a-f-]{36}\?retour=brouillon/, {
      timeout: 60_000,
    });
    for (const c of ["case1", "case2", "case3"]) await page.locator(`input[name="${c}"]`).check();
    await page.getByRole("button", { name: "Publier le challenge" }).click();
    await expect(page.getByText(/les primes de challenges ne se cumulent pas/)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(/Ce challenge est publié/)).toHaveCount(0);
    await capturer(page, "p8-11-console-chevauchement-refuse");
    // L'espace ne montre que le premier.
    await page.goto(ap.lien, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(TITRE_B)).toHaveCount(0);
  });

  test("8.5 accès sans session : la console des challenges renvoie à la connexion", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(liste, { waitUntil: "domcontentloaded" });
    expect(p.url()).toMatch(/login/);
    await capturer(p, "p8-12-console-sans-session");
    await ctx.close();
  });
});
