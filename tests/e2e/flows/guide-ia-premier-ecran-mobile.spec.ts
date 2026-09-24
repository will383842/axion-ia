// Le formulaire du guide tient dans le PREMIER ÉCRAN d'un téléphone (lot L1, 2026-09-25).
//
// Le défaut corrigé : sur un iPhone (390 × 664 px utiles), le champ e-mail était
// à 2 097 px du haut — 3,2 écrans de défilement avant de pouvoir demander le
// guide (audit `page-guide-ux.md`, mesure en production le 2026-09-24).
//
// Ce que ce test fige, sur la vraie page servie :
//   · champ, bouton ET mention d'information entiers au-dessus de 664 px ;
//   · aucun débordement horizontal à 390 px ;
//   · la couverture du guide est visible dans ce premier écran ;
//   · la barre collante est absente au chargement, apparaît une fois le
//     formulaire dépassé, et s'efface devant le second formulaire.
//
// Le projet CI est `chromium` (ci.yml) : la fenêtre est fixée ici, pas par le
// projet. Le bandeau cookies est écarté (consentement « refusé » posé avant le
// chargement) : il se superpose à la page sans rien déplacer, et c'est la
// mise en page qu'on mesure ici.

import { expect, test } from "@playwright/test";

const LARGEUR = 390;
const HAUTEUR = 664;

test.use({ viewport: { width: LARGEUR, height: HAUTEUR }, hasTouch: true, isMobile: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("axion-cookie-consent-v1", "declined");
      window.localStorage.setItem("axion-cookie-consent-v1:ts", String(Date.now()));
    } catch {
      /* stockage indisponible : le bandeau s'affichera, la mesure reste valable */
    }
  });
});

test.describe("@guide-ia premier écran mobile", () => {
  test.setTimeout(120_000);

  test("🔴 champ, bouton et mention tiennent dans les 664 premiers pixels", async ({ page }) => {
    await page.goto("/fr/guide-ia");
    const formulaire = page.locator("#recevoir");
    const champ = formulaire.locator('input[type="email"]');
    const bouton = formulaire.getByRole("button", { name: "Recevoir le guide" });
    const mention = formulaire.getByText("En recevant le guide, vous recevrez aussi");

    await expect(champ).toBeVisible();
    for (const [nom, cible] of [
      ["champ", champ],
      ["bouton", bouton],
      ["mention", mention],
    ] as const) {
      const boite = await cible.boundingBox();
      expect(boite, `${nom} sans boîte`).not.toBeNull();
      expect(boite!.y + boite!.height, `${nom} sous la ligne de flottaison`).toBeLessThanOrEqual(
        HAUTEUR,
      );
    }

    // Bouton : cible tactile d'au moins 44 px de haut.
    expect((await bouton.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    // La couverture du guide est dans le premier écran.
    const couverture = page.locator('img[src*="guide-ia-entreprise-2026-couverture"]').first();
    const bc = await couverture.boundingBox();
    expect(bc).not.toBeNull();
    expect(bc!.y + bc!.height).toBeLessThanOrEqual(HAUTEUR);

    const deborde = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(deborde, "débordement horizontal à 390 px").toBe(false);
  });

  test("la barre collante apparaît après le formulaire, s'efface devant le second", async ({
    page,
  }) => {
    await page.goto("/fr/guide-ia");
    const barre = page.locator('a[href="#recevoir"]').last();
    await expect(page.locator("#recevoir input[type=email]")).toBeVisible();
    await expect(barre).not.toBeInViewport();

    // Au milieu de la page : le premier formulaire est dépassé, le second loin.
    await page.locator("#guide-sommaire").scrollIntoViewIfNeeded();
    await expect(barre).toBeInViewport();

    // Devant le second formulaire : la barre s'efface.
    await page.locator("#recevoir-bas").scrollIntoViewIfNeeded();
    await expect(barre).not.toBeInViewport();
  });
});
