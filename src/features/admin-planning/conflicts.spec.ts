/**
 * Tests — conflicts.ts (détection des conflits de formateur).
 *
 * Un conflit empêche l'exécution : deux prestations qui se chevauchent pour le
 * même formateur. Rien n'empêchait cela jusqu'ici.
 */

import { describe, it, expect } from "vitest";
import { eventsOverlap, findConflicts, mobiliseLeFormateur } from "./conflicts";
import type { PlanningEvent, PlanningStatut } from "./types";

function ev(
  key: string,
  debut: string,
  fin: string | null,
  statut: PlanningStatut = "planifiee",
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
    clientNom: null,
    lieu: null,
  };
}

describe("mobiliseLeFormateur", () => {
  it("vrai pour planifiée / en cours / réalisée", () => {
    expect(mobiliseLeFormateur({ statut: "planifiee" })).toBe(true);
    expect(mobiliseLeFormateur({ statut: "en_cours" })).toBe(true);
    expect(mobiliseLeFormateur({ statut: "realisee" })).toBe(true);
  });

  it("faux pour annulée / reportée", () => {
    expect(mobiliseLeFormateur({ statut: "annulee" })).toBe(false);
    expect(mobiliseLeFormateur({ statut: "reportee" })).toBe(false);
  });
});

describe("eventsOverlap — deux créneaux horodatés", () => {
  const matin = { debut: new Date("2026-07-09T07:00:00Z"), fin: new Date("2026-07-09T11:00:00Z") };

  it("chevauchement partiel", () => {
    const a = { debut: new Date("2026-07-09T10:00:00Z"), fin: new Date("2026-07-09T14:00:00Z") };
    expect(eventsOverlap(matin, a)).toBe(true);
    expect(eventsOverlap(a, matin)).toBe(true); // symétrique
  });

  it("inclusion totale", () => {
    const a = { debut: new Date("2026-07-09T08:00:00Z"), fin: new Date("2026-07-09T09:00:00Z") };
    expect(eventsOverlap(matin, a)).toBe(true);
  });

  it("créneaux jointifs (fin = début) → PAS de conflit", () => {
    const apresMidi = {
      debut: new Date("2026-07-09T11:00:00Z"),
      fin: new Date("2026-07-09T15:00:00Z"),
    };
    expect(eventsOverlap(matin, apresMidi)).toBe(false);
  });

  it("créneaux disjoints → pas de conflit", () => {
    const demain = {
      debut: new Date("2026-07-10T07:00:00Z"),
      fin: new Date("2026-07-10T11:00:00Z"),
    };
    expect(eventsOverlap(matin, demain)).toBe(false);
  });

  it("une formation multi-jours chevauche un créneau interne", () => {
    const multi = {
      debut: new Date("2026-07-08T07:00:00Z"),
      fin: new Date("2026-07-10T15:00:00Z"),
    };
    expect(eventsOverlap(multi, matin)).toBe(true);
  });
});

describe("eventsOverlap — au moins un « journée entière »", () => {
  const journee = { debut: new Date("2026-07-08T22:00:00Z"), fin: null }; // 09/07 00:00 Paris

  it("même jour qu'un créneau horodaté → conflit", () => {
    const creneau = {
      debut: new Date("2026-07-09T07:00:00Z"),
      fin: new Date("2026-07-09T11:00:00Z"),
    };
    expect(eventsOverlap(journee, creneau)).toBe(true);
  });

  it("jour différent → pas de conflit", () => {
    const creneau = {
      debut: new Date("2026-07-10T07:00:00Z"),
      fin: new Date("2026-07-10T11:00:00Z"),
    };
    expect(eventsOverlap(journee, creneau)).toBe(false);
  });

  it("deux journées entières le même jour → conflit", () => {
    expect(eventsOverlap(journee, { debut: new Date("2026-07-09T05:00:00Z"), fin: null })).toBe(
      true,
    );
  });

  it("une formation multi-jours englobe une journée entière", () => {
    const multi = {
      debut: new Date("2026-07-08T07:00:00Z"),
      fin: new Date("2026-07-10T15:00:00Z"),
    };
    expect(eventsOverlap(multi, journee)).toBe(true);
  });
});

describe("findConflicts", () => {
  const cible = ev("cible", "2026-07-09T07:00:00Z", "2026-07-09T15:00:00Z");

  it("aucun candidat → aucun conflit", () => {
    expect(findConflicts(cible, [])).toEqual([]);
  });

  it("s'exclut elle-même", () => {
    expect(findConflicts(cible, [cible])).toEqual([]);
  });

  it("ignore les prestations annulées ou reportées", () => {
    const annulee = ev("a", "2026-07-09T08:00:00Z", "2026-07-09T10:00:00Z", "annulee");
    const reportee = ev("r", "2026-07-09T08:00:00Z", "2026-07-09T10:00:00Z", "reportee");
    expect(findConflicts(cible, [annulee, reportee])).toEqual([]);
  });

  it("une cible annulée n'est jamais en conflit", () => {
    const cibleAnnulee = ev("c", "2026-07-09T07:00:00Z", "2026-07-09T15:00:00Z", "annulee");
    const autre = ev("x", "2026-07-09T08:00:00Z", "2026-07-09T10:00:00Z");
    expect(findConflicts(cibleAnnulee, [autre])).toEqual([]);
  });

  it("remonte les conflits triés par début", () => {
    const tard = ev("tard", "2026-07-09T13:00:00Z", "2026-07-09T16:00:00Z");
    const tot = ev("tot", "2026-07-09T06:00:00Z", "2026-07-09T09:00:00Z");
    const hors = ev("hors", "2026-07-11T06:00:00Z", "2026-07-11T09:00:00Z");
    expect(findConflicts(cible, [tard, hors, tot]).map((e) => e.key)).toEqual(["tot", "tard"]);
  });
});
