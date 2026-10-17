/**
 * L09 — les échéances d'une réclamation se comptent en JOURS OUVRÉS, au
 * calendrier de Paris : accusé sous 5, réponse sous 15.
 */
import { describe, expect, it } from "vitest";
import {
  DELAI_ACCUSE_JOURS_OUVRES,
  DELAI_REPONSE_JOURS_OUVRES,
  echeancesReclamation,
  etatEcheances,
  jourParis,
  joursOuvresRestants,
} from "../echeances";

describe("échéances en jours ouvrés", () => {
  it("les délais sont ceux de la procédure : 5 et 15 jours ouvrés", () => {
    expect(DELAI_ACCUSE_JOURS_OUVRES).toBe(5);
    expect(DELAI_REPONSE_JOURS_OUVRES).toBe(15);
  });

  it("une réclamation du vendredi 16 octobre 2026 : accusé le 23, réponse le 6 novembre", () => {
    // Le 1er novembre (dimanche) et le 11 novembre ne jouent pas ici ;
    // week-ends exclus : 19-23 oct. = 5 jours ouvrés.
    const e = echeancesReclamation(new Date("2026-10-16T14:00:00.000Z"));
    expect(jourParis(e.accuseAvant)).toBe("2026-10-23");
    expect(jourParis(e.reponseAvant)).toBe("2026-11-06");
  });

  it("les jours fériés ne comptent pas : 11 novembre 2026 (mercredi)", () => {
    // Reçue le lundi 9 novembre : 10, 12, 13, 16, 17 → accusé le 17.
    const e = echeancesReclamation(new Date("2026-11-09T09:00:00.000Z"));
    expect(jourParis(e.accuseAvant)).toBe("2026-11-17");
  });

  it("le jour est celui de Paris, pas d'UTC : 23 h 30 UTC le 31 déc. = 1er janvier à Paris", () => {
    expect(jourParis(new Date("2026-12-31T23:30:00.000Z"))).toBe("2027-01-01");
  });

  it("compte les jours ouvrés restants jusqu'à l'échéance, négatif une fois dépassée", () => {
    const echeance = new Date("2026-10-23T14:00:00.000Z"); // vendredi
    expect(joursOuvresRestants(new Date("2026-10-19T08:00:00.000Z"), echeance)).toBe(4);
    expect(joursOuvresRestants(new Date("2026-10-23T20:00:00.000Z"), echeance)).toBe(0);
    // Lundi 26 : un jour ouvré de retard.
    expect(joursOuvresRestants(new Date("2026-10-26T08:00:00.000Z"), echeance)).toBe(-1);
  });
});

describe("etatEcheances", () => {
  const recue = new Date("2026-10-16T14:00:00.000Z");

  it("accusé fait, réponse due : « dans les temps » puis « proche » puis « dépassée »", () => {
    const etapes = [{ etape: "reception" as const }, { etape: "accuse" as const }];
    expect(etatEcheances(recue, etapes, new Date("2026-10-19T08:00:00Z")).reponse).toBe(
      "dans_les_temps",
    );
    expect(etatEcheances(recue, etapes, new Date("2026-11-03T08:00:00Z")).reponse).toBe("proche");
    expect(etatEcheances(recue, etapes, new Date("2026-11-09T08:00:00Z")).reponse).toBe("depassee");
    expect(etatEcheances(recue, etapes, new Date("2026-11-09T08:00:00Z")).accuse).toBe("fait");
  });

  it("sans accusé au-delà de 5 jours ouvrés : accusé dépassé", () => {
    const e = etatEcheances(recue, [{ etape: "reception" }], new Date("2026-10-26T08:00:00Z"));
    expect(e.accuse).toBe("depassee");
  });

  it("une réponse écrite éteint l'échéance de réponse, même tardive", () => {
    const e = etatEcheances(
      recue,
      [{ etape: "reception" }, { etape: "accuse" }, { etape: "analyse" }, { etape: "reponse" }],
      new Date("2026-12-01T08:00:00Z"),
    );
    expect(e.reponse).toBe("fait");
  });

  it("un réexamen rouvre une échéance de réponse, comptée depuis le réexamen", () => {
    const e = etatEcheances(
      recue,
      [
        { etape: "reception" },
        { etape: "accuse" },
        { etape: "analyse" },
        { etape: "reponse" },
        { etape: "reexamen", creeLe: new Date("2026-11-20T10:00:00Z") },
      ],
      new Date("2026-11-23T08:00:00Z"),
    );
    expect(e.reponse).toBe("dans_les_temps");
    expect(jourParis(e.reponseAvant)).toBe("2026-12-11");
  });
});
