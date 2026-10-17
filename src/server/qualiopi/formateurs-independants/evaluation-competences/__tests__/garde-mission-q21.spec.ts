// @vitest-environment node

/** Qualiopi ind. 21 — aucune mission sans décision d'habilitation en vigueur. */

import { describe, expect, it } from "vitest";

import { VERSION_CONFIGURATION_EVALUATION } from "../configuration";
import { manqueHabilitationMission } from "../garde-mission-q21";
import {
  MANQUE_MISSION_FORMATION_INCONNUE,
  MANQUE_MISSION_HABILITATION,
  type LigneEvaluationLue,
} from "../regles";

let n = 0;
const decision = (formationId: string, d: string): LigneEvaluationLue => {
  n += 1;
  return {
    id: `d${n}`,
    nature: "decision_habilitation",
    formationId,
    notes: null,
    decision: d,
    motif: "m",
    dateSuivie: null,
    version: VERSION_CONFIGURATION_EVALUATION,
    createdAt: new Date(Date.UTC(2026, 9, 1, 0, n)),
  };
};

describe("manqueHabilitationMission", () => {
  const lignes = [
    decision("f1", "habilite"),
    decision("f2", "avec_reserve"),
    decision("f3", "habilite"),
    decision("f3", "second_essai"),
  ];

  it("formation habilitée ou avec réserve : rien ne manque", () => {
    expect(manqueHabilitationMission("sous_traitant", lignes, "f1")).toBeNull();
    expect(manqueHabilitationMission("sous_traitant", lignes, "f2")).toBeNull();
  });
  it("dernière décision « 2e essai », ou aucune décision : refus", () => {
    expect(manqueHabilitationMission("sous_traitant", lignes, "f3")).toBe(
      MANQUE_MISSION_HABILITATION,
    );
    expect(manqueHabilitationMission("sous_traitant", lignes, "f4")).toBe(
      MANQUE_MISSION_HABILITATION,
    );
  });
  it("lignes non lues : refus (garde fermée)", () => {
    expect(manqueHabilitationMission("sous_traitant", undefined, "f1")).toBe(
      MANQUE_MISSION_HABILITATION,
    );
  });
  it("formation illisible : refus", () => {
    expect(manqueHabilitationMission("sous_traitant", lignes, null)).toBe(
      MANQUE_MISSION_FORMATION_INCONNUE,
    );
  });
  it("sans mission précise : au moins une formation en vigueur", () => {
    expect(manqueHabilitationMission("sous_traitant", lignes, undefined)).toBeNull();
    expect(manqueHabilitationMission("sous_traitant", [], undefined)).toBe(
      MANQUE_MISSION_HABILITATION,
    );
  });
  it("salariés et dirigeants : jamais concernés", () => {
    expect(manqueHabilitationMission("salarie", [], "f1")).toBeNull();
    expect(manqueHabilitationMission("dirigeant", undefined, null)).toBeNull();
  });
});
