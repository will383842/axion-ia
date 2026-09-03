/**
 * Croisement session × indisponibilités du formateur (2026-09-03).
 *
 * `joursEnConflit` existait sans appelant : ces tests verrouillent le module
 * qui l'appelle enfin, sur les cas qui ont motivé le chantier — une session
 * vendue sur les congés du formateur.
 */

import { describe, it, expect } from "vitest";

import {
  conflitIndisponibilite,
  formulerConflit,
  joursDeSession,
} from "./conflits-indisponibilite";
import type { Indisponibilite } from "./availability";

const conge = (debut: string, fin: string): Indisponibilite => ({
  trainerId: "t1",
  type: "conge",
  debut,
  fin,
});

describe("joursDeSession", () => {
  it("couvre tout l'intervalle quand aucune journée n'est saisie", () => {
    const jours = joursDeSession({
      dateDebut: new Date("2026-09-14T08:00:00Z"),
      dateFin: new Date("2026-09-16T16:00:00Z"),
    });
    expect(jours).toEqual(["2026-09-14", "2026-09-15", "2026-09-16"]);
  });

  it("préfère les journées saisies — c'est la vérité la plus fine", () => {
    const jours = joursDeSession({
      dateDebut: new Date("2026-09-14T08:00:00Z"),
      dateFin: new Date("2026-09-25T16:00:00Z"),
      jours: [
        { date: new Date("2026-09-14T00:00:00Z") },
        { date: new Date("2026-09-21T00:00:00Z") },
      ],
    });
    expect(jours).toEqual(["2026-09-14", "2026-09-21"]);
  });

  it("une session sans dateFin occupe son seul jour de début", () => {
    expect(joursDeSession({ dateDebut: new Date("2026-09-14T08:00:00Z"), dateFin: null })).toEqual([
      "2026-09-14",
    ]);
  });
});

describe("conflitIndisponibilite", () => {
  const session = {
    dateDebut: new Date("2026-09-14T08:00:00Z"),
    dateFin: new Date("2026-09-16T16:00:00Z"),
  };

  it("rend null sans indisponibilité", () => {
    expect(conflitIndisponibilite(session, [])).toBeNull();
  });

  it("rend null quand les congés sont AILLEURS", () => {
    expect(conflitIndisponibilite(session, [conge("2026-09-17", "2026-09-20")])).toBeNull();
  });

  it("dit les jours qui se croisent, triés, et le type", () => {
    const c = conflitIndisponibilite(session, [conge("2026-09-15", "2026-09-30")]);
    expect(c).toEqual({ jours: ["2026-09-15", "2026-09-16"], types: ["Congés"] });
  });

  it("dédoublonne les types quand deux indisponibilités du même genre se chevauchent", () => {
    const c = conflitIndisponibilite(session, [
      conge("2026-09-14", "2026-09-14"),
      conge("2026-09-16", "2026-09-16"),
    ]);
    expect(c?.types).toEqual(["Congés"]);
    expect(c?.jours).toEqual(["2026-09-14", "2026-09-16"]);
  });
});

describe("formulerConflit", () => {
  it("écrit une phrase lisible, jours au format JJ/MM", () => {
    expect(formulerConflit({ jours: ["2026-09-15", "2026-09-16"], types: ["Congés"] })).toBe(
      "2 jours (Congés) : 15/09, 16/09",
    );
  });

  it("tronque au-delà de cinq jours sans mentir sur le compte", () => {
    const jours = ["01", "02", "03", "04", "05", "06", "07"].map((j) => `2026-09-${j}`);
    const phrase = formulerConflit({ jours, types: ["Maladie"] });
    expect(phrase.startsWith("7 jours (Maladie) : 01/09, 02/09, 03/09, 04/09, 05/09…")).toBe(true);
  });
});
