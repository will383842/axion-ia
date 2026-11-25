// Parcours 1 (cas d'échec) — le dossier en ligne refuse une activité sans SIREN valide.
// Le parcours nominal (inscription → signature → contresignature → « Mes documents ») est joué par
// `../apporteur-parcours-complet.spec.ts`.
import { expect, test } from "@playwright/test";
import { capture, refuserCookies, semer } from "./outillage/aides";

test.skip(
  !process.env["APPORTEUR_BAC_A_SABLE"],
  "bac à sable seulement : poser APPORTEUR_BAC_A_SABLE=1",
);
test.use({ viewport: { width: 1280, height: 900 } });

test("1.x refus sans SIRET, puis refus d'un SIRET à clé fausse, sans quitter l'étape « Votre activité »", async ({
  page,
}) => {
  const a = semer("dossier", "dossier_en_cours");
  await page.goto(a.lien, { waitUntil: "domcontentloaded" });
  await refuserCookies(page);
  await expect(page.getByRole("heading", { name: "Vous" })).toBeVisible();
  await page.getByLabel("Téléphone").fill("0612345678");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByRole("heading", { name: "Votre activité" })).toBeVisible();
  // Sans SIRET : « Continuer » reste inactif et l'écran dit ce qui manque.
  await expect(page.getByRole("button", { name: "Continuer" })).toBeDisabled();
  await expect(page.getByText(/il manque/)).toBeVisible();
  await capture(page, "p1-01-refus-sans-siret");
  await page.getByLabel("Numéro SIRET").fill("12345678901234");
  // Clé de Luhn fausse : la recherche est refusée (bouton inactif) ou ne rend aucune ✓.
  const rechercher = page.getByRole("button", { name: "Rechercher" });
  if (await rechercher.isEnabled()) await rechercher.click();
  await expect(page.getByText("✓", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continuer" })).toBeDisabled();
  await capture(page, "p1-02-refus-siret-invalide");
});
