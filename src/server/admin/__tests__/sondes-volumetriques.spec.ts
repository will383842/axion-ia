/**
 * T0 — « la CI refuse un merge touchant les listes admin si aucune baseline
 * volumétrique n'est committée » (plan de tenue à la charge, § T0).
 *
 * Ce test-ci porte la moitié qui ne demande pas de base de données : la
 * COUVERTURE. Toute sonde déclarée doit avoir son entrée dans la baseline, et la
 * baseline doit annoncer le même volume que la fixture. Il rougit au commit, sur
 * la machine de n'importe qui, sans Postgres.
 *
 * L'autre moitié — les millisecondes réelles — est portée par le job CI
 * `pnpm volumetrie:mesure`, qui exige un Postgres seedé. Les deux sont
 * nécessaires : celui-ci empêche d'OUBLIER une surface, celui-là empêche de la
 * laisser se dégrader.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SONDES } from "../sondes-volumetriques";
import { VOLUMES } from "../../../../prisma/seeds/volumetrie/fixture-volumetrique";

interface Baseline {
  volumes: Record<string, number>;
  mesures: Record<string, { msMediane: number | null; mesureLe: string | null }>;
  playwright4g: { etat: string };
}

const baseline = JSON.parse(
  readFileSync(resolve(process.cwd(), "_AUDIT/BASELINE-VOLUMETRIQUE.json"), "utf-8"),
) as Baseline;

describe("🔴 aucune surface admin ne part sans baseline volumétrique", () => {
  it.each(SONDES.map((s) => [s.cle, s.page] as const))(
    "%s (%s) a une entrée dans la baseline",
    (cle) => {
      expect(
        baseline.mesures[cle],
        `La sonde « ${cle} » n'a aucune entrée dans _AUDIT/BASELINE-VOLUMETRIQUE.json. ` +
          `Ajouter une liste admin sans la baseliner, c'est la livrer sans savoir ce qu'elle ` +
          `coûte à ${VOLUMES.sessions} sessions.`,
      ).toBeDefined();
    },
  );

  it("la baseline ne contient pas d'entrée orpheline", () => {
    // Une entrée sans sonde correspondante est un chiffre que plus personne ne
    // vérifie — il vieillit en silence et finit par mentir.
    const cles = new Set(SONDES.map((s) => s.cle as string));
    const orphelines = Object.keys(baseline.mesures).filter((k) => !cles.has(k));
    expect(orphelines).toEqual([]);
  });

  it("une mesure datée porte forcément un chiffre", () => {
    // L'inverse est permis (chiffre nul + date nulle = jamais mesurée), mais
    // une date sans chiffre laisserait croire qu'une mesure a eu lieu.
    const bancales = Object.entries(baseline.mesures)
      .filter(([, m]) => m.mesureLe != null && m.msMediane == null)
      .map(([k]) => k);
    expect(bancales).toEqual([]);
  });
});

describe("🔴 la baseline et la fixture parlent du même volume", () => {
  it.each(Object.entries(VOLUMES))("%s = %i", (cle, valeur) => {
    // Une baseline mesurée sur un autre jeu de données n'est pas une baseline :
    // c'est un chiffre qui lui ressemble. Changer VOLUMES sans re-mesurer doit
    // rougir ici, pas passer inaperçu.
    expect(
      baseline.volumes[cle],
      `VOLUMES.${cle} vaut ${valeur} mais la baseline déclare ${baseline.volumes[cle]}. ` +
        `Re-mesurer (pnpm volumetrie:mesure --ecrire) ou corriger le volume.`,
    ).toBe(valeur);
  });
});

describe("ce que la baseline reconnaît ne PAS couvrir", () => {
  it("la mesure Playwright 4G est déclarée, et déclarée non faite", () => {
    // 🔴 Un temps de requête serveur ne dit rien du temps perçu. Laisser la
    // baseline muette sur ce point ferait croire le Lot 0 complet alors que sa
    // mesure (b) n'a pas eu lieu. On préfère un manque écrit à un manque tu.
    expect(baseline.playwright4g.etat).toBe("non_fait");
  });
});
