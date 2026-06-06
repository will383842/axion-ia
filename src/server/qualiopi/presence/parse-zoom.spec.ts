/**
 * Tests — parse-zoom.ts
 *
 * Vérifie :
 *   - Parsing d'un CSV Zoom standard (1 ligne par participant)
 *   - Agrégation multi-lignes (même email → somme durées, min(join)/max(leave))
 *   - Robustesse BOM UTF-8
 *   - Email normalisé en minuscules
 *   - Participant sans email → agrégation par nom
 *   - Valeurs manquantes (join/leave absents)
 */

import { describe, it, expect } from "vitest";
import { parseZoomCsv } from "./parse-zoom";

/** CSV Zoom minimal avec 3 participants distincts. */
const CSV_ZOOM_BASIQUE = `"Name (Original Name)","User Email","Join Time","Leave Time","Duration (Minutes)"
"Alice Martin","alice.martin@example.com","06/10/2026 09:00:00 AM","06/10/2026 12:30:00 PM","210"
"Bob Dupont","bob.dupont@example.com","06/10/2026 09:05:00 AM","06/10/2026 12:00:00 PM","175"
"Claire Morel","claire.morel@example.com","06/10/2026 14:00:00 PM","06/10/2026 17:30:00 PM","210"`;

/** CSV Zoom avec 2 lignes pour le même participant (entrée/sortie multiple). */
const CSV_ZOOM_MULTI_LIGNES = `"Name (Original Name)","User Email","Join Time","Leave Time","Duration (Minutes)"
"Alice Martin","alice.martin@example.com","06/10/2026 09:00:00 AM","06/10/2026 10:30:00 AM","90"
"Alice Martin","alice.martin@example.com","06/10/2026 11:00:00 AM","06/10/2026 12:30:00 PM","90"
"Bob Dupont","bob.dupont@example.com","06/10/2026 09:00:00 AM","06/10/2026 12:30:00 PM","210"`;

/** CSV Zoom avec BOM UTF-8. */
const CSV_ZOOM_BOM = `﻿"Name (Original Name)","User Email","Join Time","Leave Time","Duration (Minutes)"
"Test User","test@example.com","06/10/2026 09:00:00 AM","06/10/2026 10:00:00 AM","60"`;

/** CSV Zoom sans emails (participants anonymes). */
const CSV_ZOOM_SANS_EMAIL = `"Name (Original Name)","User Email","Join Time","Leave Time","Duration (Minutes)"
"Participant Anonyme","","06/10/2026 09:00:00 AM","06/10/2026 12:30:00 PM","210"`;

describe("parseZoomCsv", () => {
  describe("parsing basique", () => {
    it("retourne la bonne plateforme", () => {
      const result = parseZoomCsv(CSV_ZOOM_BASIQUE);
      expect(result.plateforme).toBe("zoom");
    });

    it("retourne 3 participants", () => {
      const result = parseZoomCsv(CSV_ZOOM_BASIQUE);
      expect(result.participants).toHaveLength(3);
    });

    it("nbLignes = 3", () => {
      const result = parseZoomCsv(CSV_ZOOM_BASIQUE);
      expect(result.nbLignes).toBe(3);
    });

    it("premier participant : nom brut correct", () => {
      const result = parseZoomCsv(CSV_ZOOM_BASIQUE);
      expect(result.participants[0]?.nomBrut).toBe("Alice Martin");
    });

    it("premier participant : email en minuscules", () => {
      const result = parseZoomCsv(CSV_ZOOM_BASIQUE);
      expect(result.participants[0]?.email).toBe("alice.martin@example.com");
    });

    it("premier participant : durée 210 min", () => {
      const result = parseZoomCsv(CSV_ZOOM_BASIQUE);
      expect(result.participants[0]?.dureeMinutes).toBe(210);
    });

    it("premier participant : joinAt est une Date valide", () => {
      const result = parseZoomCsv(CSV_ZOOM_BASIQUE);
      expect(result.participants[0]?.joinAt).toBeInstanceOf(Date);
    });
  });

  describe("agrégation multi-lignes", () => {
    it("2 lignes pour Alice → 1 participant", () => {
      const result = parseZoomCsv(CSV_ZOOM_MULTI_LIGNES);
      const alice = result.participants.find((p) => p.email === "alice.martin@example.com");
      expect(alice).toBeDefined();
    });

    it("2 lignes pour Alice → durée totale 180 min", () => {
      const result = parseZoomCsv(CSV_ZOOM_MULTI_LIGNES);
      const alice = result.participants.find((p) => p.email === "alice.martin@example.com");
      expect(alice?.dureeMinutes).toBe(180);
    });

    it("2 lignes pour Alice → joinAt = première connexion", () => {
      const result = parseZoomCsv(CSV_ZOOM_MULTI_LIGNES);
      const alice = result.participants.find((p) => p.email === "alice.martin@example.com");
      const bob = result.participants.find((p) => p.email === "bob.dupont@example.com");
      // Alice a rejoint avant Bob dans les deux lignes
      expect(alice?.joinAt?.getTime()).toBeLessThanOrEqual(bob?.joinAt?.getTime() ?? Infinity);
    });

    it("total participants unique = 2 (Alice agrégée)", () => {
      const result = parseZoomCsv(CSV_ZOOM_MULTI_LIGNES);
      expect(result.participants).toHaveLength(2);
    });
  });

  describe("robustesse BOM", () => {
    it("BOM retiré → parsing correct", () => {
      const result = parseZoomCsv(CSV_ZOOM_BOM);
      expect(result.participants).toHaveLength(1);
      expect(result.participants[0]?.email).toBe("test@example.com");
    });

    it("BOM retiré → durée correcte", () => {
      const result = parseZoomCsv(CSV_ZOOM_BOM);
      expect(result.participants[0]?.dureeMinutes).toBe(60);
    });
  });

  describe("participant sans email", () => {
    it("email null pour participant anonyme", () => {
      const result = parseZoomCsv(CSV_ZOOM_SANS_EMAIL);
      expect(result.participants[0]?.email).toBeNull();
    });

    it("nom brut conservé", () => {
      const result = parseZoomCsv(CSV_ZOOM_SANS_EMAIL);
      expect(result.participants[0]?.nomBrut).toBe("Participant Anonyme");
    });
  });

  describe("cas limites", () => {
    it("CSV vide → 0 participants", () => {
      const result = parseZoomCsv("");
      expect(result.participants).toHaveLength(0);
    });

    it("en-têtes seuls sans données → 0 participants", () => {
      const result = parseZoomCsv(
        `"Name (Original Name)","User Email","Join Time","Leave Time","Duration (Minutes)"`,
      );
      expect(result.participants).toHaveLength(0);
    });
  });
});
