// Parcours 10 — « Mes documents », guide de démarrage, bouton « Besoin d'aide », contrat 2.8.
// Données fictives, bac à sable. Le texte du PDF du contrat est lu avec `pdftotext` (poppler).
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { emailsCaptures, refuserCookies } from "./outillage/aides";
import { apporteurMonde, capturer, type ApporteurMonde } from "./outillage/campagne";

test.describe.configure({ timeout: 300_000 });
test.skip(
  process.env["APPORTEUR_BAC_A_SABLE"] !== "1",
  "bac à sable seulement : poser APPORTEUR_BAC_A_SABLE=1",
);
test.use({ viewport: { width: 1280, height: 900 } });

function texteDuPdf(octets: Buffer): string {
  const dossier = mkdtempSync(join(tmpdir(), "pdf-e2e-"));
  const f = join(dossier, "c.pdf");
  writeFileSync(f, octets);
  return execFileSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8" });
}

let signe: ApporteurMonde;
let enCours: ApporteurMonde;

test.describe.serial("@apporteur parcours 10 — documents, guide, aide, contrat 2.8", () => {
  test.beforeAll(() => {
    signe = apporteurMonde("doc-signe");
    enCours = apporteurMonde("doc-cours", { statut: "dossier_en_cours" });
  });

  test("10.1 « Mes documents » (apporteur sous contrat) : intro, guide de démarrage, fiche des commissions, outils", async ({
    page,
  }) => {
    await page.goto(signe.lien, { waitUntil: "domcontentloaded" });
    await refuserCookies(page);
    await page
      .getByRole("link", { name: /Mes documents/ })
      .first()
      .click();
    await page.waitForURL(/\/documents$/);
    await expect(page.getByRole("heading", { name: "Mes documents" })).toBeVisible();
    await expect(page.getByText("Tous les documents que nous vous avons remis")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Votre guide de démarrage" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "La fiche des commissions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mes outils de communication" })).toBeVisible();
    await capturer(page, "p10-01-mes-documents");
    // Rechargement : même contenu.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Mes documents" })).toBeVisible();
    await page.getByRole("link", { name: /Retour à mon espace/ }).click();
    await expect(page).toHaveURL(new RegExp(`${signe.lien}$`));
  });

  test("10.2 guide de démarrage et fiche des commissions : le lien répond (PDF ou message net, jamais une erreur serveur)", async ({
    page,
  }) => {
    for (const chemin of ["guide", "fiche-commissions"]) {
      const r = await page.request.get(`${signe.lien}/${chemin}`);
      expect([200, 404], `/${chemin} → ${r.status()}`).toContain(r.status());
      if (r.status() === 200) expect((await r.body()).subarray(0, 4).toString()).toBe("%PDF");
    }
    await page.goto(`${signe.lien}/documents`, { waitUntil: "domcontentloaded" });
    const lienGuide = page.getByRole("link", { name: /Ouvrir le guide/ });
    await expect(lienGuide).toBeVisible();
    await capturer(page, "p10-02-documents-guide");
  });

  test("10.3 « Besoin d'aide » : champ vide refusé, message envoyé, double clic = un seul envoi", async ({
    page,
  }) => {
    await page.goto(signe.lien, { waitUntil: "domcontentloaded" });
    await refuserCookies(page);
    await page
      .getByRole("link", { name: /Besoin d'aide/ })
      .first()
      .click();
    await page.waitForURL(/\/aide$/);
    await capturer(page, "p10-03-aide-formulaire");
    // Champ vide : le navigateur bloque l'envoi.
    await page.getByRole("button", { name: "Envoyer mon message" }).click();
    expect(
      await page.getByLabel("Votre message").evaluate((e: HTMLTextAreaElement) => e.validity.valid),
    ).toBe(false);
    const marque = String(Date.now());
    await page.getByLabel("Votre question porte sur").selectOption({ index: 1 });
    await page
      .getByLabel("Votre message")
      .fill(`Question fictive de test ${marque} sur mes documents, merci.`);
    await page.getByRole("button", { name: "Envoyer mon message" }).dblclick();
    await expect(page.getByText(/bien parti/).first()).toBeVisible({ timeout: 60_000 });
    await capturer(page, "p10-04-aide-envoyee");
    const mails = await emailsCaptures(marque);
    expect(mails.length, "un seul e-mail interne en file malgré le double clic").toBe(1);
  });

  test("10.4 « Besoin d'aide » reste disponible sur « Mes documents » ; lien falsifié : page neutre", async ({
    page,
  }) => {
    await page.goto(`${signe.lien}/documents`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /Besoin d'aide/ }).first()).toBeVisible();
    const faux = signe.lien.replace(/\/[^/]+$/, "/jeton-falsifie");
    const r = await page.goto(`${faux}/documents`, { waitUntil: "domcontentloaded" });
    // « Réservé » : écran neutre, rien ne révèle l'existence du dossier.
    expect([200, 404]).toContain(r?.status());
    await expect(page.locator("body")).not.toContainText("Mes documents");
    await expect(page.locator("body")).not.toContainText("doc-signe");
    await capturer(page, "p10-05-documents-lien-falsifie");
  });

  test("10.5 contrat 2.8 : le contrat remis avant signature (PDF) porte la version 2.8", async ({
    page,
  }) => {
    const r = await page.request.get(`${enCours.lien}/contrat`);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("application/pdf");
    const texte = texteDuPdf(await r.body());
    expect(texte).toContain("Contrat d'apporteur d'affaires");
    expect(texte, "la version 2.8 du contrat est affichée").toMatch(/2\.8/);
    expect(texte, "ni l'ancienne version comme version courante").not.toMatch(/version\s*2\.6/i);
    // L'écran du dossier propose bien ce même contrat.
    await page.goto(enCours.lien, { waitUntil: "domcontentloaded" });
    await refuserCookies(page);
    await capturer(page, "p10-06-dossier-en-cours");
  });
});
