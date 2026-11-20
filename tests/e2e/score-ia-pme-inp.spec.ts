// INP de `/fr/diagnostic` (Score IA TPE-PME) : la RUM Web Vitals est coupée sur cette page privée,
// donc aucune mesure de terrain. Ce test borne en laboratoire la durée d'interaction (entrée →
// prochain affichage) d'un clic sur une option et d'un clic sur « Suivant ».
//
// Règle AGENTS.md sur les mesures de TEMPS : une passe isolée ne prouve rien sur un runner partagé.
// On lit la MÉDIANE de plusieurs passes, avec un seuil LARGE (garde anti-régression grossière, pas
// l'objectif interne de 100 ms, qui reste non surveillé sur le terrain).

import { test, expect, type Page } from "@playwright/test";

const PAGE = "/fr/diagnostic";
const PASSES = 5;
const SEUIL_MEDIANE_MS = 400;

function mediane(valeurs: number[]): number {
  const tri = [...valeurs].sort((a, b) => a - b);
  return tri[Math.floor(tri.length / 2)] ?? 0;
}

/** Un navigateur sans Event Timing mesurerait 0 ms : un vert à vide. On refuse de conclure. */
async function exigerEventTiming(page: Page): Promise<void> {
  const ok = await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes("event"));
  expect(ok, "API Event Timing indisponible : la mesure serait vide").toBe(true);
}

/** Durée entrée → affichage suivant d'un clic, via l'API Event Timing (comme l'INP). */
async function dureeDuClic(page: Page, clic: () => Promise<void>): Promise<number> {
  await page.evaluate(() => {
    const w = window as unknown as { __durees: number[] };
    w.__durees = [];
    new PerformanceObserver((liste) => {
      for (const e of liste.getEntries() as PerformanceEventTiming[]) {
        if (e.name === "click" || e.name === "pointerup") w.__durees.push(e.duration);
      }
    }).observe({ type: "event", durationThreshold: 16, buffered: false });
  });
  await clic();
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const w = window as unknown as { __durees?: number[] };
    return Math.max(0, ...(w.__durees ?? []));
  });
}

test.describe("Score IA TPE-PME — INP en laboratoire (médiane)", () => {
  // 5 passes × 2 écrans : au-delà du délai par défaut de 30 s.
  test.setTimeout(90_000);

  test("un clic d'option et un « Suivant » restent sous le seuil large (médiane)", async ({
    page,
  }) => {
    const options: number[] = [];
    const suivants: number[] = [];
    const optionsSecteur: number[] = [];
    for (let i = 0; i < PASSES; i += 1) {
      await page.goto(PAGE);
      await exigerEventTiming(page);
      // « Commencer » est rendu par le serveur : un clic avant l'hydratation est perdu.
      // On réessaie jusqu'à ce que le premier écran de questions soit affiché.
      await expect(async () => {
        await page.getByRole("button", { name: "Commencer" }).click({ timeout: 1_000 });
        await expect(page.getByRole("group").first()).toBeVisible({ timeout: 1_000 });
      }).toPass();

      // Écran 1 (taille). Pas de `force` : si l'en-tête collant intercepte le clic, Playwright
      // échoue au lieu de mesurer un clic sans travail.
      const option = page.getByRole("group").locator('input[type="radio"]').first();
      await option.scrollIntoViewIfNeeded();
      options.push(await dureeDuClic(page, () => option.click()));
      await expect(option).toBeChecked();
      suivants.push(
        await dureeDuClic(page, () => page.getByRole("button", { name: "Suivant" }).click()),
      );

      // Écran « secteur » (31 options groupées) : le plus lourd à rendre.
      // On avance (hors mesure) jusqu'à l'écran qui porte l'option « autre ».
      const secteur = page.getByRole("group").locator('input[value="autre"]');
      for (let q = 0; q < 15 && (await secteur.count()) === 0; q += 1) {
        await page
          .getByRole("group")
          .locator('input[type="radio"], input[type="checkbox"]')
          .first()
          .check();
        await page.getByRole("button", { name: /Suivant|Voir mon score/ }).click();
      }
      await expect(secteur).toBeVisible();
      const premier = page.getByRole("group").locator('input[type="radio"]').first();
      await premier.scrollIntoViewIfNeeded();
      optionsSecteur.push(await dureeDuClic(page, () => premier.click()));
      await expect(premier).toBeChecked();
    }
    console.warn(
      `INP labo /diagnostic — option : ${options}, suivant : ${suivants}, secteur : ${optionsSecteur}`,
    );
    expect(mediane(options)).toBeLessThan(SEUIL_MEDIANE_MS);
    expect(mediane(suivants)).toBeLessThan(SEUIL_MEDIANE_MS);
    expect(mediane(optionsSecteur)).toBeLessThan(SEUIL_MEDIANE_MS);
  });
});
