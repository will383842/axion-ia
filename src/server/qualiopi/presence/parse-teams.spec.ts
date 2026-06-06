/**
 * Tests — parse-teams.ts
 *
 * Vérifie :
 *   - Parsing TSV Teams (sections 1/2/3)
 *   - parseTeamsDuration : formats "1h 5m 3s", "5m", "45s", "01:05:03", nombre pur
 *   - Extraction email / UPN
 *   - Robustesse BOM + NUL
 *   - TSV sans sections → parsing direct
 */

import { describe, it, expect } from "vitest";
import { parseTeamsCsv, parseTeamsDuration } from "./parse-teams";

/** TSV Teams avec sections structurées. */
const TSV_TEAMS_SECTIONS = [
  "1. Summary",
  "Meeting title\tFormation IA",
  "Meeting date\t2026-06-10",
  "",
  "2. Participants",
  "Name\tEmail\tDuration\tFirst Join\tLast Leave",
  "Alice Martin\talice.martin@example.com\t3h 30m 0s\t2026-06-10T09:00:00Z\t2026-06-10T12:30:00Z",
  "Bob Dupont\tbob.dupont@example.com\t2h 55m 0s\t2026-06-10T09:05:00Z\t2026-06-10T12:00:00Z",
  "Claire Morel\tclaire.morel@example.com\t3h 30m 0s\t2026-06-10T14:00:00Z\t2026-06-10T17:30:00Z",
  "",
  "3. In-Meeting Activities",
  "Activité\tDétail",
  "Partage d'écran\t09:15",
].join("\n");

/** TSV Teams simple sans sections. */
const TSV_TEAMS_SIMPLE = [
  "Name\tEmail\tDuration\tFirst Join\tLast Leave",
  "Alice Martin\talice.martin@example.com\t1h 5m 3s\t2026-06-10T09:00:00Z\t2026-06-10T10:05:03Z",
  "Bob Dupont\tbob.dupont@example.com\t45m 0s\t2026-06-10T09:00:00Z\t2026-06-10T09:45:00Z",
].join("\n");

/** TSV avec BOM et NUL (simulation UTF-16 LE mal décodé). */
const TSV_TEAMS_BOM = `﻿Name\tEmail\tDuration\tFirst Join\tLast Leave\nTest User\ttest@example.com\t1h 0m 0s\t2026-06-10T09:00:00Z\t2026-06-10T10:00:00Z`;

describe("parseTeamsCsv", () => {
  describe("sections structurées", () => {
    it("retourne la bonne plateforme", () => {
      const result = parseTeamsCsv(TSV_TEAMS_SECTIONS);
      expect(result.plateforme).toBe("teams");
    });

    it("extrait 3 participants de la section 2", () => {
      const result = parseTeamsCsv(TSV_TEAMS_SECTIONS);
      expect(result.participants).toHaveLength(3);
    });

    it("premier participant : nom correct", () => {
      const result = parseTeamsCsv(TSV_TEAMS_SECTIONS);
      expect(result.participants[0]?.nomBrut).toBe("Alice Martin");
    });

    it("premier participant : email en minuscules", () => {
      const result = parseTeamsCsv(TSV_TEAMS_SECTIONS);
      expect(result.participants[0]?.email).toBe("alice.martin@example.com");
    });

    it("premier participant : durée 210 min (3h 30m)", () => {
      const result = parseTeamsCsv(TSV_TEAMS_SECTIONS);
      expect(result.participants[0]?.dureeMinutes).toBeCloseTo(210, 0);
    });

    it("premier participant : joinAt valide", () => {
      const result = parseTeamsCsv(TSV_TEAMS_SECTIONS);
      expect(result.participants[0]?.joinAt).toBeInstanceOf(Date);
    });
  });

  describe("TSV simple sans sections", () => {
    it("extrait 2 participants", () => {
      const result = parseTeamsCsv(TSV_TEAMS_SIMPLE);
      expect(result.participants).toHaveLength(2);
    });

    it("durée '1h 5m 3s' ≈ 65 min", () => {
      const result = parseTeamsCsv(TSV_TEAMS_SIMPLE);
      expect(result.participants[0]?.dureeMinutes).toBeCloseTo(65, 0);
    });
  });

  describe("robustesse BOM", () => {
    it("BOM retiré → 1 participant", () => {
      const result = parseTeamsCsv(TSV_TEAMS_BOM);
      expect(result.participants).toHaveLength(1);
    });

    it("BOM retiré → durée 60 min", () => {
      const result = parseTeamsCsv(TSV_TEAMS_BOM);
      expect(result.participants[0]?.dureeMinutes).toBeCloseTo(60, 0);
    });
  });

  describe("cas limites", () => {
    it("contenu vide → 0 participants", () => {
      const result = parseTeamsCsv("");
      expect(result.participants).toHaveLength(0);
    });
  });
});

describe("parseTeamsDuration", () => {
  it("'3h 30m 0s' → 210", () => {
    expect(parseTeamsDuration("3h 30m 0s")).toBeCloseTo(210, 1);
  });

  it("'1h 5m 3s' → ~65 min", () => {
    expect(parseTeamsDuration("1h 5m 3s")).toBeCloseTo(65.05, 1);
  });

  it("'45m 0s' → 45", () => {
    expect(parseTeamsDuration("45m 0s")).toBeCloseTo(45, 1);
  });

  it("'45s' → 0.75 min", () => {
    expect(parseTeamsDuration("45s")).toBeCloseTo(0.75, 2);
  });

  it("'01:30:00' (HH:mm:ss) → 90", () => {
    expect(parseTeamsDuration("01:30:00")).toBeCloseTo(90, 1);
  });

  it("'3600' (secondes pures) → 60 min", () => {
    expect(parseTeamsDuration("3600")).toBeCloseTo(60, 1);
  });

  it("'' → 0", () => {
    expect(parseTeamsDuration("")).toBe(0);
  });

  it("'abc' → 0", () => {
    expect(parseTeamsDuration("abc")).toBe(0);
  });
});
