/**
 * Une cellule qui demande `text-right` s'affiche à droite.
 *
 * ## 🔴 Le défaut mesuré le 2026-09-09, EN PRODUCTION
 *
 * `.admin-table th, .admin-table td { text-align: left }` est **hors couche**
 * (vérifié mécaniquement sur `admin.css`, profondeur d'accolades 0). Les
 * utilitaires Tailwind, eux, vivent dans `@layer utilities` — vérifié sur la
 * feuille RÉELLEMENT SERVIE par la production, qui déclare
 * `properties, theme, base, components, utilities`.
 *
 * En cascade CSS, une règle non-layered l'emporte sur **toute** règle layered,
 * quelle que soit la spécificité. Donc `<td className="text-right">` perdait.
 *
 * **28 cellules, 7 fichiers**, et ce sont des colonnes d'ARGENT :
 * `qualiopi/remuneration` (total HT, TVA, total TTC), le rapprochement de
 * relevé bancaire, `qualiopi/audits` (montant HT). Des montants alignés à
 * gauche sous `tabular-nums` — le défaut même que `.admin-table` avait été
 * écrite pour corriger.
 *
 * ## 🔑 Le défaut était décrit dans le dépôt AU FUTUR
 *
 * `admin-table-ne-diverge-pas-de-sa-classe.spec.ts` annonçait que ces colonnes
 * « repasseraient toutes à gauche, EN SILENCE, **le jour de la fusion** » de
 * `<AdminTable>` avec `.admin-table`. La fusion n'a jamais eu lieu — mais les
 * cellules qui portaient déjà l'utilitaire étaient déjà à gauche. Les 28
 * existaient au moment où la phrase a été écrite.
 *
 * Un risque énoncé au futur mérite qu'on demande : « et aujourd'hui ? »
 *
 * ## Ce que ce fichier verrouille
 *
 * Les trois surcharges de `admin.css` sont **dérivées de `ALIGN_CLASS`**
 * (`AdminTable.tsx`), jamais recopiées. Ajouter une valeur d'alignement au
 * composant sans poser la règle correspondante fait rougir ce test — la garde
 * NOMME ce qu'elle doit voir au lieu de compter jusqu'à trois.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const RACINE = process.cwd();
const ADMIN_CSS = join(RACINE, "src/app/admin.css");
const ADMIN_TABLE = join(RACINE, "src/components/admin/ui/AdminTable.tsx");

/** `admin.css` sans ses commentaires — une explication n'est pas un usage. */
function cssSansCommentaires(): string {
  return readFileSync(ADMIN_CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Les classes d'alignement que `<AdminTable>` pose réellement sur ses cellules.
 * Lues dans le composant : si quelqu'un en ajoute une, ce test la réclame.
 */
function classesDAlignement(): string[] {
  const src = readFileSync(ADMIN_TABLE, "utf8");
  const bloc = /const ALIGN_CLASS[^=]*=\s*\{([^}]*)\}/.exec(src);
  expect(
    bloc,
    "`ALIGN_CLASS` a disparu d'AdminTable.tsx — ce test ne sait plus quoi garder",
  ).not.toBeNull();
  return [...(bloc?.[1] ?? "").matchAll(/"([a-z-]+)"/g)].map((m) => m[1] as string);
}

describe("l'alignement demandé est l'alignement rendu", () => {
  it("🔑 CONTRE-TÉMOIN : la règle qui écrase est toujours là", () => {
    // Sans elle, les surcharges ci-dessous ne surchargeraient rien et ce
    // fichier serait vert en gardant un problème qui n'existe plus — ou pire,
    // en masquant que quelqu'un a résolu la cascade autrement.
    const css = cssSansCommentaires();
    expect(
      /\.admin-table th,\s*\n?\s*\.admin-table td\s*\{[^}]*text-align:\s*left/.test(css),
      "la règle de base `.admin-table th, td { text-align: left }` a disparu : " +
        "si la cascade a été tranchée autrement, ce test doit être RÉÉCRIT, pas supprimé",
    ).toBe(true);
  });

  it("🔑 CONTRE-TÉMOIN : `ALIGN_CLASS` expose bien plusieurs alignements", () => {
    const classes = classesDAlignement();
    expect(
      classes.length,
      "un seul alignement lu : le parseur est cassé, pas le composant",
    ).toBeGreaterThan(1);
    expect(classes).toContain("text-right");
  });

  it("chaque classe d'alignement d'AdminTable a sa surcharge dans admin.css", () => {
    const css = cssSansCommentaires();
    const manquantes = classesDAlignement().filter((cls) => {
      const th = css.includes(`.admin-table th.${cls}`);
      const td = css.includes(`.admin-table td.${cls}`);
      return !th || !td;
    });

    expect(
      manquantes,
      "Ces alignements sont demandés par `<AdminTable>` mais aucune règle d'`admin.css` ne les\n" +
        "rend : la règle de base est HORS COUCHE, donc elle bat l'utilitaire Tailwind et la\n" +
        "cellule s'affichera à GAUCHE sans que rien ne le signale.\n" +
        "→ Ajouter dans admin.css, à côté des autres :\n" +
        manquantes
          .map((c) => `     .admin-table th.${c}, .admin-table td.${c} { text-align: … }`)
          .join("\n"),
    ).toEqual([]);
  });

  it("TOUTES les surcharges sont HORS COUCHE, comme la règle qu'elles battent", () => {
    // Une surcharge placée dans `@layer …` serait INOPÉRANTE ici : non-layered
    // l'emporte sur layered quelle que soit la spécificité. C'est la moitié du
    // défaut d'origine, et la remettre serait invisible à l'œil du relecteur.
    //
    // 🔑 CE TEST A EU LE DÉFAUT QU'IL GARDE. Sa première version ne mesurait que
    // `text-right`. Éprouvée en enveloppant `text-left` dans un `@layer`, elle
    // est restée VERTE — un témoin qui ne balaie qu'un membre d'une famille
    // absout les autres. On balaie donc les trois, et la boucle est dérivée de
    // `ALIGN_CLASS` comme le reste du fichier.
    const css = cssSansCommentaires();

    const imbriquees = classesDAlignement().filter((cls) => {
      const cible = css.indexOf(`.admin-table th.${cls}`);
      if (cible < 0) return false; // absence : c'est le test précédent qui la dit
      let profondeur = 0;
      for (let i = 0; i < cible; i += 1) {
        if (css[i] === "{") profondeur += 1;
        else if (css[i] === "}") profondeur -= 1;
      }
      return profondeur !== 0;
    });

    expect(
      imbriquees,
      "Ces surcharges d'alignement sont imbriquées dans un bloc (`@layer`, `@media`…).\n" +
        "Hors d'une couche, la règle de base `.admin-table th, td` les bat de nouveau et les\n" +
        "montants retournent à GAUCHE, en silence : " +
        imbriquees.join(", "),
    ).toEqual([]);
  });
});
