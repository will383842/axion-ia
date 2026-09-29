/**
 * G5 — UN DÉCIDEUR NE SE DÉDUIT PAS : `deduit` n'est permis que pour les types
 * de `TYPES_DEDUCTIBLES` (société, activité, niveau d'IA).
 */

import { describe, expect, it } from "vitest";

import { TYPES_DEDUCTIBLES } from "../../types-de-faits";
import { fait } from "../../../../../tests/fixtures/visio/scenario-menuiserie";
import { leFait, verifier, FAITS } from "./outils";

describe("un décideur ne se déduit pas", () => {
  it("decideur « deduit » → deduction_interdite", () => {
    const b = verifier([
      ...FAITS,
      fait({
        ref: "F09",
        type: "decideur",
        enonce: "La gérante décide.",
        certitude: "deduit",
        preuves: [{ segment_ids: ["S0004"], citation: "On serait douze commerciaux à former" }],
      }),
    ]);
    expect(leFait(b, "F09")).toMatchObject({ statut: "rejete", motif: "deduction_interdite" });
  });

  it("contre-témoin : l'activité peut se déduire", () => {
    expect(TYPES_DEDUCTIBLES).toEqual(
      expect.arrayContaining(["info_societe", "activite", "niveau_ia"]),
    );
    const b = verifier([
      ...FAITS,
      fait({
        ref: "F09",
        type: "activite",
        portee: "entreprise",
        projet_ref: null,
        enonce: "L'entreprise a une équipe commerciale.",
        certitude: "deduit",
        preuves: [{ segment_ids: ["S0004"], citation: "On serait douze commerciaux à former" }],
      }),
    ]);
    expect(leFait(b, "F09")).toMatchObject({ statut: "propose", certitude: "deduit" });
  });
});
