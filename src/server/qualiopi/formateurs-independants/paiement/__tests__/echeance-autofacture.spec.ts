// @vitest-environment node

/**
 * Décision du 14/10/2026 — la date limite du virement part de l'AUTOFACTURE. Contre-calcul
 * en jours civils, à la main :
 *   - autofacture du 20/11/2026 → 20/11 + 30 = 20/12/2026 ;
 *   - fin de mois : autofacture du 31/01/2027 → 02/03/2027 (janvier 31 j, février 28 j) ;
 *   - relevé écrit le 04/12/2031, dernière journée 03/12/2031 → provisoire 03/01/2032
 *     (jamais avant 02/01/2032).
 */

import { describe, expect, it } from "vitest";

import {
  derniereJourneeDuMois,
  echeanceAutofactureMission,
  echeanceDepuisAutofacture,
  echeanceProvisoireDuReleve,
} from "../echeance-autofacture";

describe("echeanceDepuisAutofacture : 30 jours civils après la facture", () => {
  it("20/11/2026 → 20/12/2026 ; 31/01/2027 → 02/03/2027", () => {
    expect(echeanceDepuisAutofacture("2026-11-20")).toBe("2026-12-20");
    expect(echeanceDepuisAutofacture("2027-01-31")).toBe("2027-03-02");
  });
});

describe("echeanceAutofactureMission", () => {
  const base = {
    jourAutofacture: "2026-11-20",
    echeanceDuReleve: "2026-11-29",
    remplace: false,
    objets: ["animation", "deplacement"],
  } as const;

  it("animation : la date de la facture + 30, quelle que soit l'échéance provisoire", () => {
    expect(echeanceAutofactureMission(base)).toBe("2026-12-20");
    expect(echeanceAutofactureMission({ ...base, echeanceDuReleve: "2027-02-01" })).toBe(
      "2026-12-20",
    );
    expect(echeanceAutofactureMission({ ...base, echeanceDuReleve: null })).toBe("2026-12-20");
  });

  it("facture rectifiée : la date limite de la pièce remplacée (art. 16.5)", () => {
    expect(echeanceAutofactureMission({ ...base, remplace: true })).toBe("2026-11-29");
  });

  it("indemnité d'annulation ou présentation : la date fixe si elle est plus proche, sinon la facture + 30", () => {
    for (const objet of ["indemnite_annulation", "presentation_methode"]) {
      expect(echeanceAutofactureMission({ ...base, objets: ["animation", objet] })).toBe(
        "2026-11-29",
      );
      expect(
        echeanceAutofactureMission({
          ...base,
          objets: [objet],
          echeanceDuReleve: "2027-01-05",
        }),
      ).toBe("2026-12-20");
    }
  });
});

describe("echeanceProvisoireDuReleve", () => {
  it("le jour d'écriture + 30, jamais avant la dernière journée + 30", () => {
    expect(
      echeanceProvisoireDuReleve({
        jourEcriture: "2031-12-04",
        echeanceDerniereJournee: "2032-01-02",
      }),
    ).toBe("2032-01-03");
    expect(
      echeanceProvisoireDuReleve({
        jourEcriture: "2031-12-01",
        echeanceDerniereJournee: "2032-01-02",
      }),
    ).toBe("2032-01-02");
  });
});

describe("derniereJourneeDuMois : la date de la mission, où se juge l'attestation URSSAF", () => {
  it("la dernière journée de ce formateur dans le mois du relevé", () => {
    expect(
      derniereJourneeDuMois({
        journees: ["2026-10-28", "2026-10-30", "2026-11-03"],
        mois: "2026-10",
        jourRepli: "2026-11-20",
      }),
    ).toBe("2026-10-30");
  });

  it("aucune journée ce mois-là : le plus tôt de la fin du mois et du jour de la facture", () => {
    expect(derniereJourneeDuMois({ journees: [], mois: "2026-02", jourRepli: "2026-03-10" })).toBe(
      "2026-02-28",
    );
    expect(derniereJourneeDuMois({ journees: [], mois: "2026-11", jourRepli: "2026-11-12" })).toBe(
      "2026-11-12",
    );
  });
});

describe("derniereJourneeDuReleve : pièce à date fixe seule → l'événement (échéance − 30)", () => {
  it("indemnité seule : le jour de l'annulation, jamais la journée annulée ni la facture", async () => {
    const { derniereJourneeDuReleve } = await import("../virement-mission-base");
    const db = { trainingSession: { findUnique: async () => null } };
    expect(
      await derniereJourneeDuReleve(
        db,
        {
          trainerId: "t",
          sessionId: "s",
          periodeYear: 2026,
          periodeMonth: 10,
          dateFacture: new Date("2026-10-25T10:00:00Z"),
          // Annulation le 05/10 → échéance fixe 04/11 (05/10 + 30).
          echeanceAt: new Date("2026-11-04T12:00:00Z"),
          objets: ["indemnite_annulation"],
        },
        new Date("2026-10-26T10:00:00Z"),
      ),
    ).toBe("2026-10-05");
  });
});
