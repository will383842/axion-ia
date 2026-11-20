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
  test("un clic d'option et un « Suivant » restent sous le seuil large (médiane)", async ({
    page,
  }) => {
    const options: number[] = [];
    const suivants: number[] = [];
    for (let i = 0; i < PASSES; i += 1) {
      await page.goto(PAGE);
      await page.getByRole("button", { name: "Commencer" }).click();
      const option = page.getByRole("group").locator('input[type="radio"]').first();
      options.push(await dureeDuClic(page, () => option.click({ force: true })));
      suivants.push(
        await dureeDuClic(page, () => page.getByRole("button", { name: "Suivant" }).click()),
      );
    }
    console.warn(`INP labo /diagnostic — option : ${options}, suivant : ${suivants}`);
    expect(mediane(options)).toBeLessThan(SEUIL_MEDIANE_MS);
    expect(mediane(suivants)).toBeLessThan(SEUIL_MEDIANE_MS);
  });
});
