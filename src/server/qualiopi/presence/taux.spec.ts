/**
 * Tests — taux.ts
 *
 * Vérifie :
 *   - computeTauxPresence : cas normaux, zéro prévu, arrondi
 *   - classifierPresence : seuils 80 (défaut), 60, et seuil custom
 */

import { describe, it, expect } from "vitest";
import { computeTauxPresence, classifierPresence } from "./taux";

describe("computeTauxPresence", () => {
  it("100 % présence → tauxPct=100", () => {
    const result = computeTauxPresence([
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 210 },
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 210 },
    ]);
    expect(result.tauxPct).toBe(100);
    expect(result.minutesPrevues).toBe(420);
    expect(result.minutesRealisees).toBe(420);
  });

  it("0 % présence → tauxPct=0", () => {
    const result = computeTauxPresence([
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 0 },
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 0 },
    ]);
    expect(result.tauxPct).toBe(0);
  });

  it("présence partielle → arrondi correct", () => {
    // 315/420 = 75 %
    const result = computeTauxPresence([
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 210 },
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 105 },
    ]);
    expect(result.tauxPct).toBe(75);
  });

  it("arrondi au plus proche : 2/3 = 66.66 → 67", () => {
    const result = computeTauxPresence([{ dureePrevueMinutes: 300, dureeRealiseeMinutes: 200 }]);
    expect(result.tauxPct).toBe(67);
  });

  it("aucune durée prévue (liste vide) → tauxPct=0", () => {
    const result = computeTauxPresence([]);
    expect(result.tauxPct).toBe(0);
    expect(result.minutesPrevues).toBe(0);
    expect(result.minutesRealisees).toBe(0);
  });

  it("aucune durée prévue (zéro) → tauxPct=0", () => {
    const result = computeTauxPresence([{ dureePrevueMinutes: 0, dureeRealiseeMinutes: 0 }]);
    expect(result.tauxPct).toBe(0);
  });

  it("somme plusieurs créneaux correcte", () => {
    const result = computeTauxPresence([
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 210 },
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 168 },
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 0 },
    ]);
    // (210+168+0)/(210+210+210) = 378/630 = 60 %
    expect(result.tauxPct).toBe(60);
    expect(result.minutesPrevues).toBe(630);
    expect(result.minutesRealisees).toBe(378);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Collision de granularité `journee` vs demi-journées (session hybride)
//
// Le dénominateur est ce qui décide de l'attestation : doublé, il plafonne le
// taux à ~50 % et fait délivrer une attestation « partielle » à un stagiaire
// assidu. Ces tests portent sur `minutesPrevues`, pas seulement sur `tauxPct`.
// ─────────────────────────────────────────────────────────────────────────────

describe("computeTauxPresence — dédoublonnage journée / demi-journées", () => {
  const J1 = new Date("2026-06-10T00:00:00.000Z");
  const J2 = new Date("2026-06-11T00:00:00.000Z");

  it("ne compte PAS deux fois un jour porté à la fois en journée et en demi-journées", () => {
    // Créneaux présentiels générés, puis import distanciel du même jour.
    const result = computeTauxPresence([
      { date: J1, demiJournee: "matin", dureePrevueMinutes: 210, dureeRealiseeMinutes: 0 },
      { date: J1, demiJournee: "apres_midi", dureePrevueMinutes: 210, dureeRealiseeMinutes: 0 },
      { date: J1, demiJournee: "journee", dureePrevueMinutes: 420, dureeRealiseeMinutes: 400 },
    ]);
    // Sans dédoublonnage : 400/840 = 48 % → attestation « aucune » à tort.
    expect(result.minutesPrevues).toBe(420);
    expect(result.minutesRealisees).toBe(400);
    expect(result.tauxPct).toBe(95);
  });

  it("reste correct si l'admin régénère les créneaux APRÈS l'import", () => {
    // `generateSessionCreneauxAction` ignore les créneaux `journee` : il recrée
    // matin + après-midi. Le taux ne doit pas retomber de moitié pour autant.
    const apresImport = computeTauxPresence([
      { date: J1, demiJournee: "journee", dureePrevueMinutes: 420, dureeRealiseeMinutes: 420 },
    ]);
    const apresRegeneration = computeTauxPresence([
      { date: J1, demiJournee: "journee", dureePrevueMinutes: 420, dureeRealiseeMinutes: 420 },
      { date: J1, demiJournee: "matin", dureePrevueMinutes: 210, dureeRealiseeMinutes: 0 },
      { date: J1, demiJournee: "apres_midi", dureePrevueMinutes: 210, dureeRealiseeMinutes: 0 },
    ]);
    expect(apresRegeneration.tauxPct).toBe(apresImport.tauxPct);
    expect(apresRegeneration.tauxPct).toBe(100);
  });

  it("préserve la présence présentielle d'un stagiaire absent du relevé distanciel", () => {
    // Inscrit non rapproché : l'import lui pose un créneau `journee` à 0 min
    // réalisé, mais son émargement présentiel du même jour reste la preuve.
    const result = computeTauxPresence([
      { date: J1, demiJournee: "matin", dureePrevueMinutes: 210, dureeRealiseeMinutes: 210 },
      { date: J1, demiJournee: "apres_midi", dureePrevueMinutes: 210, dureeRealiseeMinutes: 210 },
      { date: J1, demiJournee: "journee", dureePrevueMinutes: 420, dureeRealiseeMinutes: 0 },
    ]);
    expect(result.minutesPrevues).toBe(420);
    expect(result.minutesRealisees).toBe(420);
    expect(result.tauxPct).toBe(100);
  });

  it("dédoublonne jour par jour, sans mélanger les dates (session multi-jours)", () => {
    // J1 présentiel pur, J2 importé en distanciel par-dessus ses demi-journées.
    const result = computeTauxPresence([
      { date: J1, demiJournee: "matin", dureePrevueMinutes: 210, dureeRealiseeMinutes: 210 },
      { date: J1, demiJournee: "apres_midi", dureePrevueMinutes: 210, dureeRealiseeMinutes: 210 },
      { date: J2, demiJournee: "matin", dureePrevueMinutes: 210, dureeRealiseeMinutes: 0 },
      { date: J2, demiJournee: "apres_midi", dureePrevueMinutes: 210, dureeRealiseeMinutes: 0 },
      { date: J2, demiJournee: "journee", dureePrevueMinutes: 420, dureeRealiseeMinutes: 210 },
    ]);
    // 840 prévues (2 jours), pas 1 260. Réalisé : 420 (J1) + 210 (J2).
    expect(result.minutesPrevues).toBe(840);
    expect(result.minutesRealisees).toBe(630);
    expect(result.tauxPct).toBe(75);
  });

  it("accepte une date en chaîne ISO comme clé de jour", () => {
    const result = computeTauxPresence([
      {
        date: "2026-06-10",
        demiJournee: "matin",
        dureePrevueMinutes: 210,
        dureeRealiseeMinutes: 0,
      },
      {
        date: "2026-06-10",
        demiJournee: "journee",
        dureePrevueMinutes: 420,
        dureeRealiseeMinutes: 420,
      },
    ]);
    expect(result.minutesPrevues).toBe(420);
    expect(result.tauxPct).toBe(100);
  });

  it("VERROU — la journée réellement hybride est sous-évaluée, et c'est assumé", () => {
    // Matin présentiel émargé (210/210) + après-midi distanciel importé, qui pose
    // un créneau `journee` couvrant DÉJÀ la journée entière (420 prévues, 210
    // faites). La vérité métier est 100 % ; on retourne 50 %.
    //
    // Ce test EXISTE POUR ÉCHOUER si quelqu'un remplace le `max()` par une somme
    // partielle « plus intelligente ». Sous-évaluer est le sens sûr : c'est la
    // SURévaluation que sanctionne un contrôle de service fait. Corriger ce cas
    // suppose de représenter une journée hybride, ce que le modèle ne sait pas
    // faire — pas de bricoler l'agrégation.
    const result = computeTauxPresence([
      { date: J1, demiJournee: "matin", dureePrevueMinutes: 210, dureeRealiseeMinutes: 210 },
      { date: J1, demiJournee: "journee", dureePrevueMinutes: 420, dureeRealiseeMinutes: 210 },
    ]);
    expect(result.minutesPrevues).toBe(420);
    expect(result.minutesRealisees).toBe(210);
    expect(result.tauxPct).toBe(50);
  });

  it("somme normalement des demi-journées sans créneau `journee` concurrent", () => {
    // Non-régression : le cas présentiel pur ne doit rien changer.
    const result = computeTauxPresence([
      { date: J1, demiJournee: "matin", dureePrevueMinutes: 210, dureeRealiseeMinutes: 210 },
      { date: J1, demiJournee: "apres_midi", dureePrevueMinutes: 210, dureeRealiseeMinutes: 105 },
    ]);
    expect(result.minutesPrevues).toBe(420);
    expect(result.minutesRealisees).toBe(315);
    expect(result.tauxPct).toBe(75);
  });
});

describe("classifierPresence", () => {
  // ── Seuil défaut (80) ──
  it("80 % → 'complete' (≥ seuil défaut 80)", () => {
    expect(classifierPresence(80)).toBe("complete");
  });

  it("100 % → 'complete'", () => {
    expect(classifierPresence(100)).toBe("complete");
  });

  it("75 % → 'partielle' (60..79)", () => {
    expect(classifierPresence(75)).toBe("partielle");
  });

  it("60 % → 'partielle' (borne inférieure)", () => {
    expect(classifierPresence(60)).toBe("partielle");
  });

  it("59 % → 'aucune' (< 60)", () => {
    expect(classifierPresence(59)).toBe("aucune");
  });

  it("0 % → 'aucune'", () => {
    expect(classifierPresence(0)).toBe("aucune");
  });

  // ── Seuil custom ──
  it("seuil 90 : 89 % → 'partielle'", () => {
    expect(classifierPresence(89, 90)).toBe("partielle");
  });

  it("seuil 90 : 90 % → 'complete'", () => {
    expect(classifierPresence(90, 90)).toBe("complete");
  });

  it("seuil 70 : 70 % → 'complete'", () => {
    expect(classifierPresence(70, 70)).toBe("complete");
  });

  it("seuil 70 : 65 % → 'partielle'", () => {
    expect(classifierPresence(65, 70)).toBe("partielle");
  });
});
