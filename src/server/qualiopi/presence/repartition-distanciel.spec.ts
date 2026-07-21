/**
 * Tests — repartition-distanciel.ts
 *
 * L'enjeu est un taux de présence qui décide d'une attestation. Deux directions
 * d'erreur, et elles ne se valent pas : sous-évaluer refuse une attestation à un
 * stagiaire assidu, surévaluer en accorde une à tort — et c'est la seconde
 * qu'un contrôle de service fait sanctionne.
 */

import { describe, it, expect } from "vitest";
import {
  repartirMinutesConnexion,
  fenetreDemiJournee,
  minutesDepuisMinuit,
  type CreneauCible,
} from "./repartition-distanciel";

const H = minutesDepuisMinuit;

/** Journée type 09:00–17:00, découpée au pivot 13:00. */
function journeeType(dureeMatin = 210, dureeAprem = 210): CreneauCible[] {
  return [
    {
      demiJournee: "matin",
      dureePrevueMinutes: dureeMatin,
      debutMin: H("09:00"),
      finMin: H("13:00"),
    },
    {
      demiJournee: "apres_midi",
      dureePrevueMinutes: dureeAprem,
      debutMin: H("13:00"),
      finMin: H("17:00"),
    },
  ];
}

describe("fenetreDemiJournee", () => {
  it("découpe une journée pleine au pivot", () => {
    expect(fenetreDemiJournee("09:00", "17:00", "matin")).toEqual({
      debutMin: H("09:00"),
      finMin: H("13:00"),
    });
    expect(fenetreDemiJournee("09:00", "17:00", "apres_midi")).toEqual({
      debutMin: H("13:00"),
      finMin: H("17:00"),
    });
  });

  it("une matinée seule garde sa propre fin, pas le pivot", () => {
    expect(fenetreDemiJournee("09:00", "12:30", "matin")).toEqual({
      debutMin: H("09:00"),
      finMin: H("12:30"),
    });
  });

  it("une après-midi seule garde son propre début", () => {
    expect(fenetreDemiJournee("14:00", "17:30", "apres_midi")).toEqual({
      debutMin: H("14:00"),
      finMin: H("17:30"),
    });
  });
});

describe("repartirMinutesConnexion", () => {
  it("une journée complète se répartit sur les deux demi-journées", () => {
    const parts = repartirMinutesConnexion({
      creneaux: journeeType(),
      dureeMinutes: 420,
      joinMin: H("09:00"),
      leaveMin: H("17:00"),
    });
    expect(parts).toEqual([210, 210]);
    expect(parts.reduce((s, p) => s + p, 0)).toBe(420);
  });

  it("⭐ une connexion du MATIN seul ne crédite RIEN l'après-midi", () => {
    // Le défaut qu'un prorata naïf sur les durées prévues aurait produit :
    // créditer la moitié d'une après-midi que le stagiaire n'a pas suivie.
    const parts = repartirMinutesConnexion({
      creneaux: journeeType(),
      dureeMinutes: 210,
      joinMin: H("09:00"),
      leaveMin: H("12:30"),
    });
    expect(parts[1]).toBe(0);
    expect(parts[0]).toBe(210);
  });

  it("une connexion de l'APRÈS-MIDI seule ne crédite rien le matin", () => {
    const parts = repartirMinutesConnexion({
      creneaux: journeeType(),
      dureeMinutes: 200,
      joinMin: H("13:30"),
      leaveMin: H("17:00"),
    });
    expect(parts[0]).toBe(0);
    expect(parts[1]).toBe(200);
  });

  it("PLAFONNE au prévu — un relevé couvrant 2 jours ne donne pas 200 %", () => {
    // Les parseurs agrègent un participant sur toute la plage du fichier.
    const parts = repartirMinutesConnexion({
      creneaux: journeeType(),
      dureeMinutes: 840,
      joinMin: H("09:00"),
      leaveMin: H("17:00"),
    });
    expect(parts).toEqual([210, 210]);
  });

  it("une absence totale donne zéro partout, jamais une valeur par défaut", () => {
    expect(
      repartirMinutesConnexion({
        creneaux: journeeType(),
        dureeMinutes: 0,
        joinMin: null,
        leaveMin: null,
      }),
    ).toEqual([0, 0]);
  });

  it("sans horodatage exploitable, répartit au prorata du prévu", () => {
    // Certains exports ne donnent qu'une durée. Mieux vaut répartir que de tout
    // attribuer au matin ou de tout perdre.
    const parts = repartirMinutesConnexion({
      creneaux: journeeType(),
      dureeMinutes: 300,
      joinMin: null,
      leaveMin: null,
    });
    expect(parts.reduce((s, p) => s + p, 0)).toBe(300);
    expect(parts[0]).toBe(150);
  });

  it("une connexion HORS des horaires déclarés n'efface pas la présence", () => {
    // Décalage de fuseau dans le CSV, réunion ouverte en avance : on ne peut pas
    // conclure que le stagiaire était absent alors qu'il a des minutes au relevé.
    const parts = repartirMinutesConnexion({
      creneaux: journeeType(),
      dureeMinutes: 120,
      joinMin: H("19:00"),
      leaveMin: H("21:00"),
    });
    expect(parts.reduce((s, p) => s + p, 0)).toBe(120);
  });

  it("respecte des demi-journées de durées INÉGALES", () => {
    // Journée 09:00–17:00 dont le matin vaut 4 h et l'après-midi 3 h.
    const creneaux: CreneauCible[] = [
      { demiJournee: "matin", dureePrevueMinutes: 240, debutMin: H("09:00"), finMin: H("13:00") },
      {
        demiJournee: "apres_midi",
        dureePrevueMinutes: 180,
        debutMin: H("13:00"),
        finMin: H("16:00"),
      },
    ];
    const parts = repartirMinutesConnexion({
      creneaux,
      dureeMinutes: 420,
      joinMin: H("09:00"),
      leaveMin: H("16:00"),
    });
    expect(parts).toEqual([240, 180]);
  });

  it("une journée à UNE seule demi-journée reçoit tout, plafonné", () => {
    const creneaux: CreneauCible[] = [
      { demiJournee: "matin", dureePrevueMinutes: 210, debutMin: H("09:00"), finMin: H("12:30") },
    ];
    expect(
      repartirMinutesConnexion({ creneaux, dureeMinutes: 500, joinMin: null, leaveMin: null }),
    ).toEqual([210]);
    expect(
      repartirMinutesConnexion({ creneaux, dureeMinutes: 120, joinMin: null, leaveMin: null }),
    ).toEqual([120]);
  });

  it("ne produit jamais de minutes négatives", () => {
    const parts = repartirMinutesConnexion({
      creneaux: journeeType(),
      dureeMinutes: -50,
      joinMin: H("09:00"),
      leaveMin: H("17:00"),
    });
    expect(parts.every((p) => p >= 0)).toBe(true);
  });

  it("conserve le total quand aucun plafond ne mord (arrondis compris)", () => {
    for (const duree of [1, 7, 61, 123, 299, 401]) {
      const parts = repartirMinutesConnexion({
        creneaux: journeeType(500, 500),
        dureeMinutes: duree,
        joinMin: H("09:00"),
        leaveMin: H("17:00"),
      });
      expect(parts.reduce((s, p) => s + p, 0)).toBe(duree);
    }
  });
});
