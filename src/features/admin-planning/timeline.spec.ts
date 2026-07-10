// Tests — timeline.ts (vue ressources × jours).
//
// Les invariants qui comptent : les sessions non staffées remontent EN TÊTE (le
// pilote doit les voir), une prestation multi-jours n'est comptée qu'une fois,
// une prestation annulée n'occupe personne, et l'ordre des lignes est stable.

import { describe, it, expect } from "vitest";
import { construireTimeline, estWeekEnd, joursDuMois, type TimelineFormateur } from "./timeline";
import type { PlanningEvent } from "./types";

function ev(over: Partial<PlanningEvent> = {}): PlanningEvent {
  return {
    key: "formation:1",
    type: "formation",
    id: "1",
    titre: "Formation IA",
    debut: new Date("2026-06-10T08:00:00Z"),
    fin: new Date("2026-06-10T17:00:00Z"),
    statut: "planifiee",
    formateurNom: "Ana Roux",
    formateurId: "t1",
    clientNom: "ACME",
    lieu: null,
    ...over,
  };
}

const FORMATEURS: TimelineFormateur[] = [
  { id: "t1", prenom: "Ana", nom: "Roux" },
  { id: "t2", prenom: "Bo", nom: "Li" },
];

function byDay(entries: [string, PlanningEvent[]][]): Map<string, PlanningEvent[]> {
  return new Map(entries);
}

describe("construireTimeline — ligne « Non affecté »", () => {
  it("INVARIANT : les prestations sans formateur passent EN PREMIER", () => {
    const lignes = construireTimeline(
      byDay([
        ["2026-06-10", [ev({ key: "f:1", formateurId: "t1" })]],
        [
          "2026-06-11",
          [
            ev({
              key: "f:2",
              formateurId: null,
              formateurNom: null,
              debut: new Date("2026-06-11T08:00:00Z"),
            }),
          ],
        ],
      ]),
      FORMATEURS,
    );

    expect(lignes[0]?.formateurId).toBeNull();
    expect(lignes[0]?.formateurNom).toBe("Non affecté");
  });

  it("`formateurId` absent (undefined) compte aussi comme non affecté", () => {
    const e = ev({ key: "f:3" });
    delete (e as { formateurId?: string | null }).formateurId;
    const lignes = construireTimeline(byDay([["2026-06-10", [e]]]), FORMATEURS);
    expect(lignes[0]?.formateurId).toBeNull();
  });

  it("aucune ligne « Non affecté » quand tout est staffé", () => {
    const lignes = construireTimeline(byDay([["2026-06-10", [ev()]]]), FORMATEURS);
    expect(lignes.every((l) => l.formateurId !== null)).toBe(true);
  });
});

describe("construireTimeline — comptage", () => {
  it("une prestation multi-jours occupe chaque jour mais ne compte qu'une prestation", () => {
    const e = ev({ key: "f:multi", fin: new Date("2026-06-12T17:00:00Z") });
    const lignes = construireTimeline(
      byDay([
        ["2026-06-10", [e]],
        ["2026-06-11", [e]],
        ["2026-06-12", [e]],
      ]),
      FORMATEURS,
    );
    expect(lignes[0]?.joursOccupes).toBe(3);
    expect(lignes[0]?.nbPrestations).toBe(1);
  });

  it("deux prestations le même jour : 1 jour occupé, 2 prestations", () => {
    const lignes = construireTimeline(
      byDay([["2026-06-10", [ev({ key: "f:a" }), ev({ key: "f:b" })]]]),
      FORMATEURS,
    );
    expect(lignes[0]?.joursOccupes).toBe(1);
    expect(lignes[0]?.nbPrestations).toBe(2);
    expect(lignes[0]?.parJour.get("2026-06-10")).toHaveLength(2);
  });

  it("la même prestation répétée sur un jour n'est pas comptée deux fois", () => {
    const e = ev({ key: "f:dup" });
    const lignes = construireTimeline(byDay([["2026-06-10", [e, e]]]), FORMATEURS);
    expect(lignes[0]?.parJour.get("2026-06-10")).toHaveLength(1);
    expect(lignes[0]?.nbPrestations).toBe(1);
  });
});

describe("construireTimeline — ce qui ne mobilise personne", () => {
  it.each(["annulee", "reportee"] as const)(
    "une prestation `%s` n'occupe aucune case",
    (statut) => {
      const lignes = construireTimeline(byDay([["2026-06-10", [ev({ statut })]]]), FORMATEURS);
      expect(lignes).toEqual([]);
    },
  );

  it("cohérent avec la vue charge : seul le mobilisant occupe", () => {
    const lignes = construireTimeline(
      byDay([["2026-06-10", [ev({ key: "f:ok" }), ev({ key: "f:ko", statut: "annulee" })]]]),
      FORMATEURS,
    );
    expect(lignes[0]?.nbPrestations).toBe(1);
  });

  it("`en_cours` et `realisee` mobilisent bien", () => {
    const lignes = construireTimeline(
      byDay([
        [
          "2026-06-10",
          [ev({ key: "a", statut: "en_cours" }), ev({ key: "b", statut: "realisee" })],
        ],
      ]),
      FORMATEURS,
    );
    expect(lignes[0]?.nbPrestations).toBe(2);
  });
});

describe("construireTimeline — nommage et tri", () => {
  it("nomme depuis le référentiel formateurs, pas depuis l'événement", () => {
    const lignes = construireTimeline(
      byDay([["2026-06-10", [ev({ formateurNom: "Nom périmé" })]]]),
      FORMATEURS,
    );
    expect(lignes[0]?.formateurNom).toBe("Ana Roux");
  });

  it("un formateur absent du référentiel garde sa ligne, nommée par l'événement", () => {
    // Formateur désactivé depuis : on ne fait pas disparaître du travail planifié.
    const lignes = construireTimeline(
      byDay([["2026-06-10", [ev({ formateurId: "t9", formateurNom: "Zoé Ex" })]]]),
      FORMATEURS,
    );
    expect(lignes[0]?.formateurNom).toBe("Zoé Ex");
  });

  it("trie par jours occupés décroissants, puis alphabétiquement", () => {
    const t1a = ev({ key: "a", formateurId: "t1" });
    const lignes = construireTimeline(
      byDay([
        ["2026-06-10", [t1a, ev({ key: "b", formateurId: "t2", formateurNom: "Bo Li" })]],
        ["2026-06-11", [ev({ key: "c", formateurId: "t2", formateurNom: "Bo Li" })]],
      ]),
      FORMATEURS,
    );
    // t2 occupe 2 jours, t1 un seul.
    expect(lignes.map((l) => l.formateurNom)).toEqual(["Bo Li", "Ana Roux"]);
  });

  it("à égalité de jours, l'ordre est alphabétique (stable d'un rendu à l'autre)", () => {
    const lignes = construireTimeline(
      byDay([
        [
          "2026-06-10",
          [
            ev({ key: "a", formateurId: "t2", formateurNom: "Bo Li" }),
            ev({ key: "b", formateurId: "t1" }),
          ],
        ],
      ]),
      FORMATEURS,
    );
    expect(lignes.map((l) => l.formateurNom)).toEqual(["Ana Roux", "Bo Li"]);
  });

  it("« Non affecté » passe devant même le formateur le plus chargé", () => {
    const t1 = ev({ key: "a", formateurId: "t1" });
    const lignes = construireTimeline(
      byDay([
        ["2026-06-10", [t1, ev({ key: "z", formateurId: null, formateurNom: null })]],
        ["2026-06-11", [ev({ key: "b", formateurId: "t1" })]],
        ["2026-06-12", [ev({ key: "c", formateurId: "t1" })]],
      ]),
      FORMATEURS,
    );
    expect(lignes[0]?.formateurId).toBeNull();
    expect(lignes[0]?.joursOccupes).toBe(1);
    expect(lignes[1]?.joursOccupes).toBe(3);
  });
});

describe("joursDuMois", () => {
  it("juin 2026 → 30 jours", () => {
    const j = joursDuMois(2026, 6);
    expect(j).toHaveLength(30);
    expect(j[0]).toBe("2026-06-01");
    expect(j[29]).toBe("2026-06-30");
  });

  it("février 2026 (non bissextile) → 28 jours", () => {
    expect(joursDuMois(2026, 2)).toHaveLength(28);
  });

  it("février 2024 (bissextile) → 29 jours", () => {
    expect(joursDuMois(2024, 2)).toHaveLength(29);
  });

  it("décembre → 31 jours et pas de débordement d'année", () => {
    const j = joursDuMois(2026, 12);
    expect(j).toHaveLength(31);
    expect(j[30]).toBe("2026-12-31");
  });

  it("les clés sont zéro-paddées (elles indexent la Map de `getPlanningMonth`)", () => {
    expect(joursDuMois(2026, 1)[0]).toBe("2026-01-01");
  });
});

describe("estWeekEnd", () => {
  it("samedi et dimanche", () => {
    expect(estWeekEnd("2026-06-13")).toBe(true); // samedi
    expect(estWeekEnd("2026-06-14")).toBe(true); // dimanche
  });

  it("lundi à vendredi", () => {
    for (const d of ["2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12"]) {
      expect(estWeekEnd(d)).toBe(false);
    }
  });
});
