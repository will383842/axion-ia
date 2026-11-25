// Parcours 6 — résiliation en deux temps par la console, préavis de 30 jours (art. 11.1), jour de
// notification non compté ; e-mails capturés (jamais envoyés).
import { expect, test } from "@playwright/test";
import { ADMIN_PREFIX, loginAsAdmin } from "../fixtures/admin-auth";
import { aujourdhuiParis, capture, emailsCaptures, semer } from "./outillage/aides";

test.skip(
  !process.env["APPORTEUR_BAC_A_SABLE"],
  "bac à sable seulement : poser APPORTEUR_BAC_A_SABLE=1",
);
test.use({ viewport: { width: 1280, height: 900 } });

test("6.1 résiliation 11.1 : notification enregistrée, effet à 00 h le 31e jour (30 jours pleins, jour de notification non compté), e-mail du premier temps en file", async ({
  page,
}) => {
  const a = semer("resil");
  const jour = aujourdhuiParis(); // une seule lecture : le test traverse parfois minuit
  await loginAsAdmin(page);
  await page.goto(`/fr/${ADMIN_PREFIX}/apporteurs/${a.id}`, { waitUntil: "domcontentloaded" });
  await page.getByText("Résilier le contrat").first().click();
  await page.getByLabel("Date de la notification écrite").fill(jour);
  await page.getByLabel("Je confirme la résiliation de ce contrat.").check();
  await capture(page, "p6-01-formulaire");
  await page.getByRole("button", { name: "Notifier la résiliation" }).click();
  await page.waitForTimeout(3000);
  await capture(page, "p6-02-apres-notification");
  const corps = await page.locator("main").innerText();
  const effet = new Date(`${jour}T00:00:00Z`);
  // Préavis de 30 jours, jour de notification NON compté : effet à 00 h le 31e jour (J+31 à minuit).
  effet.setUTCDate(effet.getUTCDate() + 31);
  const attendu = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(effet);
  expect(corps, `date d'effet attendue : ${attendu}`).toContain(attendu.replace(/^1 /, "1er "));
  expect((await emailsCaptures(a.email)).length).toBeGreaterThan(0);
});

test("6.2 échec : sans la case de confirmation, rien n'est notifié", async ({ page }) => {
  const a = semer("resil2");
  await loginAsAdmin(page);
  await page.goto(`/fr/${ADMIN_PREFIX}/apporteurs/${a.id}`, { waitUntil: "domcontentloaded" });
  await page.getByText("Résilier le contrat").first().click();
  await page.getByLabel("Date de la notification écrite").fill(aujourdhuiParis());
  await page.getByRole("button", { name: "Notifier la résiliation" }).click();
  await page.waitForTimeout(1500);
  expect(await emailsCaptures(a.email)).toHaveLength(0);
  await capture(page, "p6-03-sans-confirmation");
});
