/**
 * 🔴 `DIST-01` — la présence était réduite à un seul jour, et tout le monde
 * ressortait à 100 %.
 *
 * Les trois parseurs réduisaient un participant à `joinAt` = min, `leaveAt` =
 * max, `dureeMinutes` = somme. Sur un export couvrant plusieurs journées, cette
 * réduction détruit l'information décisive : QUEL JOUR la personne était là.
 *
 * L'import ne créait donc de créneaux que pour la journée de la première
 * connexion. Un stagiaire venu **1 jour sur 2** ressortait à **100 %** — le
 * dénominateur ne couvrait que le jour où il était présent. Attestation
 * complète, et OPCO facturé sur une assiduité qui n'a pas eu lieu.
 */

import { describe, it, expect } from "vitest";
import { ventilerParJour, agregerVentilation } from "./ventilation-jour";

/** 10 juin 2026, heure de Paris (UTC+2 en été). */
const j1 = (h: number, m = 0) => new Date(Date.UTC(2026, 5, 10, h - 2, m));
/** 11 juin 2026, heure de Paris. */
const j2 = (h: number, m = 0) => new Date(Date.UTC(2026, 5, 11, h - 2, m));

describe("🔴 ventilerParJour — la journée redevient visible", () => {
  it("🔴 sépare DEUX journées au lieu de les fondre", () => {
    // LE défaut. Fondues, ces deux journées donnaient un seul créneau et un
    // dénominateur amputé de moitié.
    const { jours } = ventilerParJour([
      { join: j1(9), leave: j1(12, 30), duree: 210 },
      { join: j2(9), leave: j2(12, 30), duree: 210 },
    ]);

    expect(jours).toHaveLength(2);
    expect(jours.map((j) => j.date)).toEqual(["2026-06-10", "2026-06-11"]);
    expect(jours.map((j) => j.dureeMinutes)).toEqual([210, 210]);
  });

  it("somme plusieurs connexions d'une MÊME journée", () => {
    // Une coupure réseau produit deux lignes pour le même jour : c'est un seul
    // créneau, avec les deux durées.
    const { jours } = ventilerParJour([
      { join: j1(9), leave: j1(10, 30), duree: 90 },
      { join: j1(11), leave: j1(12, 30), duree: 90 },
    ]);

    expect(jours).toHaveLength(1);
    expect(jours[0]?.dureeMinutes).toBe(180);
    expect(jours[0]?.joinAt).toEqual(j1(9));
    expect(jours[0]?.leaveAt).toEqual(j1(12, 30));
  });

  it("🔴 la journée est celle de PARIS, pas d'UTC", () => {
    // Une connexion à 00 h 30 heure de Paris appartient au 11 juin pour le
    // stagiaire, au 10 juin pour UTC. Dater en UTC rattacherait le relevé à une
    // journée que la session n'a pas planifiée — donc au jour de repli, et les
    // minutes iraient au mauvais jour.
    const minuitTrenteParis = new Date(Date.UTC(2026, 5, 10, 22, 30));
    const { jours } = ventilerParJour([
      { join: minuitTrenteParis, leave: minuitTrenteParis, duree: 60 },
    ]);

    expect(jours[0]?.date, "la date a été calculée en UTC").toBe("2026-06-11");
  });

  it("rattache une séance qui déborde après minuit au jour où elle a COMMENCÉ", () => {
    // C'est le jour que la session a planifié, et celui que le stagiaire
    // reconnaîtra sur son attestation.
    const { jours } = ventilerParJour([
      { join: j1(22), leave: new Date(Date.UTC(2026, 5, 10, 23, 30)), duree: 150 },
    ]);
    expect(jours).toHaveLength(1);
    expect(jours[0]?.date).toBe("2026-06-10");
  });

  it("🔴 un intervalle SANS horodatage n'est pas rattaché au premier jour", () => {
    // Lui inventer une journée gonflerait un jour au détriment d'un autre — et
    // le TOTAL resterait juste, ce qui rendrait l'erreur invisible. On préfère
    // perdre la ventilation d'un intervalle que la fausser.
    const { jours, totalOrphelin } = ventilerParJour([
      { join: j1(9), leave: j1(12), duree: 180 },
      { join: null, leave: null, duree: 45 },
    ]);

    expect(jours).toHaveLength(1);
    expect(jours[0]?.dureeMinutes, "l'orphelin a été versé sur le premier jour").toBe(180);
    expect(totalOrphelin).toBe(45);
  });

  it("trie par date — deux imports du même fichier doivent être comparables", () => {
    const { jours } = ventilerParJour([
      { join: j2(9), leave: j2(12), duree: 180 },
      { join: j1(9), leave: j1(12), duree: 180 },
    ]);
    expect(jours.map((j) => j.date)).toEqual(["2026-06-10", "2026-06-11"]);
  });

  it("aucun intervalle → aucune journée", () => {
    expect(ventilerParJour([]).jours).toEqual([]);
  });
});

describe("agregerVentilation — les trois champs historiques", () => {
  it("rend min(join), max(leave) et la somme des durées", () => {
    const { jours, totalOrphelin } = ventilerParJour([
      { join: j1(9), leave: j1(12, 30), duree: 210 },
      { join: j2(14), leave: j2(17), duree: 180 },
    ]);
    const agg = agregerVentilation(jours, totalOrphelin);

    expect(agg.joinAt).toEqual(j1(9));
    expect(agg.leaveAt).toEqual(j2(17));
    expect(agg.dureeMinutes).toBe(390);
  });

  it("🔴 le total inclut les orphelins — sinon des minutes disparaîtraient", () => {
    // La ventilation peut écarter un intervalle ; le TOTAL, lui, ne doit rien
    // perdre : c'est lui qui alimentait l'ancien champ, et une régression du
    // total serait une sous-évaluation silencieuse de la présence.
    const { jours, totalOrphelin } = ventilerParJour([
      { join: j1(9), leave: j1(12), duree: 180 },
      { join: null, leave: null, duree: 45 },
    ]);
    expect(agregerVentilation(jours, totalOrphelin).dureeMinutes).toBe(225);
  });

  it("rend des valeurs nulles sur une ventilation vide, jamais une date inventée", () => {
    expect(agregerVentilation([], 0)).toEqual({
      joinAt: null,
      leaveAt: null,
      dureeMinutes: 0,
    });
  });
});
