/**
 * CLIQUET — un délai déclaré doit pouvoir EXPIRER.
 *
 * 🔴 2026-08-22 — LA FAMILLE SYMÉTRIQUE, ET LA PLUS SOURNOISE.
 *
 * La veille, on avait corrigé des attentes SANS délai, qui consommaient le
 * budget entier du test avant de rendre un message muet. La faute inverse est
 * pire, parce qu'elle a l'air d'un soin :
 *
 *     test.describe.configure({ timeout: 30_000 })   // budget de la suite
 *     await page.goto(url, { timeout: 45_000 })      // délai « soigné »
 *
 * Le `timeout: 45_000` ne peut JAMAIS expirer. C'est le budget qui rend le
 * verdict, avec son message générique — et le message précis que quelqu'un
 * avait pris la peine d'écrire est inatteignable.
 *
 * Cinq suites en souffraient, toutes trouvées le même jour :
 *
 *     public-routes            30 000 < 45 000  (goto du harnais)
 *     header-tient-dans-sa-boite 30 000 < 90 000
 *     a11y-admin               90 000 < 180 000 (loginAsAdmin hors CI)
 *     vente-parcours          180 000 = 180 000 (égal : aucune place pour le reste)
 *     admin-booking-flow      180 000 = 180 000
 *
 * 🔑 Le cliquet des budgets admin ne voyait rien : il ne contrôlait qu'un
 * PLANCHER, jamais la RELATION entre le budget et ce qui vit dedans.
 *
 * ⚠️ STATIQUE, et c'est volontaire : ces suites passent au vert tant que rien
 * n'est lent. Le défaut ne se manifeste que le jour où quelque chose ralentit
 * — c'est-à-dire le jour où l'on a le plus besoin d'un message clair.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE_E2E = join(process.cwd(), "tests", "e2e");

/** Budget par défaut, lu dans la configuration plutôt que recopié. */
function budgetParDefaut(): number {
  const cfg = readFileSync(join(process.cwd(), "playwright.config.ts"), "utf8");
  const m = /^\s*timeout:\s*([0-9_]+)/m.exec(cfg);
  expect(m?.[1], "`timeout` global introuvable dans playwright.config.ts").toBeTruthy();
  return Number((m?.[1] ?? "0").replace(/_/g, ""));
}

function specs(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) trouves.push(...specs(chemin));
    else if (entree.endsWith(".spec.ts")) trouves.push(chemin);
  }
  return trouves;
}

/** Les aides de `tests/e2e/**` qu'un fichier importe, résolues en chemins. */
function aidesImportees(source: string): string[] {
  const aides: string[] = [];
  for (const nom of ["_harness/audit-page", "fixtures/admin-auth", "parcours/_communs"]) {
    const feuille = nom.split("/").pop() ?? "";
    if (source.includes(feuille)) {
      aides.push(join(RACINE_E2E, ...nom.split("/")) + ".ts");
    }
  }
  return aides;
}

/**
 * Le plus grand délai littéral d'un source. Pour un ternaire
 * `CI ? 60_000 : 180_000`, les deux branches sont lues — on retient la plus
 * grande, puisque c'est elle qui peut se produire.
 */
function delaiMaximal(source: string): number {
  let max = 0;
  for (const m of source.matchAll(/timeout:\s*([0-9_]+)/g)) {
    max = Math.max(max, Number((m[1] ?? "0").replace(/_/g, "")));
  }
  for (const m of source.matchAll(/\?\s*([0-9_]+)\s*:\s*([0-9_]+)/g)) {
    max = Math.max(
      max,
      Number((m[1] ?? "0").replace(/_/g, "")),
      Number((m[2] ?? "0").replace(/_/g, "")),
    );
  }
  return max;
}

/** Budget effectif déclaré par un fichier, ou `null` s'il n'en déclare aucun. */
function budgetDeclare(source: string): number | null {
  const d = /describe\.configure\(\{[^}]*timeout:\s*([0-9_]+)/.exec(source);
  if (d?.[1]) return Number(d[1].replace(/_/g, ""));
  const t = /test\.setTimeout\(\s*([0-9_]+)/.exec(source);
  return t?.[1] ? Number(t[1].replace(/_/g, "")) : null;
}

describe("aucun délai déclaré n'est plus long que son budget", () => {
  const defaut = budgetParDefaut();
  const fichiers = specs(RACINE_E2E);

  it("des specs sont bien analysées", () => {
    // Contre-témoin : une liste vide ferait passer le test suivant au vert
    // sans rien garder. Le dépôt en compte plusieurs dizaines.
    expect(fichiers.length, "aucune spec trouvée sous tests/e2e").toBeGreaterThan(20);
  });

  it("chaque suite laisse ses propres délais expirer", () => {
    const fautes: string[] = [];
    for (const chemin of fichiers) {
      const source = readFileSync(chemin, "utf8");
      const budget = budgetDeclare(source) ?? defaut;
      // Le budget de la suite ne compte pas comme un délai interne.
      const sansConfigure = source.replace(/describe\.configure\(\{[^}]*\}\)/g, "");
      let interne = delaiMaximal(sansConfigure);
      for (const aide of aidesImportees(source)) {
        try {
          interne = Math.max(interne, delaiMaximal(readFileSync(aide, "utf8")));
        } catch {
          // Aide absente : rien à mesurer, et son absence se verrait ailleurs.
        }
      }
      if (interne >= budget) {
        fautes.push(
          `${relative(process.cwd(), chemin).replace(/\\/g, "/")} — budget ${budget} ms, ` +
            `délai interne ${interne} ms`,
        );
      }
    }
    expect(
      fautes,
      "un délai plus long que le budget qui le contient ne peut JAMAIS expirer : " +
        "c'est le budget qui rend le verdict, et son message ne nomme rien",
    ).toEqual([]);
  });

  it("aucune attente réseau n'est laissée sans délai", () => {
    // Jurisprudence : `06-stagiaire-mobile.spec.ts` attendait `networkidle` sans
    // délai sur une page admin qui ne se tait jamais. L'attente a consommé les
    // 300 s du test, puis rendu « Test timeout exceeded » sans nommer la cause.
    const fautes: string[] = [];
    for (const chemin of fichiers) {
      const source = readFileSync(chemin, "utf8");
      // 🔴 CE TEST S'EST TROUVÉ LUI-MÊME. Un premier jet balayait le fichier
      // entier et comptait l'occurrence citée dans le COMMENTAIRE qui explique
      // pourquoi l'appel a été retiré. Un cliquet qui matche sa propre
      // jurisprudence rougit sur sa documentation — exactement le piège déjà
      // payé par le cliquet du seed de démonstration, la veille.
      const code = source
        .split("\n")
        .filter((l) => {
          const t = l.trim();
          return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
        })
        .join("\n");
      for (const m of code.matchAll(/waitForLoadState\(\s*"networkidle"\s*([,)])/g)) {
        if (m[1] === ")") {
          fautes.push(relative(process.cwd(), chemin).replace(/\\/g, "/"));
        }
      }
    }
    expect(
      fautes,
      '`waitForLoadState("networkidle")` sans délai hérite du budget du test. ' +
        "Une page qui ne se tait jamais côté réseau le consomme en entier.",
    ).toEqual([]);
  });
});
