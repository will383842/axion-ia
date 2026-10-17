/**
 * Lot L08 — l'étape « évaluation finale » entre dans l'accueil du formateur
 * seulement quand son espace porte la saisie (`qualiopi.pedagogie.actif`).
 * Sans l'option, la table historique est inchangée.
 */
import { describe, expect, it } from "vitest";

import {
  ETAPES_DU_FORMATEUR,
  GESTE_EVALUATION_FORMATEUR,
  concerneLeFormateur,
  filtrerEtapesFormateur,
} from "./etapes-formateur";

describe("étape evaluation_finale", () => {
  it("la table historique reste à false : éteint, rien ne change", () => {
    expect(ETAPES_DU_FORMATEUR.evaluation_finale).toBe(false);
    expect(concerneLeFormateur("evaluation_finale")).toBe(false);
    expect(concerneLeFormateur("evaluation_finale", { evaluationOuverte: false })).toBe(false);
  });

  it("l'option ouvre CETTE étape et aucune autre", () => {
    expect(concerneLeFormateur("evaluation_finale", { evaluationOuverte: true })).toBe(true);
    for (const cle of ["attestation", "convention_signee", "satisfaction_froid"] as const) {
      expect(concerneLeFormateur(cle, { evaluationOuverte: true })).toBe(false);
    }
  });

  it("filtrerEtapesFormateur applique l'option", () => {
    const lignes = [{ etape: { cle: "evaluation_finale" as const } }];
    expect(filtrerEtapesFormateur(lignes)).toEqual([]);
    expect(filtrerEtapesFormateur(lignes, { evaluationOuverte: true })).toHaveLength(1);
  });

  it("le geste ne nomme aucun bouton de la console", () => {
    expect(GESTE_EVALUATION_FORMATEUR).toMatch(/formation/i);
    expect(GESTE_EVALUATION_FORMATEUR).not.toMatch(/onglet|console/i);
  });
});
