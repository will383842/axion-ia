/**
 * 🔴 DEUX LECTEURS, UNE SEULE RÈGLE — et c'est la pièce de l'auditeur qui était fausse.
 *
 * Les indicateurs 23, 24 et 25 du RNQ demandent une veille **exploitée** : récente
 * (suivi continu) et suivie d'une décision. Deux endroits du code répondaient à
 * cette question, avec deux règles différentes :
 *
 *   conformite-service.ts   < 12 mois ET actionDecidee non vide        → juste
 *   audit-dossier.ts        count({ where: { type } }), aucun filtre   → faux
 *
 * L'écran de conformité disait vrai pendant que le MANIFESTE D'AUDIT — la pièce
 * qu'on remet au certificateur — déclarait 23/24/25 couverts **pour toujours**.
 * Une entrée de 2019, sans décision, y suffisait.
 *
 * 🔑 Et l'écart allait dans le mauvais sens : l'instrument le plus PERMISSIF
 * était celui qu'on donne à lire à l'auditeur.
 *
 * ## Ce que ce fichier garde
 *
 * Pas la valeur du seuil — il bougera peut-être. **Le fait qu'il n'existe qu'un
 * seul endroit où il est écrit.** Recopier la règle aurait fermé le défaut en
 * gardant sa cause : deux prédicats jumeaux s'éloignent à la première borne qui
 * bouge, et le second écart se découvrirait comme celui-ci — par hasard.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const DOSSIER = "src/server/qualiopi/conformite";

const LECTEURS = ["audit-dossier.ts", "conformite-service.ts"] as const;

function lire(fichier: string): string {
  return readFileSync(join(RACINE, DOSSIER, fichier), "utf8");
}

/** Les appels `prisma.veille.count(...)`, normalisés pour survivre à Prettier. */
function appelsComptageVeille(source: string): string[] {
  const plat = source.replace(/\s+/g, " ");
  return plat.match(/prisma\.veille\.count\(\s*\{[^}]*\}[^)]*\)/g) ?? [];
}

describe("la veille se compte partout de la même façon", () => {
  it("le prédicat partagé existe et porte les DEUX bornes", () => {
    // Témoin positif : sans lui, les assertions suivantes passeraient sur un
    // fichier vide ou renommé, et ne mesureraient plus rien.
    const predicat = readFileSync(join(RACINE, DOSSIER, "veille-exploitee.ts"), "utf8");
    expect(predicat).toContain("dateVeille");
    expect(predicat).toContain("actionDecidee");
    expect(predicat).toContain("FRAICHEUR_VEILLE_MOIS");
  });

  it("audit-dossier.ts : AUCUN comptage de veille sans le prédicat partagé", () => {
    // C'est LE fichier du défaut. Ici, aucun compte « total » n'a de raison
    // d'exister : le manifeste ne publie pas de dénominateur, il conclut.
    const appels = appelsComptageVeille(lire("audit-dossier.ts"));
    expect(
      appels.length,
      "audit-dossier.ts ne compte plus la veille du tout. Si le comptage a " +
        "déménagé, déplacer aussi cette garde — sinon elle verdira en ne mesurant rien.",
    ).toBeGreaterThan(0);
    const nus = appels.filter((a) => !a.includes("whereVeilleExploitee"));
    expect(
      nus,
      "le manifeste d'audit compte la veille avec sa propre condition au lieu du " +
        "prédicat partagé `whereVeilleExploitee`. C'est le défaut exact du " +
        "2026-09-13 : il comptait SANS filtre de date ni de décision, et déclarait " +
        "les indicateurs 23/24/25 couverts POUR TOUJOURS — une entrée de 2019 y " +
        "suffisait. Le RNQ demande une veille EXPLOITÉE, pas collectée.",
    ).toEqual([]);
  });

  it("conformite-service.ts : le VERDICT des indicateurs vient de la veille exploitée", () => {
    // Ici les comptes « totaux » sont légitimes — ils servent de dénominateur
    // dans « X exploitées sur N au total ». Ce qui doit être gardé n'est donc
    // pas l'absence de compte nu, mais le fait que la DÉCISION s'appuie sur le
    // compte filtré.
    const plat = lire("conformite-service.ts").replace(/\s+/g, " ");
    expect(
      plat,
      "le comptage filtré doit passer par le prédicat partagé, sinon les deux " +
        "lecteurs peuvent à nouveau diverger.",
    ).toContain("whereVeilleExploitee");

    for (const [indicateur, variable] of [
      ["23", "nbVeilleLegaleExploitee"],
      ["24", "nbVeilleMetiersExploitee"],
      ["25", "nbVeillePedagogiqueExploitee"],
    ] as const) {
      expect(
        plat.includes(variable + " > 0"),
        `l'indicateur ${indicateur} n'est plus décidé par \`${variable}\`. S'il se ` +
          "décide désormais sur un compte NON filtré, il redeviendrait couvert par " +
          "une entrée périmée et sans décision.",
      ).toBe(true);
    }
  });

  it("aucun lecteur ne réécrit le seuil de fraîcheur chez lui", () => {
    // Une borne recopiée est une borne qui divergera. Elle doit venir du module.
    for (const fichier of LECTEURS) {
      const source = lire(fichier).replace(/\s+/g, " ");
      const veilleAvecSeuilLocal = /prisma\.veille\.count\([^)]*dateVeille\s*:\s*\{\s*gte/.test(
        source,
      );
      expect(
        veilleAvecSeuilLocal,
        `${fichier} pose son propre seuil de date sur un comptage de veille. ` +
          `Le seuil vit dans \`veille-exploitee.ts\` — un seul endroit, pour que ` +
          `le prochain changement de borne atteigne les deux lecteurs.`,
      ).toBe(false);
    }
  });
});
