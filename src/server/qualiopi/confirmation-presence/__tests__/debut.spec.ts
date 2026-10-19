/**
 * QNC NC6, lot présence 2/3 — l'instant de début de la 1re demi-journée (réserve (b)
 * d'Opus sur le lot 1/3) et le jour J (réserve (c)). Fonctions pures.
 *
 * `dateDebut` est stocké à 00:00 UTC : le passer tel quel au jeton le ferait expirer
 * vers 1 h ou 2 h de Paris le jour J, avant le début réel de la formation.
 */

import { describe, expect, it } from "vitest";
import { debutPremiereDemiJournee } from "../debut";
import { jourJ } from "../calendrier";

describe("debutPremiereDemiJournee", () => {
  it("heure d'hiver : 09 h Paris = 08 h UTC", () => {
    const debut = debutPremiereDemiJournee({
      dateDebut: new Date("2026-12-07T00:00:00Z"),
      jours: [{ date: new Date("2026-12-07T00:00:00Z"), heureDebut: "09:00", heureFin: "17:00" }],
    });
    expect(debut).toEqual(new Date("2026-12-07T08:00:00Z"));
  });

  it("heure d'été : 09 h Paris = 07 h UTC", () => {
    const debut = debutPremiereDemiJournee({
      dateDebut: new Date("2026-07-06T00:00:00Z"),
      jours: [{ date: new Date("2026-07-06T00:00:00Z"), heureDebut: "09:00", heureFin: "17:00" }],
    });
    expect(debut).toEqual(new Date("2026-07-06T07:00:00Z"));
  });

  it("une journée qui commence l'après-midi : l'instant est celui de l'après-midi", () => {
    const debut = debutPremiereDemiJournee({
      dateDebut: new Date("2026-12-07T00:00:00Z"),
      jours: [{ date: new Date("2026-12-07T00:00:00Z"), heureDebut: "14:00", heureFin: "17:30" }],
    });
    expect(debut).toEqual(new Date("2026-12-07T13:00:00Z"));
  });

  it("prend le PREMIER jour, quel que soit l'ordre des lignes", () => {
    const debut = debutPremiereDemiJournee({
      dateDebut: new Date("2026-12-07T00:00:00Z"),
      jours: [
        { date: new Date("2026-12-09T00:00:00Z"), heureDebut: "10:00", heureFin: "17:00" },
        { date: new Date("2026-12-07T00:00:00Z"), heureDebut: "09:30", heureFin: "17:00" },
      ],
    });
    expect(debut).toEqual(new Date("2026-12-07T08:30:00Z"));
  });

  it("n'est JAMAIS le dateDebut brut (00:00 UTC)", () => {
    const dateDebut = new Date("2026-12-07T00:00:00Z");
    const debut = debutPremiereDemiJournee({
      dateDebut,
      jours: [{ date: dateDebut, heureDebut: "09:00", heureFin: "17:00" }],
    });
    expect(debut.getTime()).not.toBe(dateDebut.getTime());
  });

  it("sans journée déclarée : minuit de Paris du jour J (le plus tôt, donc le plus prudent)", () => {
    // 26 octobre 2026 : heure d'hiver, minuit Paris = 23 h UTC la veille.
    const debut = debutPremiereDemiJournee({
      dateDebut: new Date("2026-10-26T00:00:00Z"),
      jours: [],
    });
    expect(debut).toEqual(new Date("2026-10-25T23:00:00Z"));
  });
});

describe("jourJ : la date de Paris, pas la date UTC (réserve (c))", () => {
  const dateDebut = new Date("2026-12-07T00:00:00Z");

  it("chaîne ISO avec heure en hiver : 23 h UTC du 6 = 00 h Paris du 7", () => {
    expect(jourJ({ dateDebut, jours: [{ date: "2026-12-06T23:30:00Z" }] })).toBe("2026-12-07");
  });

  it("chaîne ISO avec heure en été : 22 h 30 UTC du 6 = 00 h 30 Paris du 7", () => {
    expect(jourJ({ dateDebut, jours: [{ date: "2026-07-06T22:30:00Z" }] })).toBe("2026-07-07");
  });

  it("chaîne ISO avec heure dans la journée : la date ne bouge pas", () => {
    expect(jourJ({ dateDebut, jours: [{ date: "2026-12-07T10:00:00Z" }] })).toBe("2026-12-07");
  });

  it("date seule `YYYY-MM-DD` : prise telle quelle", () => {
    expect(jourJ({ dateDebut, jours: [{ date: "2026-12-07" }] })).toBe("2026-12-07");
  });

  it("une Date à 00:00 UTC (colonne @db.Date) : le même jour à Paris", () => {
    expect(jourJ({ dateDebut, jours: [{ date: new Date("2026-12-07T00:00:00Z") }] })).toBe(
      "2026-12-07",
    );
    expect(jourJ({ dateDebut, jours: [{ date: new Date("2026-07-06T00:00:00Z") }] })).toBe(
      "2026-07-06",
    );
  });

  it("le plus petit jour l'emporte ; à défaut, dateDebut", () => {
    expect(
      jourJ({ dateDebut, jours: [{ date: "2026-12-09" }, { date: "2026-12-07T10:00:00Z" }] }),
    ).toBe("2026-12-07");
    expect(jourJ({ dateDebut, jours: [] })).toBe("2026-12-07");
    expect(jourJ({ dateDebut })).toBe("2026-12-07");
  });
});
