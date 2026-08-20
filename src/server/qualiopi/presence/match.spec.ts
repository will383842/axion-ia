/**
 * Tests — match.ts
 *
 * Vérifie :
 *   - Match exact par email
 *   - Match par nom normalisé (avec accents, ordre inversé)
 *   - Résolution de doublon (durée la plus longue gagne)
 *   - Participants non matchés dans unmatched
 *   - Un enrollment matché au plus une fois
 *   - normalizeNom : accents, ordre tokens
 */

import { describe, it, expect } from "vitest";
import { matchParticipants, normalizeNom } from "./match";
import type { MatchInput, ParsedParticipant } from "./types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ENROLLMENTS: MatchInput[] = [
  { enrollmentId: "e1", email: "alice.martin@example.com", nom: "Martin", prenom: "Alice" },
  { enrollmentId: "e2", email: "bob.dupont@example.com", nom: "Dupont", prenom: "Bob" },
  { enrollmentId: "e3", email: "claire.morel@example.com", nom: "Morel", prenom: "Claire" },
];

function makeParticipant(
  overrides: Partial<ParsedParticipant> & { nomBrut: string },
): ParsedParticipant {
  return {
    email: null,
    joinAt: null,
    leaveAt: null,
    dureeMinutes: 60,
    // 🔴 2026-08-20 (`DIST-01`) — champ AJOUTÉ. La présence est désormais
    // ventilée par journée : `ParsedParticipant` l'exige, et c'est le
    // compilateur — non la vigilance — qui garde cette fixture alignée sur le
    // type. Vide par défaut : ce fichier teste l'APPARIEMENT (email, nom), pas
    // la ventilation, qui a sa propre suite.
    parJour: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("matchParticipants", () => {
  describe("match par email exact", () => {
    it("email exact → matché avec bon enrollmentId", () => {
      const participants = [
        makeParticipant({ nomBrut: "Alice M.", email: "alice.martin@example.com" }),
      ];
      const { matched, unmatched } = matchParticipants(participants, ENROLLMENTS);
      expect(matched).toHaveLength(1);
      expect(matched[0]?.enrollmentId).toBe("e1");
      expect(unmatched).toHaveLength(0);
    });

    it("email en majuscules côté participant → matché quand même", () => {
      const participants = [
        makeParticipant({ nomBrut: "Bob D.", email: "BOB.DUPONT@EXAMPLE.COM" }),
      ];
      const { matched } = matchParticipants(participants, ENROLLMENTS);
      expect(matched[0]?.enrollmentId).toBe("e2");
    });
  });

  describe("match par nom normalisé", () => {
    it("'Alice Martin' sans email → matché via nom", () => {
      const participants = [makeParticipant({ nomBrut: "Alice Martin", email: null })];
      const { matched, unmatched } = matchParticipants(participants, ENROLLMENTS);
      expect(matched).toHaveLength(1);
      expect(matched[0]?.enrollmentId).toBe("e1");
      expect(unmatched).toHaveLength(0);
    });

    it("ordre inversé 'Martin Alice' → matché", () => {
      const participants = [makeParticipant({ nomBrut: "Martin Alice", email: null })];
      const { matched } = matchParticipants(participants, ENROLLMENTS);
      expect(matched[0]?.enrollmentId).toBe("e1");
    });

    it("nom avec accents 'Élodie Dupont' vs 'Elodie Dupont' → matché", () => {
      const enrollments: MatchInput[] = [
        { enrollmentId: "e10", email: "elodie@example.com", nom: "Dupont", prenom: "Elodie" },
      ];
      const participants = [makeParticipant({ nomBrut: "Élodie Dupont", email: null })];
      const { matched } = matchParticipants(participants, enrollments);
      expect(matched[0]?.enrollmentId).toBe("e10");
    });
  });

  describe("participants non matchés", () => {
    it("participant inconnu → dans unmatched", () => {
      const participants = [makeParticipant({ nomBrut: "Inconnu Personne", email: null })];
      const { matched, unmatched } = matchParticipants(participants, ENROLLMENTS);
      expect(matched).toHaveLength(0);
      expect(unmatched).toHaveLength(1);
      expect(unmatched[0]?.nomBrut).toBe("Inconnu Personne");
    });

    it("email inconnu → dans unmatched", () => {
      const participants = [makeParticipant({ nomBrut: "Inconnu", email: "inconnu@example.com" })];
      const { matched, unmatched } = matchParticipants(participants, ENROLLMENTS);
      expect(matched).toHaveLength(0);
      expect(unmatched).toHaveLength(1);
    });
  });

  describe("doublon d'enrollment", () => {
    it("même enrollment matché 2× → le plus long en durée gagne", () => {
      const participants = [
        makeParticipant({
          nomBrut: "Alice Martin",
          email: "alice.martin@example.com",
          dureeMinutes: 100,
        }),
        makeParticipant({
          nomBrut: "Alice M.",
          email: "alice.martin@example.com",
          dureeMinutes: 180,
        }),
      ];
      const { matched } = matchParticipants(participants, ENROLLMENTS);
      // Un seul match pour e1
      const matchE1 = matched.filter((m) => m.enrollmentId === "e1");
      expect(matchE1).toHaveLength(1);
      expect(matchE1[0]?.participant.dureeMinutes).toBe(180);
    });
  });

  describe("plusieurs participants matchés", () => {
    it("3 participants matchés sur 3 enrollments", () => {
      const participants = [
        makeParticipant({ nomBrut: "Alice Martin", email: "alice.martin@example.com" }),
        makeParticipant({ nomBrut: "Bob Dupont", email: "bob.dupont@example.com" }),
        makeParticipant({ nomBrut: "Claire Morel", email: "claire.morel@example.com" }),
      ];
      const { matched, unmatched } = matchParticipants(participants, ENROLLMENTS);
      expect(matched).toHaveLength(3);
      expect(unmatched).toHaveLength(0);
    });
  });

  describe("liste vide", () => {
    it("participants vides → 0 matched + 0 unmatched", () => {
      const { matched, unmatched } = matchParticipants([], ENROLLMENTS);
      expect(matched).toHaveLength(0);
      expect(unmatched).toHaveLength(0);
    });

    it("enrollments vides → tous dans unmatched", () => {
      const participants = [makeParticipant({ nomBrut: "Alice Martin" })];
      const { matched, unmatched } = matchParticipants(participants, []);
      expect(matched).toHaveLength(0);
      expect(unmatched).toHaveLength(1);
    });
  });
});

describe("normalizeNom", () => {
  it("retire les accents", () => {
    expect(normalizeNom("Élodie")).toBe("elodie");
  });

  it("passe en minuscules", () => {
    expect(normalizeNom("ALICE MARTIN")).toBe("alice martin");
  });

  it("trie les tokens", () => {
    // "martin alice" → tokens triés → "alice martin"
    expect(normalizeNom("Martin Alice")).toBe("alice martin");
  });

  it("trie les tokens (déjà triés)", () => {
    expect(normalizeNom("Alice Martin")).toBe("alice martin");
  });

  it("gère les accents multiples", () => {
    expect(normalizeNom("Héloïse Léger")).toBe("heloise leger");
  });

  it("trim des espaces superflus", () => {
    expect(normalizeNom("  Alice  Martin  ")).toBe("alice martin");
  });
});
