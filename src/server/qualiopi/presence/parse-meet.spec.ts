/**
 * Tests — parse-meet.ts
 *
 * Vérifie :
 *   - Parsing CSV Google Meet standard
 *   - Email normalisé
 *   - Durée en minutes
 *   - Participants sans email → email null
 *   - Robustesse BOM
 *   - CSV vide
 */

import { describe, it, expect } from "vitest";
import { parseMeetCsv } from "./parse-meet";

/** CSV Google Meet standard. */
const CSV_MEET_BASIQUE = `Name,Email,Duration,Time joined,Time exited
Alice Martin,alice.martin@example.com,210,2026-06-10T09:00:00Z,2026-06-10T12:30:00Z
Bob Dupont,bob.dupont@example.com,175,2026-06-10T09:05:00Z,2026-06-10T12:00:00Z
Claire Morel,claire.morel@example.com,210,2026-06-10T14:00:00Z,2026-06-10T17:30:00Z`;

/** CSV Meet avec BOM. */
const CSV_MEET_BOM = `﻿Name,Email,Duration,Time joined,Time exited
Test User,Test@Example.COM,60,2026-06-10T09:00:00Z,2026-06-10T10:00:00Z`;

/** CSV Meet sans colonne email. */
const CSV_MEET_SANS_EMAIL = `Name,Duration,Time joined,Time exited
Participant Anonyme,30,2026-06-10T09:00:00Z,2026-06-10T09:30:00Z`;

describe("parseMeetCsv", () => {
  describe("parsing basique", () => {
    it("retourne la bonne plateforme", () => {
      const result = parseMeetCsv(CSV_MEET_BASIQUE);
      expect(result.plateforme).toBe("meet");
    });

    it("retourne 3 participants", () => {
      const result = parseMeetCsv(CSV_MEET_BASIQUE);
      expect(result.participants).toHaveLength(3);
    });

    it("nbLignes = 3", () => {
      const result = parseMeetCsv(CSV_MEET_BASIQUE);
      expect(result.nbLignes).toBe(3);
    });

    it("premier participant : nom correct", () => {
      const result = parseMeetCsv(CSV_MEET_BASIQUE);
      expect(result.participants[0]?.nomBrut).toBe("Alice Martin");
    });

    it("premier participant : email en minuscules", () => {
      const result = parseMeetCsv(CSV_MEET_BASIQUE);
      expect(result.participants[0]?.email).toBe("alice.martin@example.com");
    });

    it("premier participant : durée 210 min", () => {
      const result = parseMeetCsv(CSV_MEET_BASIQUE);
      expect(result.participants[0]?.dureeMinutes).toBe(210);
    });

    it("premier participant : joinAt valide", () => {
      const result = parseMeetCsv(CSV_MEET_BASIQUE);
      expect(result.participants[0]?.joinAt).toBeInstanceOf(Date);
    });

    it("premier participant : leaveAt valide", () => {
      const result = parseMeetCsv(CSV_MEET_BASIQUE);
      expect(result.participants[0]?.leaveAt).toBeInstanceOf(Date);
    });
  });

  describe("normalisation email", () => {
    it("email en majuscules → normalisé en minuscules", () => {
      const result = parseMeetCsv(CSV_MEET_BOM);
      expect(result.participants[0]?.email).toBe("test@example.com");
    });
  });

  describe("robustesse BOM", () => {
    it("BOM retiré → 1 participant", () => {
      const result = parseMeetCsv(CSV_MEET_BOM);
      expect(result.participants).toHaveLength(1);
    });
  });

  describe("participant sans email", () => {
    it("email null si colonne absente", () => {
      const result = parseMeetCsv(CSV_MEET_SANS_EMAIL);
      expect(result.participants[0]?.email).toBeNull();
    });

    it("durée correcte malgré absence email", () => {
      const result = parseMeetCsv(CSV_MEET_SANS_EMAIL);
      expect(result.participants[0]?.dureeMinutes).toBe(30);
    });
  });

  describe("cas limites", () => {
    it("CSV vide → 0 participants", () => {
      const result = parseMeetCsv("");
      expect(result.participants).toHaveLength(0);
    });

    it("en-têtes seuls → 0 participants", () => {
      const result = parseMeetCsv("Name,Email,Duration,Time joined,Time exited");
      expect(result.participants).toHaveLength(0);
    });
  });
});
