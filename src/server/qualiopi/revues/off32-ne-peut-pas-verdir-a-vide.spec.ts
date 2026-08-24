/**
 * Garde — l'indicateur 32 ⭐ ne peut pas verdir sur une revue de direction VIDE.
 *
 * ## Ce qui se passait, mesuré le 2026-08-23
 *
 * La règle de couverture d'off.32 était, en entier :
 *
 * ```ts
 * set(32, [`${nbRevues} revue de direction`, `${nbReclamations} réclamation + plan d'actions`], nbRevues > 0);
 * ```
 *
 * Trois défauts en trois lignes, tous sur un super-indicateur (NC majeure) :
 *
 * 1. **Le contenu de la revue n'était jamais regardé.** `nbRevues > 0` est vrai
 *    pour une revue validée dont `participants`, `decisions` ET `planActions`
 *    sont vides. Une case cochée valait une démarche d'amélioration continue.
 * 2. **Le libellé de preuve affirmait ce que la règle ne mesurait pas** : « N
 *    réclamations **+ plan d'actions** ». Le plan était *affirmé*. Rien, nulle
 *    part, n'allait le compter. C'est la pièce que l'auditeur lit.
 * 3. **Aucun test ne gardait la règle.** off.30 en avait 6, off.31 en avait 4,
 *    off.32 **zéro** : les seules occurrences d'off.32 dans tous les `*.spec.ts`
 *    étaient son libellé et son drapeau `super` dans `indicateurs-registre.spec.ts`.
 *    Le super-indicateur dont la règle était la plus faible était aussi le seul
 *    du critère 7 que rien ne gardait.
 *
 * ## Pourquoi cette garde est STATIQUE
 *
 * Un test de comportement sur `evaluerConformite` garderait la règle
 * d'aujourd'hui. Le défaut, lui, est qu'on **réécrive** demain un prédicat local
 * — ce dépôt a payé quatre fois un prédicat recopié qui diverge. La garde porte
 * donc sur l'architecture : il n'existe qu'UN prédicat de couverture d'off.32,
 * `evaluerCouvertureOff32`, et tout ce qui prononce un verdict sur l'indicateur 32
 * l'appelle.
 *
 * Le comportement, lui, est gardé par `plan-actions.spec.ts`, sur le prédicat.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sansCommentaires } from "./sans-commentaires";

const RACINE = process.cwd();

const MODULE_PREDICAT = "@/server/qualiopi/revues/plan-actions";
const NOM_PREDICAT = "evaluerCouvertureOff32";

/**
 * Les lectures qui prononcent un verdict sur l'indicateur 32.
 * `audit-dossier.ts` en fait partie : c'est lui qui écrit les preuves d'off.32
 * dans le manifeste remis au certificateur ET dans la matrice de
 * `/qualiopi/mode-auditeur` — la seule surface que l'auditrice regarde.
 */
const LECTURES = [
  {
    role: "moteur de conformité (couverture off.32)",
    chemin: "src/server/qualiopi/conformite/conformite-service.ts",
  },
  {
    role: "manifeste remis au certificateur (preuves off.32)",
    chemin: "src/server/qualiopi/conformite/audit-dossier.ts",
  },
] as const;

/**
 * Le retrait des commentaires vit dans `sans-commentaires.ts` : deux gardes
 * statiques en dépendent, et un analyseur recopié diverge comme un prédicat
 * recopié. Son en-tête porte le POURQUOI — cette garde s'est trouvée elle-même
 * le 2026-08-23, en rougissant sur le commentaire du correctif qu'elle gardait.
 */

function lire(chemin: string): string {
  return sansCommentaires(readFileSync(join(RACINE, chemin), "utf8"));
}

describe("off.32 ⭐ — un seul prédicat, et il regarde le contenu de la revue", () => {
  it.each(LECTURES.map((l) => [l.role, l.chemin] as const))(
    "%s délègue à evaluerCouvertureOff32",
    (role, chemin) => {
      const source = lire(chemin);

      expect(
        source.includes(NOM_PREDICAT),
        `🔴 ${role} (${chemin}) prononce un verdict sur l'indicateur 32 sans appeler\n` +
          `   « ${NOM_PREDICAT} » (${MODULE_PREDICAT}).\n` +
          "   off.32 est un SUPER-indicateur : une NC majeure refuse la certification.\n" +
          "   Un prédicat local sur le seul NOMBRE de revues verdit l'indicateur pour\n" +
          "   une revue validée dont participants, décisions et plan d'actions sont vides —\n" +
          "   et le libellé de preuve affiche « + plan d'actions » sans que rien ne l'ait compté.",
      ).toBe(true);
    },
  );

  it("le moteur ne conclut plus sur le seul NOMBRE de revues", () => {
    const source = lire("src/server/qualiopi/conformite/conformite-service.ts");

    // La forme exacte de l'ancien prédicat. On la cherche telle quelle : c'est
    // elle, et pas une paraphrase, qui a laissé un super-indicateur vert à vide.
    expect(
      /nbRevues\s*>\s*0/.test(source),
      "🔴 `nbRevues > 0` est de retour dans conformite-service.ts.\n" +
        "   C'était l'intégralité de la règle de couverture d'off.32 jusqu'au 2026-08-23 :\n" +
        "   une revue de direction VALIDÉE et VIDE couvrait un super-indicateur.\n" +
        `   Le compte de revues peut rester une PREUVE affichée ; il ne peut plus être le VERDICT.`,
    ).toBe(false);
  });

  it("aucune preuve n'affirme un plan d'actions que personne n'a compté", () => {
    // L'ancien libellé : `${nbReclamations} réclamation${…} + plan d'actions`.
    // Il annonçait un plan d'actions à partir d'un compteur de RÉCLAMATIONS.
    for (const { chemin } of LECTURES) {
      const source = lire(chemin);
      expect(
        /r[ée]clamation[^\n]*\+ plan d'actions/.test(source),
        `🔴 ${chemin} affirme « + plan d'actions » depuis un compteur de réclamations.\n` +
          "   Le plan d'actions doit être MESURÉ (resumerPlanActions), jamais affirmé :\n" +
          "   c'est la preuve que l'auditeur lit, et elle porterait sur une donnée\n" +
          "   qui n'a pas été regardée.",
      ).toBe(false);
    }
  });
});
