/** Lot B8 : frise des quatre étapes et libellés. */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  estEtapeFinale,
  etapesDeLaFrise,
  libelleChances,
  libelleCloture,
} from "../affichage-prestation";

describe("etapesDeLaFrise", () => {
  it("accepté : deux faites, une courante, une à venir", () => {
    expect(etapesDeLaFrise("accepte")).toEqual([
      { libelle: "Besoin", etat: "fait" },
      { libelle: "Devis envoyé", etat: "fait" },
      { libelle: "Accepté", etat: "courant" },
      { libelle: "Terminée", etat: "a_venir" },
    ]);
  });
  it("besoin : tout le reste à venir", () => {
    expect(etapesDeLaFrise("besoin").map((e) => e.etat)).toEqual([
      "courant",
      "a_venir",
      "a_venir",
      "a_venir",
    ]);
  });
  it("En pause et Perdue : pastille grise hors parcours, aucune étape courante", () => {
    for (const e of ["en_pause", "perdue"] as const) {
      const f = etapesDeLaFrise(e);
      expect(f).toHaveLength(5);
      expect(f.every((x) => x.etat === "hors_parcours")).toBe(true);
      expect(f[4]?.libelle).toBe(e === "en_pause" ? "En pause" : "Perdue");
    }
  });
});

describe("libellés", () => {
  afterEach(() => vi.useRealTimers());
  it("chances", () => {
    expect(libelleChances(60)).toBe("60 %");
    expect(libelleChances(0)).toBe("0 %");
    expect(libelleChances(null)).toBe("non estimées");
  });
  it("clôture, jour de Paris sans décalage", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T10:00:00.000Z"));
    try {
      expect(libelleCloture("2026-12-15")).toBe("15 déc.");
      expect(libelleCloture("2026-01-01")).toBe("1 janv.");
      expect(libelleCloture(null)).toBe("non estimée");
    } finally {
      vi.useRealTimers();
    }
  });
  it("clôture : l'année s'ajoute quand elle diffère de l'année en cours", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T10:00:00.000Z"));
    try {
      expect(libelleCloture("2027-01-15")).toBe("15 janv. 2027");
    } finally {
      vi.useRealTimers();
    }
  });
  it("clôture : la frontière du fuseau de Paris compte pour l'année en cours", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 31/12/2026 23:30 UTC = 01/01/2027 à Paris
    vi.setSystemTime(new Date("2026-12-31T23:30:00.000Z"));
    expect(libelleCloture("2027-01-15")).toBe("15 janv.");
  });
  it("étapes finales", () => {
    expect(estEtapeFinale("terminee")).toBe(true);
    expect(estEtapeFinale("perdue")).toBe(true);
    expect(estEtapeFinale("en_pause")).toBe(false);
  });
});
