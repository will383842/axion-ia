/**
 * Tests — jours-defaut.ts
 *
 * Les durées testées ne sont pas inventées : ce sont celles du catalogue réel,
 * relevées sur le code — 7 h (40 formations), 14 h (22), 4 h (7), 3 h (6),
 * 21 h (4). Un module de génération par défaut qui se trompe sur le cas dominant
 * ne sert à rien.
 */

import { describe, it, expect } from "vitest";
import {
  genererJoursParDefaut,
  horairesProposes,
  repartirHeuresEnJournees,
  HEURES_JOURNEE_PLEINE,
  MAX_JOURS_GENERES,
} from "./jours-defaut";

describe("horairesProposes", () => {
  it.each([
    [7, "09:00", "17:00"], // journée pleine : 7 h de formation + 1 h de pause
    [4, "09:00", "13:00"], // demi-journée : pas de pause à compter
    [3, "09:00", "12:00"],
    [6, "09:00", "16:00"],
    [8, "09:00", "18:00"],
    [1, "09:00", "10:00"],
  ])("%s h → %s–%s", (heures, debut, fin) => {
    expect(horairesProposes(heures)).toEqual({ heureDebut: debut, heureFin: fin });
  });

  it("produit toujours un HH:MM valide et une fin après le début", () => {
    // Miroir du CHECK `ck_session_jour_horaires` : une proposition qui ne
    // passerait pas la contrainte ferait échouer la création de session.
    for (const h of [0.5, 1, 2, 3, 3.5, 4, 5, 6, 7, 8, 10, 12]) {
      const { heureDebut, heureFin } = horairesProposes(h);
      expect(heureDebut).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(heureFin).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(heureFin > heureDebut).toBe(true);
    }
  });
});

describe("repartirHeuresEnJournees", () => {
  it.each([
    [3, [3]],
    [4, [4]],
    [7, [7]],
    [14, [7, 7]],
    [21, [7, 7, 7]],
    [10, [7, 3]],
    [8, [7, 1]],
  ])("%s h → %j", (duree, attendu) => {
    expect(repartirHeuresEnJournees(duree)).toEqual(attendu);
  });

  it("conserve la durée totale", () => {
    for (const d of [3, 4, 7, 8, 10, 14, 21, 35]) {
      expect(repartirHeuresEnJournees(d).reduce((s, h) => s + h, 0)).toBeCloseTo(d, 2);
    }
  });

  it("met le reliquat en DERNIÈRE journée, jamais au milieu", () => {
    expect(repartirHeuresEnJournees(17)).toEqual([7, 7, 3]);
  });

  it("respecte un `heuresParJour` personnalisé", () => {
    expect(repartirHeuresEnJournees(12, 6)).toEqual([6, 6]);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    "retourne [] pour une durée absurde (%s)",
    (d) => {
      expect(repartirHeuresEnJournees(d)).toEqual([]);
    },
  );

  it("ne boucle pas indéfiniment sur une durée démesurée", () => {
    expect(repartirHeuresEnJournees(100_000).length).toBe(MAX_JOURS_GENERES);
  });
});

describe("genererJoursParDefaut", () => {
  it("7 h → une seule journée 09:00–17:00 (le cas dominant du catalogue)", () => {
    expect(genererJoursParDefaut({ dateDebutIso: "2026-06-10", dureeHeures: 7 })).toEqual([
      { date: "2026-06-10", heureDebut: "09:00", heureFin: "17:00" },
    ]);
  });

  it("4 h → une demi-journée, et donc UN seul créneau plus tard", () => {
    expect(genererJoursParDefaut({ dateDebutIso: "2026-06-10", dureeHeures: 4 })).toEqual([
      { date: "2026-06-10", heureDebut: "09:00", heureFin: "13:00" },
    ]);
  });

  it("14 h → DEUX journées — c'est le bug que la récurrence produisait", () => {
    // `sessions-recurrentes.ts` posait `dateFin = dateDebut + 14 h`, soit le même
    // jour civil à 23:00 : une formation de 2 jours enregistrée sur un seul.
    const jours = genererJoursParDefaut({ dateDebutIso: "2026-06-10", dureeHeures: 14 });
    expect(jours).toHaveLength(2);
    expect(jours.map((j) => j.date)).toEqual(["2026-06-10", "2026-06-11"]);
  });

  it("21 h → trois journées", () => {
    expect(genererJoursParDefaut({ dateDebutIso: "2026-06-10", dureeHeures: 21 })).toHaveLength(3);
  });

  it("SAUTE les week-ends — vendredi + lundi, pas vendredi + samedi", () => {
    // 2026-06-12 est un vendredi.
    const jours = genererJoursParDefaut({ dateDebutIso: "2026-06-12", dureeHeures: 14 });
    expect(jours.map((j) => j.date)).toEqual(["2026-06-12", "2026-06-15"]);
  });

  // 🔴 CE TEST VERROUILLAIT UN DÉFAUT — retourné le 16/08/2026.
  //
  // Il s'appelait « décale un début tombant un samedi » et exigeait que la date
  // SAISIE par l'admin soit remplacée par une autre. Constaté sur le premier
  // dossier réel : session du dimanche 16/08/2026 (AXI-SESS-2026-005), journée
  // proposée le lundi 17/08. Confirmée telle quelle, la feuille d'émargement
  // aurait porté une date contredisant la convention — deux pièces du même
  // dossier en désaccord, sur exactement ce que l'émargement sert à prouver
  // (indicateurs 9 et 11).
  //
  // 🔑 La distinction est de NATURE, pas de commodité : les journées suivantes
  // sont DÉDUITES, la première est SAISIE. Le saut de week-end reste juste pour
  // les premières, faux pour la seconde.
  it("🔴 NE déplace PAS un début saisi un samedi — c'est une date, pas une déduction", () => {
    // 2026-06-13 est un samedi.
    const jours = genererJoursParDefaut({ dateDebutIso: "2026-06-13", dureeHeures: 7 });
    expect(jours[0]?.date, "la date saisie par l'admin a été remplacée").toBe("2026-06-13");
  });

  it("🔴 ni un début saisi un dimanche — le cas réel AXI-SESS-2026-005", () => {
    // 2026-08-16 est un dimanche. C'est LE cas qui a révélé le défaut.
    const jours = genererJoursParDefaut({ dateDebutIso: "2026-08-16", dureeHeures: 7 });
    expect(jours[0]?.date).toBe("2026-08-16");
  });

  it("mais saute bien le week-end pour les journées SUIVANTES, y compris depuis un samedi", () => {
    // Samedi 2026-06-13, 14 h : le samedi est gardé (saisi), le dimanche sauté
    // (déduit) → lundi.
    const jours = genererJoursParDefaut({ dateDebutIso: "2026-06-13", dureeHeures: 14 });
    expect(jours.map((j) => j.date)).toEqual(["2026-06-13", "2026-06-15"]);
  });

  it("10 h → une journée pleine puis une demi-journée de 3 h", () => {
    const jours = genererJoursParDefaut({ dateDebutIso: "2026-06-10", dureeHeures: 10 });
    expect(jours).toEqual([
      { date: "2026-06-10", heureDebut: "09:00", heureFin: "17:00" },
      { date: "2026-06-11", heureDebut: "09:00", heureFin: "12:00" },
    ]);
  });

  it("retourne [] sur une durée absente ou nulle plutôt que d'inventer un jour", () => {
    expect(genererJoursParDefaut({ dateDebutIso: "2026-06-10", dureeHeures: 0 })).toEqual([]);
  });

  it("les dates générées sont strictement croissantes et uniques", () => {
    const jours = genererJoursParDefaut({ dateDebutIso: "2026-06-10", dureeHeures: 35 });
    const dates = jours.map((j) => j.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort()).toEqual(dates);
  });

  it("la durée par défaut d'une journée pleine est bien celle annoncée", () => {
    expect(HEURES_JOURNEE_PLEINE).toBe(7);
  });
});
