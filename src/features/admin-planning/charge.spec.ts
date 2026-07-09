/**
 * Tests — charge.ts (vue « charge formateur »).
 *
 * On vérifie le comptage des jours mobilisés (multi-jours, dédup, statuts
 * inactifs), le taux d'occupation (capacité nulle, surcharge non plafonnée), les
 * seuils de lecture, et le tri de `construireCharge`.
 */

import { describe, it, expect } from "vitest";
import {
  joursMobilises,
  tauxOccupation,
  niveauCharge,
  construireCharge,
  type FormateurRef,
} from "./charge";
import type { PlanningEvent, PlanningStatut } from "./types";

/** Fabrique d'événement de test (les champs non pertinents sont neutres). */
function ev(
  key: string,
  debut: string,
  fin: string | null,
  statut: PlanningStatut = "planifiee",
  formateurId: string | null = "t1",
): PlanningEvent {
  return {
    key,
    type: "formation",
    id: key,
    titre: key,
    debut: new Date(debut),
    fin: fin !== null ? new Date(fin) : null,
    statut,
    formateurNom: "Ada Lovelace",
    formateurId,
    clientNom: null,
    lieu: null,
  };
}

describe("joursMobilises", () => {
  it("aucun événement → 0 jour", () => {
    expect(joursMobilises([])).toBe(0);
  });

  it("une prestation d'un jour → 1 jour", () => {
    expect(joursMobilises([ev("a", "2026-07-09T07:00:00Z", "2026-07-09T15:00:00Z")])).toBe(1);
  });

  it("une formation multi-jours compte CHAQUE jour traversé", () => {
    // 08 → 10 juillet inclus = 3 jours.
    expect(joursMobilises([ev("a", "2026-07-08T07:00:00Z", "2026-07-10T15:00:00Z")])).toBe(3);
  });

  it("deux prestations le MÊME jour ne comptent qu'une fois (dédup)", () => {
    const matin = ev("m", "2026-07-09T07:00:00Z", "2026-07-09T11:00:00Z");
    const apresMidi = ev("a", "2026-07-09T12:00:00Z", "2026-07-09T16:00:00Z");
    expect(joursMobilises([matin, apresMidi])).toBe(1);
  });

  it("deux prestations sur des jours différents → 2 jours", () => {
    const j1 = ev("a", "2026-07-09T07:00:00Z", "2026-07-09T11:00:00Z");
    const j2 = ev("b", "2026-07-10T07:00:00Z", "2026-07-10T11:00:00Z");
    expect(joursMobilises([j1, j2])).toBe(2);
  });

  it("chevauchement partiel de jours entre deux prestations → union dédupliquée", () => {
    // 08-09 et 09-10 → jours {08,09,10} = 3.
    const p1 = ev("a", "2026-07-08T07:00:00Z", "2026-07-09T15:00:00Z");
    const p2 = ev("b", "2026-07-09T07:00:00Z", "2026-07-10T15:00:00Z");
    expect(joursMobilises([p1, p2])).toBe(3);
  });

  it("une prestation ANNULÉE ne compte pas", () => {
    expect(
      joursMobilises([ev("a", "2026-07-09T07:00:00Z", "2026-07-09T15:00:00Z", "annulee")]),
    ).toBe(0);
  });

  it("une prestation REPORTÉE ne compte pas", () => {
    expect(
      joursMobilises([ev("a", "2026-07-09T07:00:00Z", "2026-07-09T15:00:00Z", "reportee")]),
    ).toBe(0);
  });

  it("mélange : seules les prestations mobilisantes comptent", () => {
    const active = ev("a", "2026-07-09T07:00:00Z", "2026-07-09T15:00:00Z", "planifiee");
    const annulee = ev("b", "2026-07-10T07:00:00Z", "2026-07-10T15:00:00Z", "annulee");
    const realisee = ev("c", "2026-07-11T07:00:00Z", "2026-07-11T15:00:00Z", "realisee");
    expect(joursMobilises([active, annulee, realisee])).toBe(2);
  });

  it("prestation « journée entière » (fin null) → 1 jour", () => {
    expect(joursMobilises([ev("a", "2026-07-09T05:00:00Z", null)])).toBe(1);
  });
});

describe("tauxOccupation", () => {
  it("capacité 0 → 0 % (pas de division par zéro)", () => {
    expect(tauxOccupation(5, 0)).toBe(0);
  });

  it("capacité négative → 0 %", () => {
    expect(tauxOccupation(5, -3)).toBe(0);
  });

  it("0 jour mobilisé → 0 %", () => {
    expect(tauxOccupation(0, 20)).toBe(0);
  });

  it("moitié de la capacité → 50 %", () => {
    expect(tauxOccupation(10, 20)).toBe(50);
  });

  it("arrondit au pourcentage entier le plus proche", () => {
    // 7 / 20 = 35 % pile ; 1 / 3 = 33.33 → 33.
    expect(tauxOccupation(7, 20)).toBe(35);
    expect(tauxOccupation(1, 3)).toBe(33);
  });

  it("pleine capacité → 100 %", () => {
    expect(tauxOccupation(20, 20)).toBe(100);
  });

  it("SURCHARGE non plafonnée : > 100 % reste visible", () => {
    expect(tauxOccupation(25, 20)).toBe(125);
    expect(tauxOccupation(40, 20)).toBe(200);
  });
});

describe("niveauCharge", () => {
  it("< 70 % → sain", () => {
    expect(niveauCharge(0)).toBe("sain");
    expect(niveauCharge(69)).toBe("sain");
  });

  it("70 à 95 % → tension (bornes incluses)", () => {
    expect(niveauCharge(70)).toBe("tension");
    expect(niveauCharge(95)).toBe("tension");
  });

  it("> 95 % → surcharge", () => {
    expect(niveauCharge(96)).toBe("surcharge");
    expect(niveauCharge(130)).toBe("surcharge");
  });
});

describe("construireCharge", () => {
  const formateurs: FormateurRef[] = [
    { id: "t1", prenom: "Ada", nom: "Lovelace" },
    { id: "t2", prenom: "Alan", nom: "Turing" },
    { id: "t3", prenom: "Grace", nom: "Hopper" },
  ];

  it("un formateur sans prestation apparaît à 0 jour / 0 %", () => {
    const lignes = construireCharge(new Map(), formateurs, 20);
    expect(lignes).toHaveLength(3);
    for (const l of lignes) {
      expect(l.joursMobilises).toBe(0);
      expect(l.tauxPct).toBe(0);
      expect(l.capaciteJours).toBe(20);
    }
  });

  it("compose nom complet, jours et taux par formateur", () => {
    const parFormateur = new Map<string, PlanningEvent[]>([
      ["t1", [ev("a", "2026-07-09T07:00:00Z", "2026-07-10T15:00:00Z", "planifiee", "t1")]], // 2 jours
    ]);
    const lignes = construireCharge(parFormateur, formateurs, 20);
    const ada = lignes.find((l) => l.trainerId === "t1");
    expect(ada?.nom).toBe("Ada Lovelace");
    expect(ada?.joursMobilises).toBe(2);
    expect(ada?.tauxPct).toBe(10);
  });

  it("trie par taux décroissant (les plus chargés en tête)", () => {
    const parFormateur = new Map<string, PlanningEvent[]>([
      // t1 : 1 jour → 5 %
      ["t1", [ev("a", "2026-07-09T07:00:00Z", "2026-07-09T15:00:00Z", "planifiee", "t1")]],
      // t2 : 3 jours → 15 %
      ["t2", [ev("b", "2026-07-08T07:00:00Z", "2026-07-10T15:00:00Z", "planifiee", "t2")]],
      // t3 : 2 jours → 10 %
      ["t3", [ev("c", "2026-07-14T07:00:00Z", "2026-07-15T15:00:00Z", "planifiee", "t3")]],
    ]);
    const lignes = construireCharge(parFormateur, formateurs, 20);
    expect(lignes.map((l) => l.trainerId)).toEqual(["t2", "t3", "t1"]);
  });

  it("départage déterministe par nom quand les taux sont égaux", () => {
    // Tous à 0 % → ordre alphabétique : Ada, Alan, Grace.
    const lignes = construireCharge(new Map(), formateurs, 20);
    expect(lignes.map((l) => l.nom)).toEqual(["Ada Lovelace", "Alan Turing", "Grace Hopper"]);
  });

  it("ignore les prestations attribuées à un formateur hors roster", () => {
    const parFormateur = new Map<string, PlanningEvent[]>([
      [
        "t-inactif",
        [ev("z", "2026-07-09T07:00:00Z", "2026-07-09T15:00:00Z", "planifiee", "t-inactif")],
      ],
    ]);
    const lignes = construireCharge(parFormateur, formateurs, 20);
    // Aucun des 3 formateurs du roster n'a de prestation.
    expect(lignes.every((l) => l.joursMobilises === 0)).toBe(true);
  });

  it("capacité 0 → tous à 0 % même s'ils sont mobilisés", () => {
    const parFormateur = new Map<string, PlanningEvent[]>([
      ["t1", [ev("a", "2026-07-09T07:00:00Z", "2026-07-09T15:00:00Z", "planifiee", "t1")]],
    ]);
    const lignes = construireCharge(parFormateur, formateurs, 0);
    expect(lignes.find((l) => l.trainerId === "t1")?.tauxPct).toBe(0);
  });

  it("surcharge > 100 % remonte en tête et reste visible", () => {
    const parFormateur = new Map<string, PlanningEvent[]>([
      // 3 jours pour une capacité de 2 → 150 %.
      ["t1", [ev("a", "2026-07-08T07:00:00Z", "2026-07-10T15:00:00Z", "planifiee", "t1")]],
    ]);
    const lignes = construireCharge(parFormateur, formateurs, 2);
    expect(lignes[0]?.trainerId).toBe("t1");
    expect(lignes[0]?.tauxPct).toBe(150);
  });
});

describe("joursMobilises — bornage au mois (filtreJour)", () => {
  /** Une formation du 30 juillet au 2 août : 4 jours réels, 2 dans juillet. */
  function formationACheval(): PlanningEvent {
    return {
      key: "formation:cheval",
      type: "formation",
      id: "cheval",
      titre: "À cheval",
      debut: new Date("2026-07-30T07:00:00Z"),
      fin: new Date("2026-08-02T15:00:00Z"),
      statut: "planifiee",
      formateurNom: "Ada Lovelace",
      formateurId: "t1",
      clientNom: null,
      lieu: null,
    };
  }

  it("sans filtre : compte les 4 jours réels", () => {
    expect(joursMobilises([formationACheval()])).toBe(4);
  });

  it("filtré sur juillet : ne compte que les 2 jours de juillet", () => {
    const n = joursMobilises([formationACheval()], (k) => k.startsWith("2026-07"));
    expect(n).toBe(2);
  });

  it("filtré sur août : ne compte que les 2 jours d'août", () => {
    const n = joursMobilises([formationACheval()], (k) => k.startsWith("2026-08"));
    expect(n).toBe(2);
  });

  it("filtré sur un mois sans aucun jour : 0", () => {
    expect(joursMobilises([formationACheval()], (k) => k.startsWith("2026-09"))).toBe(0);
  });

  it("construireCharge propage le filtre", () => {
    const parFormateur = new Map([["t1", [formationACheval()]]]);
    const [ligne] = construireCharge(
      parFormateur,
      [{ id: "t1", prenom: "Ada", nom: "Lovelace" }],
      20,
      (k) => k.startsWith("2026-07"),
    );
    expect(ligne?.joursMobilises).toBe(2);
  });
});
