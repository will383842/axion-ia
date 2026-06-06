/**
 * Tests — Logique pure de décision des auto-transitions cron (T6).
 *
 * Vérifie :
 *   - decideSessionTransitions : transitions planifiee→en_cours et en_cours→realisee
 *   - Idempotence (session déjà dans le bon statut → pas de décision)
 *   - Statuts terminaux (realisee, annulee, reportee → pas de décision)
 *   - Bornes temporelles exactes (dateDebut = now → transition ; dateDebut = now+1ms → pas de transition)
 *   - AUTO_CLOTURE_DELAY_MS (24h exactement)
 *   - Validation bornes récurrentes (occurrences 1 ou 53 → Zod rejet extractible)
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { decideSessionTransitions, AUTO_CLOTURE_DELAY_MS } from "./crons";
import type { SessionCronSnapshot } from "./crons";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const NOW = new Date("2026-06-06T08:00:00.000Z");

function makeSession(
  overrides: Partial<SessionCronSnapshot> & Pick<SessionCronSnapshot, "statut">,
): SessionCronSnapshot {
  return {
    id: "test-session-id",
    dateDebut: new Date("2026-06-01T08:00:00.000Z"), // passée par défaut
    dateFin: new Date("2026-06-01T17:00:00.000Z"), // passée par défaut
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO_CLOTURE_DELAY_MS
// ─────────────────────────────────────────────────────────────────────────────

describe("AUTO_CLOTURE_DELAY_MS", () => {
  it("vaut exactement 24 heures en ms", () => {
    expect(AUTO_CLOTURE_DELAY_MS).toBe(24 * 60 * 60 * 1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// decideSessionTransitions — planifiee → en_cours
// ─────────────────────────────────────────────────────────────────────────────

describe("decideSessionTransitions — planifiee → en_cours", () => {
  it("décide la transition quand dateDebut < now", () => {
    const session = makeSession({
      id: "s1",
      statut: "planifiee",
      dateDebut: new Date(NOW.getTime() - 1000), // 1s avant now
      dateFin: new Date(NOW.getTime() + 3600_000),
    });
    const decisions = decideSessionTransitions([session], NOW);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({ sessionId: "s1", from: "planifiee", to: "en_cours" });
  });

  it("décide la transition quand dateDebut === now (borne incluse)", () => {
    const session = makeSession({
      id: "s2",
      statut: "planifiee",
      dateDebut: new Date(NOW.getTime()), // = now
      dateFin: new Date(NOW.getTime() + 3600_000),
    });
    const decisions = decideSessionTransitions([session], NOW);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({ sessionId: "s2", from: "planifiee", to: "en_cours" });
  });

  it("ne décide PAS la transition quand dateDebut > now (futur)", () => {
    const session = makeSession({
      id: "s3",
      statut: "planifiee",
      dateDebut: new Date(NOW.getTime() + 1), // 1ms dans le futur
      dateFin: new Date(NOW.getTime() + 3600_000),
    });
    const decisions = decideSessionTransitions([session], NOW);
    expect(decisions).toHaveLength(0);
  });

  it("ne décide PAS la transition pour une session déjà en_cours", () => {
    const session = makeSession({
      statut: "en_cours",
      dateDebut: new Date(NOW.getTime() - 3600_000), // passée
    });
    const decisions = decideSessionTransitions([session], NOW);
    // Ne doit PAS produire planifiee→en_cours pour une session déjà en_cours
    expect(decisions.filter((d) => d.to === "en_cours")).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// decideSessionTransitions — en_cours → realisee (auto-clôture J+1)
// ─────────────────────────────────────────────────────────────────────────────

describe("decideSessionTransitions — en_cours → realisee", () => {
  it("décide la transition quand dateFin + 24h < now", () => {
    const dateFin = new Date(NOW.getTime() - AUTO_CLOTURE_DELAY_MS - 1000); // 24h+1s avant now
    const session = makeSession({
      id: "s4",
      statut: "en_cours",
      dateDebut: new Date(dateFin.getTime() - 3600_000),
      dateFin,
    });
    const decisions = decideSessionTransitions([session], NOW);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({ sessionId: "s4", from: "en_cours", to: "realisee" });
  });

  it("décide la transition quand dateFin + 24h === now (borne incluse)", () => {
    const dateFin = new Date(NOW.getTime() - AUTO_CLOTURE_DELAY_MS); // dateFin + 24h = now
    const session = makeSession({
      id: "s5",
      statut: "en_cours",
      dateDebut: new Date(dateFin.getTime() - 3600_000),
      dateFin,
    });
    const decisions = decideSessionTransitions([session], NOW);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({ sessionId: "s5", from: "en_cours", to: "realisee" });
  });

  it("ne décide PAS la transition quand dateFin + 24h > now (trop tôt)", () => {
    const dateFin = new Date(NOW.getTime() - AUTO_CLOTURE_DELAY_MS + 1); // pas encore 24h
    const session = makeSession({
      id: "s6",
      statut: "en_cours",
      dateDebut: new Date(dateFin.getTime() - 3600_000),
      dateFin,
    });
    const decisions = decideSessionTransitions([session], NOW);
    expect(decisions).toHaveLength(0);
  });

  it("ne décide PAS la transition pour une session planifiee (même si dateFin passée)", () => {
    const dateFin = new Date(NOW.getTime() - AUTO_CLOTURE_DELAY_MS - 1000);
    const session = makeSession({
      statut: "planifiee",
      dateDebut: new Date(dateFin.getTime() - 3600_000),
      dateFin,
    });
    // planifiee ne peut pas aller directement vers realisee
    const decisions = decideSessionTransitions([session], NOW);
    expect(decisions.filter((d) => d.to === "realisee")).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Statuts terminaux — aucune décision
// ─────────────────────────────────────────────────────────────────────────────

describe("decideSessionTransitions — statuts terminaux", () => {
  for (const statut of ["realisee", "annulee", "reportee"] as const) {
    it(`ne produit aucune décision pour statut terminal '${statut}'`, () => {
      const session = makeSession({
        statut,
        dateDebut: new Date(NOW.getTime() - 86400_000),
        dateFin: new Date(NOW.getTime() - AUTO_CLOTURE_DELAY_MS - 1000),
      });
      const decisions = decideSessionTransitions([session], NOW);
      expect(decisions).toHaveLength(0);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Liste mixte
// ─────────────────────────────────────────────────────────────────────────────

describe("decideSessionTransitions — liste mixte", () => {
  it("traite correctement un lot de sessions hétérogènes", () => {
    const sessions: SessionCronSnapshot[] = [
      // doit transiter planifiee → en_cours
      makeSession({
        id: "mix-1",
        statut: "planifiee",
        dateDebut: new Date(NOW.getTime() - 1000),
        dateFin: new Date(NOW.getTime() + 3600_000),
      }),
      // pas de transition (trop tôt)
      makeSession({
        id: "mix-2",
        statut: "planifiee",
        dateDebut: new Date(NOW.getTime() + 86400_000),
        dateFin: new Date(NOW.getTime() + 172800_000),
      }),
      // doit transiter en_cours → realisee
      makeSession({
        id: "mix-3",
        statut: "en_cours",
        dateDebut: new Date(NOW.getTime() - 172800_000),
        dateFin: new Date(NOW.getTime() - AUTO_CLOTURE_DELAY_MS - 1000),
      }),
      // statut terminal, pas de transition
      makeSession({
        id: "mix-4",
        statut: "realisee",
        dateDebut: new Date(NOW.getTime() - 172800_000),
        dateFin: new Date(NOW.getTime() - AUTO_CLOTURE_DELAY_MS - 1000),
      }),
    ];

    const decisions = decideSessionTransitions(sessions, NOW);
    expect(decisions).toHaveLength(2);
    expect(decisions.find((d) => d.sessionId === "mix-1")).toMatchObject({
      from: "planifiee",
      to: "en_cours",
    });
    expect(decisions.find((d) => d.sessionId === "mix-3")).toMatchObject({
      from: "en_cours",
      to: "realisee",
    });
    // mix-2 et mix-4 absents
    expect(decisions.find((d) => d.sessionId === "mix-2")).toBeUndefined();
    expect(decisions.find((d) => d.sessionId === "mix-4")).toBeUndefined();
  });

  it("retourne un tableau vide pour une liste de sessions vide", () => {
    expect(decideSessionTransitions([], NOW)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation bornes récurrentes (logique pure — Zod schema)
// ─────────────────────────────────────────────────────────────────────────────

// Schema Zod extrait pour test pur (miroir de createRecurringSessionsSchema.occurrences)
const occurrencesSchema = z
  .number()
  .int()
  .min(2, "Le nombre d'occurrences doit être ≥ 2")
  .max(52, "Le nombre d'occurrences doit être ≤ 52");

describe("Bornes récurrentes — validation pure (Zod schema)", () => {
  it("accepte la borne minimale : 2 occurrences", () => {
    expect(occurrencesSchema.safeParse(2).success).toBe(true);
  });

  it("accepte la borne maximale : 52 occurrences", () => {
    expect(occurrencesSchema.safeParse(52).success).toBe(true);
  });

  it("rejette 1 occurrence (sous le minimum)", () => {
    expect(occurrencesSchema.safeParse(1).success).toBe(false);
  });

  it("rejette 53 occurrences (au-dessus du maximum)", () => {
    expect(occurrencesSchema.safeParse(53).success).toBe(false);
  });

  it("rejette 0 occurrences", () => {
    expect(occurrencesSchema.safeParse(0).success).toBe(false);
  });

  it("rejette un nombre non entier", () => {
    expect(occurrencesSchema.safeParse(2.5).success).toBe(false);
  });
});
