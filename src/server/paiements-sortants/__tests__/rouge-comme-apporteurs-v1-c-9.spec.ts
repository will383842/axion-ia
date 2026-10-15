/**
 * Vérification 1, V1-C-9 (décision : même règle que la vue des apporteurs).
 *
 * L'écran des commissions apporteurs passe au ROUGE seulement une fois l'échéance
 * DÉPASSÉE (`echeanceDepassee : jour > échéance`, autofacture-donnees.ts) : le jour
 * même de l'échéance, le virement est encore dans les délais. La vue commune suit la
 * même règle : le jour de la date cible, ORANGE (« dernier délai ») ; rouge le
 * lendemain de l'échéance — y compris quand l'échéance tombe un week-end et que la
 * date cible (dernier jour ouvré) la précède.
 */

import { describe, expect, it } from "vitest";

import { couleurDe, ordonnerVirements, type VirementLu } from "../virements";

const formateur = (echeance: string): VirementLu => ({
  flux: "formateur",
  pieceId: "p1",
  beneficiaireId: "b",
  beneficiaire: "Bénéficiaire",
  reference: null,
  montantCents: 70_000,
  emissionAt: new Date("2038-07-01T10:00:00Z"),
  echeance,
});

describe("V1-C-9 — le passage au rouge, comme pour les apporteurs", () => {
  it("échéance un jeudi : orange le jour même, rouge le lendemain", () => {
    expect(ordonnerVirements([formateur("2038-08-26")], "2038-08-26")[0]!.couleur).toBe("orange");
    expect(ordonnerVirements([formateur("2038-08-26")], "2038-08-27")[0]!.couleur).toBe("rouge");
  });

  it("échéance un samedi (date cible le vendredi) : orange jusqu'au samedi, rouge le dimanche", () => {
    const v = formateur("2038-08-28"); // samedi
    expect(ordonnerVirements([v], "2038-08-27")[0]!.dateCible).toBe("2038-08-27");
    expect(ordonnerVirements([v], "2038-08-27")[0]!.couleur).toBe("orange");
    expect(ordonnerVirements([v], "2038-08-28")[0]!.couleur).toBe("orange");
    expect(ordonnerVirements([v], "2038-08-29")[0]!.couleur).toBe("rouge");
  });

  it("couleurDe avec l'échéance : la règle seule", () => {
    expect(couleurDe("2038-08-27", "2038-08-28", "2038-08-28")).toBe("orange");
    expect(couleurDe("2038-08-27", "2038-08-29", "2038-08-28")).toBe("rouge");
    expect(couleurDe("2038-08-27", "2038-08-10", "2038-08-28")).toBe("a_venir");
  });
});
