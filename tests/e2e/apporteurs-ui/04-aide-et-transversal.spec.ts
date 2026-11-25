// Parcours 7 — « Besoin d'aide », e-mails capturés, états vides, clavier, mobile 390 px.
import { expect, test } from "@playwright/test";
import {
  capture,
  emailsCaptures,
  refuserCookies,
  semer,
  type ApporteurSeme,
} from "./outillage/aides";

test.skip(
  process.env["APPORTEUR_BAC_A_SABLE"] !== "1",
  "bac à sable seulement : poser APPORTEUR_BAC_A_SABLE=1",
);

let a: ApporteurSeme;
test.beforeAll(() => {
  a = semer("aide");
});

test("7.1 « Besoin d'aide » : message trop court refusé, puis envoyé et capturé", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(a.lien, { waitUntil: "domcontentloaded" });
  await refuserCookies(page);
  await page
    .getByRole("link", { name: /Besoin d'aide/ })
    .first()
    .click();
  await page.waitForURL(/\/aide$/);
  await page.getByLabel("Votre question porte sur").selectOption({ label: "Mes commissions" });
  await page.getByLabel("Votre message").fill("court");
  // Refusé par le formulaire lui-même (10 caractères au moins) : rien ne part.
  expect(
    await page
      .getByLabel("Votre message")
      .evaluate((e: HTMLTextAreaElement) => e.validity.tooShort),
  ).toBe(true);
  await capture(page, "p7-01-aide-trop-court");
  const message = `Bonjour, question de test fictive ${Date.now()} sur le calcul de ma commission, merci.`;
  await page.getByLabel("Votre message").fill(message);
  await page.getByRole("button", { name: "Envoyer mon message" }).click();
  await expect(page.getByText(/bien parti/).first()).toBeVisible({ timeout: 60_000 });
  await capture(page, "p7-02-aide-envoyee");
  const mails = await emailsCaptures(String(message.match(/\d{13}/)![0]));
  expect(mails.length, "un e-mail interne attendu en file").toBeGreaterThan(0);
});

test("7.2 clavier : la tabulation atteint les champs de la déclaration avec un focus visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(a.lien, { waitUntil: "domcontentloaded" });
  await refuserCookies(page);
  const vus = new Set<string>();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      if (!e) return null;
      const sig = () => {
        const s = getComputedStyle(e);
        return [s.outlineStyle, s.outlineColor, s.boxShadow, s.borderColor].join("|");
      };
      const avec = sig();
      e.blur();
      const sans = sig();
      e.focus();
      return {
        tag: e.tagName,
        nom: e.getAttribute("name") ?? e.textContent?.trim().slice(0, 30) ?? "",
        contour: avec !== sans,
      };
    });
    if (info) vus.add(`${info.tag}:${info.nom}:${info.contour}`);
  }
  const champs = [...vus].filter((v) => v.startsWith("INPUT:"));
  expect(champs.length).toBeGreaterThanOrEqual(6);
  expect(
    champs.every((c) => c.endsWith(":true")),
    `focus sans contour : ${champs.filter((c) => !c.endsWith(":true")).join(", ")}`,
  ).toBe(true);
});

for (const [nom, chemin] of [
  ["accueil", ""],
  ["aide", "/aide"],
  ["documents", "/documents"],
  ["commissions", "/commissions"],
  ["outils", "/outils"],
] as const) {
  test(`7.3 mobile 390 px : « ${nom} » sans défilement horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(a.lien + chemin, { waitUntil: "domcontentloaded" });
    await refuserCookies(page);
    await capture(page, `p7-03-mobile-${nom}`);
    const debord = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(debord, `débordement horizontal de ${debord}px`).toBeLessThanOrEqual(1);
  });
}
