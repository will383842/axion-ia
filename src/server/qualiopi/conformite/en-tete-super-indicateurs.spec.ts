/**
 * Garde statique — l'en-tête de `indicateurs-registre.ts` ne peut plus mentir sur
 * ce qui fait ÉCHOUER une certification.
 *
 * Pourquoi cette garde existe : jusqu'au 2026-08-23, ce fichier portait DEUX
 * listes de super-indicateurs qui ne coïncidaient pas. Son en-tête en annonçait
 * 14, son code en déclarait 17. L'écart allait dans les deux sens, et le sens
 * grave était celui-ci : SEPT indicateurs (6, 10, 14, 15, 20, 22, 29) dont une
 * seule non-conformité fait échouer la certification n'étaient pas cités. Qui
 * lisait l'en-tête pour se préparer à un audit ignorait sept mines.
 *
 * Ce que la garde vérifie : la liste écrite dans l'en-tête est EXACTEMENT
 * l'ensemble des `super: true` du registre. La liste attendue n'est JAMAIS
 * recopiée ici — elle est DÉRIVÉE de `INDICATEURS_RNQ`. Un prédicat
 * recopié diverge toujours ; ce dépôt l'a payé quatre fois.
 *
 * Ce que la garde NE vérifie PAS, délibérément : que la liste soit la bonne au
 * regard du RNQ. Ça, c'est le travail de `indicateurs-registre.spec.ts`, qui
 * confronte le registre à la liste graduable officielle du RNQ V9. Ici on ne
 * vérifie que la CONCORDANCE entre la prose et le code.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { INDICATEURS_RNQ } from "./indicateurs-registre";

const CHEMIN_REGISTRE = join(
  process.cwd(),
  "src/server/qualiopi/conformite/indicateurs-registre.ts",
);

/**
 * Lit la balise `@superIndicateurs` de l'en-tête.
 *
 * ⚠️ La balise existe précisément pour que cette lecture soit sans ambiguïté.
 * L'en-tête contient AUSSI, dans son avertissement historique, l'ancienne liste
 * fausse — une garde qui se contenterait de « chercher une suite de nombres dans
 * le commentaire » lirait la mauvaise. Ce dépôt a déjà vu trois gardes statiques
 * se faire piéger par la documentation qui les décrit ; celle-ci ancre sur un
 * marqueur, pas sur une forme.
 */
function lireListeDeclareeDansEnTete(source: string): number[] {
  const ligne = source.match(/^\s*\*\s*@superIndicateurs\s+([\d,\s]+)$/m);

  expect(
    ligne,
    "L'en-tête de indicateurs-registre.ts ne porte plus de balise " +
      "`@superIndicateurs`. Elle n'est pas décorative : c'est le seul point " +
      "d'ancrage non ambigu de cette garde, parce que l'en-tête cite aussi " +
      "l'ancienne liste fausse. La rétablir plutôt que d'assouplir la garde.",
  ).not.toBeNull();

  return (ligne as RegExpMatchArray)[1]
    .split(",")
    .map((morceau) => morceau.trim())
    .filter((morceau) => morceau.length > 0)
    .map(Number);
}

describe("en-tête de indicateurs-registre.ts — la prose et le code disent la même chose", () => {
  const source = readFileSync(CHEMIN_REGISTRE, "utf8");

  /** DÉRIVÉE du registre. Jamais recopiée. */
  const superDuCode = INDICATEURS_RNQ.filter((ind) => ind.super)
    .map((ind) => ind.numero)
    .sort((a, b) => a - b);

  it("la balise @superIndicateurs liste exactement les `super: true` du registre", () => {
    const declares = lireListeDeclareeDansEnTete(source);

    expect(
      [...declares].sort((a, b) => a - b),
      "L'en-tête et le code divergent sur ce qui fait échouer une " +
        "certification.\n" +
        `  en-tête : ${declares.join(",")}\n` +
        `  code    : ${superDuCode.join(",")}\n` +
        `  cités à tort : ${declares.filter((n) => !superDuCode.includes(n)).join(",") || "aucun"}\n` +
        `  🔴 OUBLIÉS   : ${superDuCode.filter((n) => !declares.includes(n)).join(",") || "aucun"}\n` +
        "Les OUBLIÉS sont le côté grave : ce sont des indicateurs dont une " +
        "seule NC fait échouer la certification, et que l'en-tête tait.",
    ).toEqual(superDuCode);
  });

  it("la balise est unique — deux balises rendraient la garde silencieuse", () => {
    const occurrences = source.match(/^\s*\*\s*@superIndicateurs\s/gm) ?? [];

    expect(
      occurrences.length,
      "Plusieurs balises `@superIndicateurs` dans l'en-tête : la garde ne " +
        "lirait que la première et laisserait les autres diverger en silence.",
    ).toBe(1);
  });

  it("l'en-tête n'annonce pas un NOMBRE de super-indicateurs qui contredit sa propre liste", () => {
    // L'en-tête écrit « — 17, dont 7 et 16 … ». Ce nombre est prose libre, donc
    // il peut vieillir sans que personne ne le voie. On le tient aussi.
    const annonce = source.match(
      /Super-indicateurs \(NC majeure = échec certification\)\s*—\s*(\d+)/,
    );

    expect(
      annonce,
      "L'en-tête n'annonce plus de nombre de super-indicateurs. Si la phrase " +
        "a été réécrite, adapter cette garde plutôt que de la supprimer.",
    ).not.toBeNull();

    expect(
      Number((annonce as RegExpMatchArray)[1]),
      `L'en-tête annonce ${(annonce as RegExpMatchArray)[1]} super-indicateurs ` +
        `alors que le registre en déclare ${superDuCode.length}.`,
    ).toBe(superDuCode.length);
  });
});
