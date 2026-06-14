/**
 * Tests — indicateurs-registre.ts (T12 — AGENT B).
 *
 * Module PUR : aucune dépendance I/O. Tests entièrement synchrones.
 */

import { describe, it, expect } from "vitest";
import {
  INDICATEURS_RNQ,
  indicateursApplicables,
  estSuperIndicateur,
} from "./indicateurs-registre";

// ─────────────────────────────────────────────────────────────────────────────
// INDICATEURS_RNQ — structure
// ─────────────────────────────────────────────────────────────────────────────

describe("INDICATEURS_RNQ", () => {
  it("contient exactement 32 indicateurs", () => {
    expect(INDICATEURS_RNQ).toHaveLength(32);
  });

  it("numérotation continue de 1 à 32 sans trou", () => {
    const nums = INDICATEURS_RNQ.map((i) => i.numero).sort((a, b) => a - b);
    for (let n = 1; n <= 32; n++) {
      expect(nums[n - 1]).toBe(n);
    }
  });

  it("chaque critère a le bon nombre d'indicateurs (3/5/8/4/2/7/3)", () => {
    const countByCritere = [0, 0, 0, 0, 0, 0, 0, 0];
    for (const ind of INDICATEURS_RNQ) {
      countByCritere[ind.critere]!++;
    }
    expect(countByCritere[1]).toBe(3); // C1
    expect(countByCritere[2]).toBe(5); // C2
    expect(countByCritere[3]).toBe(8); // C3
    expect(countByCritere[4]).toBe(4); // C4
    expect(countByCritere[5]).toBe(2); // C5
    expect(countByCritere[6]).toBe(7); // C6
    expect(countByCritere[7]).toBe(3); // C7
  });

  it("tous les critères sont dans [1..7]", () => {
    for (const ind of INDICATEURS_RNQ) {
      expect(ind.critere).toBeGreaterThanOrEqual(1);
      expect(ind.critere).toBeLessThanOrEqual(7);
    }
  });

  it("chaque indicateur a un libelleOfficiel non vide", () => {
    for (const ind of INDICATEURS_RNQ) {
      expect(ind.libelleOfficiel.trim().length).toBeGreaterThan(0);
    }
  });

  it("les super-indicateurs TC attendus sont marqués super=true", () => {
    const superNums = [1, 2, 4, 5, 9, 11, 12, 21, 23, 26, 27, 30, 31, 32];
    for (const num of superNums) {
      const ind = INDICATEURS_RNQ.find((i) => i.numero === num);
      expect(ind?.super, `off.${num} doit être super`).toBe(true);
    }
  });

  it("les conditionnels cert sont 3, 7, 16", () => {
    const certNums = INDICATEURS_RNQ.filter((i) => i.conditionnel === "cert").map((i) => i.numero);
    expect(certNums.sort((a, b) => a - b)).toEqual([3, 7, 16]);
  });

  it("les conditionnels app sont 13, 14, 15", () => {
    const appNums = INDICATEURS_RNQ.filter((i) => i.conditionnel === "app").map((i) => i.numero);
    expect(appNums.sort((a, b) => a - b)).toEqual([13, 14, 15]);
  });

  it("le conditionnel afest est 28", () => {
    const afestNums = INDICATEURS_RNQ.filter((i) => i.conditionnel === "afest").map(
      (i) => i.numero,
    );
    expect(afestNums).toEqual([28]);
  });

  // Vérification de quelques libellés exacts du verbatim canonique
  it("libellé off.1 exact", () => {
    const ind = INDICATEURS_RNQ.find((i) => i.numero === 1);
    expect(ind?.libelleOfficiel).toBe(
      "Information accessible, complète et vérifiable sur les prestations",
    );
  });

  it("libellé off.11 exact", () => {
    const ind = INDICATEURS_RNQ.find((i) => i.numero === 11);
    expect(ind?.libelleOfficiel).toBe("Évaluation de l'atteinte des objectifs");
  });

  it("libellé off.23 exact", () => {
    const ind = INDICATEURS_RNQ.find((i) => i.numero === 23);
    expect(ind?.libelleOfficiel).toBe("Veille légale et réglementaire");
  });

  it("libellé off.30 exact", () => {
    const ind = INDICATEURS_RNQ.find((i) => i.numero === 30);
    expect(ind?.libelleOfficiel).toBe("Recueil des appréciations des parties prenantes");
  });

  it("libellé off.31 exact", () => {
    const ind = INDICATEURS_RNQ.find((i) => i.numero === 31);
    expect(ind?.libelleOfficiel).toBe("Traitement des réclamations, difficultés et aléas");
  });

  it("libellé off.32 exact", () => {
    const ind = INDICATEURS_RNQ.find((i) => i.numero === 32);
    expect(ind?.libelleOfficiel).toBe("Mise en œuvre des mesures d'amélioration continue");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// indicateursApplicables
// ─────────────────────────────────────────────────────────────────────────────

describe("indicateursApplicables", () => {
  it("action classique → exclut les 6 conditionnels (3,7,13,14,15,16,28)", () => {
    const nums = indicateursApplicables(["classique"]);
    // Les conditionnels cert/app/afest ne doivent pas être présents
    expect(nums).not.toContain(3); // cert
    expect(nums).not.toContain(7); // cert
    expect(nums).not.toContain(13); // app
    expect(nums).not.toContain(14); // app
    expect(nums).not.toContain(15); // app
    expect(nums).not.toContain(16); // cert
    expect(nums).not.toContain(28); // afest
  });

  it("action classique → retourne 25 indicateurs tronc commun", () => {
    const nums = indicateursApplicables(["classique"]);
    // 32 - 7 conditionnels = 25
    expect(nums).toHaveLength(25);
  });

  it("action certifiante → inclut off.3, 7, 16", () => {
    const nums = indicateursApplicables(["classique", "certifiante"]);
    expect(nums).toContain(3);
    expect(nums).toContain(7);
    expect(nums).toContain(16);
  });

  it("action alternance_afest → inclut off.28 mais PAS off.13/14/15 (apprentissage)", () => {
    const nums = indicateursApplicables(["alternance_afest"]);
    // off.28 = AFEST (applicable) ; off.13/14/15 = apprentissage/CFA (jamais applicables).
    expect(nums).toContain(28);
    expect(nums).not.toContain(13);
    expect(nums).not.toContain(14);
    expect(nums).not.toContain(15);
  });

  it("retourne les numéros triés ascendants", () => {
    const nums = indicateursApplicables(["classique"]);
    const sorted = [...nums].sort((a, b) => a - b);
    expect(nums).toEqual(sorted);
  });

  it("tous types → 29 indicateurs (off.13/14/15 apprentissage jamais applicables)", () => {
    const nums = indicateursApplicables(["classique", "certifiante", "alternance_afest"]);
    // 32 indicateurs RNQ − off.13/14/15 (apprentissage/CFA hors périmètre) = 29.
    expect(nums).toHaveLength(29);
    expect(nums).not.toContain(13);
    expect(nums).toContain(28);
  });

  it("tableau vide (pas de type) → 0 applicables (tronc commun exige au moins 1 type)", () => {
    // Sans "classique", les TC sont quand même inclus car conditionnel===undefined
    const nums = indicateursApplicables([]);
    // Les TC (conditionnel=undefined) sont toujours inclus
    expect(nums).toContain(1);
    expect(nums).toContain(32);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// estSuperIndicateur
// ─────────────────────────────────────────────────────────────────────────────

describe("estSuperIndicateur", () => {
  it("off.1 est super (TC)", () => {
    expect(estSuperIndicateur(1, ["classique"])).toBe(true);
  });

  it("off.32 est super (TC)", () => {
    expect(estSuperIndicateur(32, ["classique"])).toBe(true);
  });

  it("off.6 n'est pas super (TC non-super)", () => {
    expect(estSuperIndicateur(6, ["classique"])).toBe(false);
  });

  it("off.7 devient super si certifiant", () => {
    expect(estSuperIndicateur(7, ["certifiante"])).toBe(true);
  });

  it("off.7 n'est PAS super si non certifiant", () => {
    expect(estSuperIndicateur(7, ["classique"])).toBe(false);
  });

  it("off.16 devient super si certifiant", () => {
    expect(estSuperIndicateur(16, ["certifiante"])).toBe(true);
  });

  it("off.16 n'est PAS super si non certifiant", () => {
    expect(estSuperIndicateur(16, ["classique"])).toBe(false);
  });

  it("indicateur inexistant retourne false", () => {
    expect(estSuperIndicateur(99, ["classique"])).toBe(false);
  });
});
