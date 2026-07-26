/**
 * Diagnostic ciblé — contraste et débordement horizontal.
 *
 * L'audit de masse a signalé `color-contrast` sur 108 routes et un débordement sur
 * 109, toutes à 1440 px. Un défaut présent partout vient d'un JETON, pas d'une page ;
 * et un débordement qui n'apparaît qu'en desktop est suspect. Cette spec descend au
 * niveau des NŒUDS pour trancher, sur un échantillon représentatif.
 *
 * Différence clé avec le harnais de masse : on laisse la page se stabiliser après
 * chaque redimensionnement (attente longue + `requestAnimationFrame`), ce que les
 * 150 ms du harnais ne garantissaient pas.
 */

import AxeBuilder from "@axe-core/playwright";
import { test } from "@playwright/test";

const ECHANTILLON = ["/fr", "/fr/formations", "/fr/tarifs", "/fr/accessibilite", "/fr/faq"];

test.describe("@diagnostic contraste & débordement", () => {
  // 5 routes par test, chacune avec chargement + stabilisation : le défaut de 30 s
  // de la configuration ne suffit pas et masquerait le diagnostic.
  test.describe.configure({ timeout: 300_000 });

  test("contraste — quelles couleurs, sur quels éléments", async ({ page }, info) => {
    const parCouple = new Map<string, { occurrences: number; exemples: string[] }>();

    for (const route of ECHANTILLON) {
      await page.goto(route, { waitUntil: "networkidle", timeout: 45_000 });
      const axe = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      for (const v of axe.violations) {
        for (const n of v.nodes) {
          // `failureSummary` porte les couleurs et le ratio mesuré.
          const resume = (n.failureSummary ?? "").replace(/\s+/g, " ").trim();
          const couleurs =
            resume.match(
              /foreground color: (#[0-9a-f]{3,8})[^]*?background color: (#[0-9a-f]{3,8})/i,
            ) ?? [];
          const ratio = resume.match(/contrast ratio of ([\d.]+)/i)?.[1] ?? "?";
          const cle = `${couleurs[1] ?? "?"} sur ${couleurs[2] ?? "?"} — ratio ${ratio}`;
          const e = parCouple.get(cle) ?? { occurrences: 0, exemples: [] };
          e.occurrences += 1;
          if (e.exemples.length < 3) e.exemples.push(`${route} · ${(n.html ?? "").slice(0, 110)}`);
          parCouple.set(cle, e);
        }
      }
    }

    const classe = [...parCouple.entries()].sort((a, b) => b[1].occurrences - a[1].occurrences);
    await info.attach("contraste.json", {
      body: JSON.stringify(classe, null, 2),
      contentType: "application/json",
    });
    console.log("\n=== COUPLES DE COULEURS EN DÉFAUT ===");
    for (const [cle, v] of classe.slice(0, 10)) {
      console.log(`${String(v.occurrences).padStart(3)}×  ${cle}`);
      for (const ex of v.exemples) console.log(`      ${ex}`);
    }
  });

  test("débordement — mesure stabilisée, élément fautif identifié", async ({ page }, info) => {
    const releve: unknown[] = [];

    for (const route of ECHANTILLON) {
      await page.goto(route, { waitUntil: "networkidle", timeout: 45_000 });
      for (const largeur of [1440, 1024, 768, 390]) {
        await page.setViewportSize({ width: largeur, height: 900 });
        // Stabilisation RÉELLE : deux frames + une seconde pleine. C'est ce qui
        // manquait au harnais de masse (150 ms), d'où le doute sur ses 109 cas.
        await page.evaluate(
          () =>
            new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
        );
        await page.waitForTimeout(1000);

        const mesure = await page.evaluate(() => {
          const de = document.documentElement;
          const exces = de.scrollWidth - de.clientWidth;
          if (exces <= 1) return { exces: 0, fautifs: [] as string[] };
          const fautifs = [...document.querySelectorAll("body *")]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.width > 0 && r.right > de.clientWidth + 2;
            })
            .slice(0, 4)
            .map((e) => {
              const r = e.getBoundingClientRect();
              const cl = (e.className || "").toString().slice(0, 55);
              return `${e.tagName}.${cl} → droite ${Math.round(r.right)} px`;
            });
          return { exces, fautifs };
        });

        if (mesure.exces > 0) releve.push({ route, largeur, ...mesure });
      }
    }

    await info.attach("debordement.json", {
      body: JSON.stringify(releve, null, 2),
      contentType: "application/json",
    });
    console.log("\n=== DÉBORDEMENTS CONFIRMÉS (mesure stabilisée) ===");
    console.log(
      releve.length === 0
        ? "AUCUN — les 109 cas du harnais étaient un artefact."
        : JSON.stringify(releve, null, 1),
    );
  });
});
