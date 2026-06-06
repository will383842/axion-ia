/**
 * Tests — canCreateSessionFor (guard métier pur).
 *
 * Couvre toutes les combinaisons FormationStatutGeneration × FormationStatut
 * pertinentes pour s'assurer qu'aucune combinaison non-publiée/non-active
 * ne passe le guard.
 */

import { describe, it, expect } from "vitest";
import { canCreateSessionFor } from "./formations";
import type { FormationStatutGeneration, FormationStatut } from "./types";

const ALL_STATUTS: FormationStatut[] = ["actif", "publie", "archive"];

const ALL_STATUT_GENERATIONS: FormationStatutGeneration[] = [
  "intention",
  "structure_generee",
  "contenu_evalue",
  "structure_validee",
  "contenu_genere",
  "contenu_valide",
  "assemble",
  "publie",
  "archive",
];

describe("canCreateSessionFor", () => {
  it("retourne true pour publie + actif (seul cas valide)", () => {
    expect(canCreateSessionFor({ statutGeneration: "publie", statut: "actif" })).toBe(true);
  });

  it("retourne false pour publie + archive", () => {
    expect(canCreateSessionFor({ statutGeneration: "publie", statut: "archive" })).toBe(false);
  });

  it("retourne false pour publie + publie (statut 'publie' n'est pas 'actif')", () => {
    expect(canCreateSessionFor({ statutGeneration: "publie", statut: "publie" })).toBe(false);
  });

  it("retourne false pour intention + actif", () => {
    expect(canCreateSessionFor({ statutGeneration: "intention", statut: "actif" })).toBe(false);
  });

  it("retourne false pour structure_generee + actif", () => {
    expect(canCreateSessionFor({ statutGeneration: "structure_generee", statut: "actif" })).toBe(
      false,
    );
  });

  it("retourne false pour contenu_evalue + actif", () => {
    expect(canCreateSessionFor({ statutGeneration: "contenu_evalue", statut: "actif" })).toBe(
      false,
    );
  });

  it("retourne false pour structure_validee + actif", () => {
    expect(canCreateSessionFor({ statutGeneration: "structure_validee", statut: "actif" })).toBe(
      false,
    );
  });

  it("retourne false pour contenu_genere + actif", () => {
    expect(canCreateSessionFor({ statutGeneration: "contenu_genere", statut: "actif" })).toBe(
      false,
    );
  });

  it("retourne false pour contenu_valide + actif", () => {
    expect(canCreateSessionFor({ statutGeneration: "contenu_valide", statut: "actif" })).toBe(
      false,
    );
  });

  it("retourne false pour assemble + actif", () => {
    expect(canCreateSessionFor({ statutGeneration: "assemble", statut: "actif" })).toBe(false);
  });

  it("retourne false pour archive + actif", () => {
    expect(canCreateSessionFor({ statutGeneration: "archive", statut: "actif" })).toBe(false);
  });

  it("exactement 1 combinaison retourne true parmi tous les statuts × generationStatuts", () => {
    const trueCount = ALL_STATUTS.flatMap((statut) =>
      ALL_STATUT_GENERATIONS.map((statutGeneration) =>
        canCreateSessionFor({ statutGeneration, statut }),
      ),
    ).filter(Boolean).length;

    expect(trueCount).toBe(1);
  });

  it("la seule combinaison vraie est publie × actif", () => {
    for (const statut of ALL_STATUTS) {
      for (const statutGeneration of ALL_STATUT_GENERATIONS) {
        const result = canCreateSessionFor({ statutGeneration, statut });
        const expected = statutGeneration === "publie" && statut === "actif";
        expect(result, `${statutGeneration} × ${statut}`).toBe(expected);
      }
    }
  });
});
