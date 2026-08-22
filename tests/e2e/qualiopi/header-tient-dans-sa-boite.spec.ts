/**
 * CLIQUET — la rangée du header doit tenir dans sa BOÎTE DE CONTENU.
 *
 * 🔴 2026-08-21 — les trois seuils de bascule (`--breakpoint-nav`,
 * `--breakpoint-navcta`, `--breakpoint-navair`) avaient été réglés en comparant
 * la largeur de la rangée à celle de l'ÉCRAN, en oubliant les 128 px de
 * rembourrage horizontal. La rangée débordait donc sa boîte de contenu de 50 à
 * 60 px dans les trois bandes, et ne survivait qu'en mangeant son rembourrage :
 * il restait 4 px avant le bord du document à 1440 px.
 *
 * Sur Windows et macOS, ça passait. Sur le Chromium Linux de la CI, dont les
 * chasses diffèrent d'environ 0,8 %, la page débordait de 5 px — sur 90 des 117
 * routes publiques, à chaque exécution.
 *
 * 🔑 Ce test ne mesure pas « est-ce que ça déborde ». Il mesure **combien il
 * reste**. Un contrôle de débordement serait passé au vert avec 4 px de marge,
 * c'est-à-dire à un onglet de navigation près du défaut. On exige une réserve,
 * pas une survie.
 *
 * Un onglet ajouté, un libellé rallongé, une police changée : ce test rougit
 * avant la mise en ligne, en nommant la largeur fautive.
 */

import { test, expect } from "@playwright/test";

/** Réserve minimale exigée entre la fin de la nav et le groupe de CTA. */
const RESERVE_MINIMALE = 16;

/**
 * Largeurs critiques : la première de chaque bande (là où la rangée est la plus
 * serrée, puisqu'un élément vient d'apparaître) et quelques tailles d'écran
 * réelles très répandues.
 */
const LARGEURS = [1440, 1441, 1512, 1536, 1700, 1701, 1800, 1920];

test.describe("@qualiopi-public le header tient dans sa boîte de contenu", () => {
  // 🔴 2026-08-22 — UN DÉLAI PLUS LONG QUE SON BUDGET NE PEUT JAMAIS EXPIRER.
  //
  // Famille de défauts symétrique de celle corrigée la veille. Un `timeout:`
  // soigneusement choisi, avec un message qui nomme la cause, est INATTEIGNABLE
  // si le budget du test qui l'englobe est plus court : c'est le budget qui
  // rend le verdict, et son message ne nomme rien.
  //
  // 🔑 Règle : le budget d'une suite doit être STRICTEMENT supérieur au plus
  // grand délai qui vit dedans — helpers importés compris. Verrouillé par
  // `tests/unit/e2e-harness/delai-interne-sous-le-budget.spec.ts`.
  //
  // Ici : les deux tests naviguent avec `timeout: 90_000` sous un budget de
  // 30 s — le délai déclaré était mort-né. Arithmétique : 90 000 (goto) +
  // 8 × 250 ms de bascules de viewport + les mesures `page.evaluate` < 150 000.
  // Si l'un des deux nombres bouge, bouger l'autre.
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test("réserve suffisante à chaque bande de bascule", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "Géométrie : un moteur suffit.");
    await page.goto("/fr", { waitUntil: "networkidle", timeout: 90_000 });

    const constats: string[] = [];
    for (const largeur of LARGEURS) {
      await page.setViewportSize({ width: largeur, height: 900 });
      await page.waitForTimeout(250);

      const m = await page.evaluate(() => {
        const groupe = document.querySelector("div.ml-auto");
        const nav = document.querySelector("header nav");
        if (groupe === null || nav === null) return null;
        const gb = groupe.getBoundingClientRect();
        // En dessous de `--breakpoint-nav`, la nav horizontale et le groupe de
        // CTA sont masqués : il n'y a rien à mesurer, et confondre « masqué »
        // avec « conforme » est exactement le genre de témoin qui ne garde rien.
        if (gb.width === 0) return { tiroir: true, reserve: 0, debordement: 0 };
        const nb = nav.getBoundingClientRect();
        const parent = groupe.parentElement!;
        const ecart = parseFloat(getComputedStyle(parent).columnGap) || 0;
        const racine = document.documentElement;
        return {
          tiroir: false,
          reserve: Math.round(gb.left - nb.right - ecart),
          debordement: racine.scrollWidth - racine.clientWidth,
        };
      });

      if (m === null) {
        constats.push(`${largeur} px : header introuvable`);
        continue;
      }
      if (m.tiroir) {
        constats.push(`${largeur} px : en tiroir — la bande devrait afficher la nav`);
        continue;
      }
      if (m.debordement > 1) {
        constats.push(`${largeur} px : le document déborde de ${m.debordement} px`);
      }
      if (m.reserve < RESERVE_MINIMALE) {
        constats.push(
          `${largeur} px : réserve de ${m.reserve} px seulement ` +
            `(minimum ${RESERVE_MINIMALE}) — la rangée est à un onglet du débordement`,
        );
      }
    }

    expect(
      constats,
      "largeurs où la rangée du header n'a plus de réserve — voir le commentaire " +
        "en tête de `Header.tsx` pour l'arithmétique (rembourrage compris)",
    ).toEqual([]);
  });

  test("le tiroir reprend bien la main sous le seuil", async ({ page }, info) => {
    // Contre-témoin : sans lui, masquer la nav à toutes les largeurs rendrait le
    // test ci-dessus vert en n'ayant plus rien à mesurer.
    test.skip(info.project.name !== "chromium", "Géométrie : un moteur suffit.");
    await page.setViewportSize({ width: 1439, height: 900 });
    await page.goto("/fr", { waitUntil: "networkidle", timeout: 90_000 });
    const enTiroir = await page.evaluate(() => {
      const groupe = document.querySelector("div.ml-auto");
      return groupe !== null && groupe.getBoundingClientRect().width === 0;
    });
    expect(enTiroir, "à 1439 px la nav horizontale doit céder la place au tiroir").toBe(true);
  });
});
