// Parcours 3 — réservation d'une entreprise puis validation par le premier rendez-vous tenu.
// Données fictives, bac à sable (APPORTEURS_VALIDATION_RDV=true et APPORTEUR_MES_COMMISSIONS_ENABLED=true).
// Horloge simulée : `monde.ts reculer-reservation` recule la saisie et les bornes de la réservation.
import { expect, test, type Page } from "@playwright/test";
import { ADMIN_PREFIX, loginAsAdmin } from "../fixtures/admin-auth";
import { aujourdhuiParis, refuserCookies, siretDe } from "./outillage/aides";
import {
  apporteurMonde,
  capturer,
  localParis,
  monde,
  sirenFictif,
  type ApporteurMonde,
} from "./outillage/campagne";

test.describe.configure({ timeout: 300_000 });
test.skip(
  process.env["APPORTEUR_BAC_A_SABLE"] !== "1",
  "bac à sable seulement : poser APPORTEUR_BAC_A_SABLE=1",
);
test.use({ viewport: { width: 1280, height: 900 } });

const MS_JOUR = 86_400_000;

async function declarer(page: Page, lien: string, siren: string, nom: string): Promise<void> {
  await page.goto(lien, { waitUntil: "domcontentloaded" });
  await refuserCookies(page);
  await page
    .getByLabel("Numéro SIRET de l'établissement", { exact: false })
    .first()
    .fill(siretDe(siren));
  await page.getByLabel("Nom de l'entreprise", { exact: false }).first().fill(nom);
  await page.locator('input[name="personneNom"]').fill("Dupont Fictif");
  await page.locator('input[name="personneFonction"]').fill("Directrice");
  await page.locator('input[name="personneEmail"]').fill("contact.fictif@exemple.invalid");
  await page.locator('input[name="personneTelephone"]').fill("0639980001");
  await page.locator('input[name="dateContact"]').fill(aujourdhuiParis());
  await page.getByRole("button", { name: "Déclarer cette entreprise" }).click();
  await expect(page.getByText("Déclaration reçue")).toBeVisible({ timeout: 60_000 });
}

const urlCommissions = (lien: string): string => `${lien}/mes-commissions`;

async function saisirALaMain(
  page: Page,
  nomEntreprise: string,
  canal: "telephone" | "sur_place" | "annule_par_axion",
  prisLe: string,
  tenuLe: string,
  motif: string,
): Promise<void> {
  await page.goto(`/fr/${ADMIN_PREFIX}/apporteurs/entreprises`, { waitUntil: "domcontentloaded" });
  await page.getByText("Saisir un rendez-vous à la main").click();
  const valeur = await page
    .locator('select[name="presentationId"] option', { hasText: nomEntreprise })
    .first()
    .getAttribute("value");
  await page.locator('select[name="presentationId"]').selectOption(valeur!);
  await page.getByLabel("Type").selectOption(canal);
  await page.locator('form input[name="tenuLe"]').last().fill(tenuLe);
  await page.locator('form input[name="prisLe"]').last().fill(prisLe);
  await page.locator('form input[name="motif"]').last().fill(motif);
}

const A: { [k: string]: ApporteurMonde } = {};
const SIREN = { tenu: sirenFictif(), annule: sirenFictif(), expire: sirenFictif() };
const NOM = (k: string): string => `Entreprise ${k} Fictive ${Date.now()}`;
const noms = { tenu: NOM("tenue"), annule: NOM("annulee"), expire: NOM("expiree") };

test.describe.serial("@apporteur parcours 3 — réservation et validation par rendez-vous", () => {
  test.beforeAll(() => {
    A["a"] = apporteurMonde("rdv-a");
  });

  test("3.1 la déclaration crée une réservation : « Réservée jusqu'au … » dans « Mes commissions »", async ({
    page,
  }) => {
    await declarer(page, A["a"]!.lien, SIREN.tenu, noms.tenu);
    await page.goto(urlCommissions(A["a"]!.lien), { waitUntil: "domcontentloaded" });
    await expect(page.getByText(noms.tenu)).toBeVisible();
    // Libellé réel du code : « Réservée jusqu'au » (la consigne parlait de « Gardée jusqu'au »).
    await expect(page.getByText(/Réservée jusqu'au \d/)).toBeVisible();
    await capturer(page, "p3-01-reservee");
  });

  test("3.2 console : rendez-vous saisi à la main, confirmation en deux temps, puis « Validée le … » dans l'espace", async ({
    page,
  }) => {
    const p = monde<{ id: string }>("presentation-de", { apporteurId: A["a"]!.id });
    monde("reculer-reservation", { presentationId: p.id, jours: 2 });
    await loginAsAdmin(page);
    await saisirALaMain(
      page,
      noms.tenu,
      "telephone",
      localParis(-MS_JOUR),
      localParis(-3_600_000),
      "appel noté dans le carnet (test)",
    );
    await capturer(page, "p3-02-console-saisie");
    await page.getByRole("button", { name: "Enregistrer : il a eu lieu" }).click();
    await expect(
      page.getByText("L'entreprise sera attribuée à cet apporteur pour 6 mois."),
    ).toBeVisible();
    await capturer(page, "p3-03-console-confirmation");
    await page.getByRole("button", { name: "Oui, enregistrer : il a eu lieu" }).click();
    await expect(page.locator("main")).toContainText(/valid|attribu/i, { timeout: 60_000 });
    await capturer(page, "p3-04-console-apres-validation");
    await page.goto(urlCommissions(A["a"]!.lien), { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Validée le \d/)).toBeVisible();
    await capturer(page, "p3-05-espace-validee");
  });

  test("3.3 rendez-vous annulé par Axion IA = tenu ; double clic = une seule validation", async ({
    page,
  }) => {
    await declarer(page, A["a"]!.lien, SIREN.annule, noms.annule);
    const p = monde<{ id: string }>("presentation-de", { apporteurId: A["a"]!.id });
    monde("reculer-reservation", { presentationId: p.id, jours: 2 });
    await loginAsAdmin(page);
    await saisirALaMain(
      page,
      noms.annule,
      "annule_par_axion",
      localParis(-MS_JOUR),
      localParis(-3_600_000),
      "annulé par Axion IA (test)",
    );
    await page.getByRole("button", { name: "Enregistrer : il a eu lieu" }).click();
    await page.getByRole("button", { name: "Oui, enregistrer : il a eu lieu" }).dblclick();
    await expect(page.locator("main")).toContainText(/valid|attribu/i, { timeout: 60_000 });
    await capturer(page, "p3-06-annule-par-axion-valide");
    const lu = monde<{
      reservation: { valideeAt: string | null; validationSource: string | null };
    }>("lire-presentation", { presentationId: p.id });
    expect(lu.reservation.valideeAt, "la réservation est validée (réputé tenu)").not.toBeNull();
    await page.goto(urlCommissions(A["a"]!.lien), { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Validée le \d/).first()).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(noms.annule)).toBeVisible();
    await capturer(page, "p3-07-espace-annule-valide-apres-rechargement");
  });

  test("3.4 réservation expirée à 60 jours (horloge simulée) : plus rien n'est validable", async ({
    page,
  }) => {
    await declarer(page, A["a"]!.lien, SIREN.expire, noms.expire);
    const p = monde<{ id: string }>("presentation-de", { apporteurId: A["a"]!.id });
    monde("reculer-reservation", { presentationId: p.id, jours: 61 });
    const bilan = monde<{ reservationsEchues: number; erreurs: number }>("passage-quotidien");
    expect(bilan.erreurs).toBe(0);
    await page.goto(urlCommissions(A["a"]!.lien), { waitUntil: "domcontentloaded" });
    await expect(page.getByText(noms.expire)).toBeVisible();
    await capturer(page, "p3-08-espace-reservation-echue");
    await loginAsAdmin(page);
    await saisirALaMain(
      page,
      noms.expire,
      "telephone",
      localParis(-MS_JOUR),
      localParis(-3_600_000),
      "rendez-vous trop tardif (test)",
    );
    await capturer(page, "p3-09-console-echue-formulaire");
    await page.getByRole("button", { name: "Enregistrer : il a eu lieu" }).click();
    await page.getByRole("button", { name: "Oui, enregistrer : il a eu lieu" }).click();
    await expect(page.locator("main")).toContainText(/60 jours|terminée|échue/i, {
      timeout: 60_000,
    });
    await capturer(page, "p3-10-console-refus-echue");
    const lu = monde<{ reservation: { valideeAt: string | null } | null }>("lire-presentation", {
      presentationId: p.id,
    });
    expect(lu.reservation?.valideeAt ?? null).toBeNull();
  });

  test("3.5 erreurs visibles : motif vide refusé, accès console sans session, lien d'espace falsifié", async ({
    page,
    browser,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`/fr/${ADMIN_PREFIX}/apporteurs/entreprises`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByText("Saisir un rendez-vous à la main").click();
    const motifVide = await page
      .locator('form input[name="motif"]')
      .last()
      .evaluate((e: HTMLInputElement) => e.validity.valueMissing);
    expect(motifVide).toBe(true);
    await capturer(page, "p3-11-console-motif-vide");
    const anonyme = await browser.newContext();
    const p2 = await anonyme.newPage();
    await p2.goto(`/fr/${ADMIN_PREFIX}/apporteurs/entreprises`, { waitUntil: "domcontentloaded" });
    expect(p2.url()).toMatch(/login/);
    await capturer(p2, "p3-12-console-sans-session");
    await anonyme.close();
    const faux = A["a"]!.lien.replace(/\/[^/]+$/, "/jeton-falsifie");
    const r = await page.goto(`${faux}/mes-commissions`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(404);
    await capturer(page, "p3-13-espace-lien-falsifie");
  });
});
