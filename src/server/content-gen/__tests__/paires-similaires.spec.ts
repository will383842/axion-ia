/**
 * Les paires de doublons ont UNE forme, et une entrée mal formée ne s'affiche pas.
 *
 * La valeur vient de `ContentGenConfig`, écrite par un worker qui a pu tourner
 * sur une version antérieure du code, et `readContentGenConfig` la rend sous un
 * transtypage NON vérifié — son propre en-tête raconte la production du
 * 2026-08-03 où une clé manquante s'est affichée « NaN % ». Une paire sans
 * `jaccard` produirait exactement cela, sur la page de surveillance des
 * doublons.
 *
 * Le second test est le plus important : il LIT le worker et exige qu'il
 * importe la forme partagée. Sans lui, on pourrait re-déclarer les dix champs
 * dans le worker, tout resterait vert, et la page afficherait tranquillement une
 * forme périmée.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLE_PAIRES_SIMILAIRES,
  lirePairesSimilaires,
} from "@/server/content-gen/paires-similaires";

const PAIRE_VALIDE = {
  jobIdA: "job-a",
  jobIdB: "job-b",
  contentTypeA: "article",
  contentTypeB: "article",
  titleA: "Former ses équipes à l'IA à Grenoble",
  titleB: "Former ses équipes à l'IA à Lyon",
  anchorVilleA: "grenoble",
  anchorVilleB: "lyon",
  jaccard: 0.71,
  detectedAt: "2026-09-16T04:30:00.000Z",
};

describe("lirePairesSimilaires", () => {
  it("rend les paires complètes telles quelles", () => {
    const paires = lirePairesSimilaires([PAIRE_VALIDE]);
    expect(paires).toHaveLength(1);
    expect(paires[0]).toEqual(PAIRE_VALIDE);
  });

  it("rend une liste vide quand la clé est absente, nulle ou d'un autre type", () => {
    expect(lirePairesSimilaires(undefined)).toEqual([]);
    expect(lirePairesSimilaires(null)).toEqual([]);
    expect(lirePairesSimilaires({ paires: [PAIRE_VALIDE] })).toEqual([]);
    expect(lirePairesSimilaires("57")).toEqual([]);
  });

  it("ÉCARTE une paire à qui il manque un champ qui s'afficherait faux", () => {
    const sansScore = { ...PAIRE_VALIDE, jaccard: undefined };
    const scoreNonFini = { ...PAIRE_VALIDE, jaccard: Number.NaN };
    const sansTitre = { ...PAIRE_VALIDE, titleB: "" };
    const sansIdentifiant = { ...PAIRE_VALIDE, jobIdB: undefined };
    const sansDate = { ...PAIRE_VALIDE, detectedAt: undefined };
    for (const mauvaise of [sansScore, scoreNonFini, sansTitre, sansIdentifiant, sansDate]) {
      expect(lirePairesSimilaires([mauvaise, PAIRE_VALIDE])).toEqual([PAIRE_VALIDE]);
    }
  });

  it("accepte une ville absente — c'est un cas normal, pas une anomalie", () => {
    const sansVille = { ...PAIRE_VALIDE, anchorVilleA: null, anchorVilleB: undefined };
    const paires = lirePairesSimilaires([sansVille]);
    expect(paires).toHaveLength(1);
    expect(paires[0]?.anchorVilleA).toBeNull();
    expect(paires[0]?.anchorVilleB).toBeNull();
  });
});

describe("une seule source pour la forme des paires", () => {
  const worker = readFileSync(
    join(process.cwd(), "src/server/queue/workers/content-similarity-monitor-worker.ts"),
    "utf8",
  );

  it("le worker importe la forme au lieu de la re-déclarer", () => {
    expect(worker).toContain('from "@/server/content-gen/paires-similaires"');
    expect(worker).not.toMatch(/interface\s+SimilarityPair\s*\{/);
  });

  it("le worker écrit sous la clé partagée, pas sous une chaîne recopiée", () => {
    expect(worker).toContain("CLE_PAIRES_SIMILAIRES");
    expect(worker).not.toMatch(/persistContentGenConfig\(\s*\n?\s*"similarity_pairs"/);
    expect(CLE_PAIRES_SIMILAIRES).toBe("similarity_pairs");
  });
});
