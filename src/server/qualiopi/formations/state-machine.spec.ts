/**
 * Tests — Machine à états des sessions de formation.
 *
 * Vérifie :
 *   - canTransitionSession : transitions valides et invalides
 *   - assertSessionTransition : throw sur transition interdite, no-throw sur autorisée
 *   - Statuts terminaux (realisee, annulee, reportee) sans transitions sortantes
 */

import { describe, it, expect } from "vitest";
import {
  SESSION_TRANSITIONS,
  canTransitionSession,
  assertSessionTransition,
} from "./state-machine";
import type { TrainingSessionStatut } from "./types";

describe("SESSION_TRANSITIONS", () => {
  it("contient toutes les valeurs de TrainingSessionStatut comme clés", () => {
    const expectedKeys: TrainingSessionStatut[] = [
      "planifiee",
      "en_cours",
      "realisee",
      "annulee",
      "reportee",
    ];
    for (const k of expectedKeys) {
      expect(SESSION_TRANSITIONS).toHaveProperty(k);
    }
  });

  it("planifiee → en_cours, annulee, reportee (3 transitions)", () => {
    expect(SESSION_TRANSITIONS.planifiee).toEqual(
      expect.arrayContaining(["en_cours", "annulee", "reportee"]),
    );
    expect(SESSION_TRANSITIONS.planifiee).toHaveLength(3);
  });

  it("en_cours → realisee, annulee (2 transitions)", () => {
    expect(SESSION_TRANSITIONS.en_cours).toEqual(expect.arrayContaining(["realisee", "annulee"]));
    expect(SESSION_TRANSITIONS.en_cours).toHaveLength(2);
  });

  it("realisee → [] (statut terminal)", () => {
    expect(SESSION_TRANSITIONS.realisee).toHaveLength(0);
  });

  it("annulee → [] (statut terminal)", () => {
    expect(SESSION_TRANSITIONS.annulee).toHaveLength(0);
  });

  it("reportee → [] (statut terminal)", () => {
    expect(SESSION_TRANSITIONS.reportee).toHaveLength(0);
  });
});

describe("canTransitionSession", () => {
  // ── Transitions valides ──
  it("planifiee → en_cours : true", () => {
    expect(canTransitionSession("planifiee", "en_cours")).toBe(true);
  });

  it("planifiee → annulee : true", () => {
    expect(canTransitionSession("planifiee", "annulee")).toBe(true);
  });

  it("planifiee → reportee : true", () => {
    expect(canTransitionSession("planifiee", "reportee")).toBe(true);
  });

  it("en_cours → realisee : true", () => {
    expect(canTransitionSession("en_cours", "realisee")).toBe(true);
  });

  it("en_cours → annulee : true", () => {
    expect(canTransitionSession("en_cours", "annulee")).toBe(true);
  });

  // ── Transitions interdites ──
  it("planifiee → realisee : false (pas de saut direct)", () => {
    expect(canTransitionSession("planifiee", "realisee")).toBe(false);
  });

  it("realisee → planifiee : false (terminal)", () => {
    expect(canTransitionSession("realisee", "planifiee")).toBe(false);
  });

  it("realisee → en_cours : false (terminal)", () => {
    expect(canTransitionSession("realisee", "en_cours")).toBe(false);
  });

  it("annulee → planifiee : false (terminal)", () => {
    expect(canTransitionSession("annulee", "planifiee")).toBe(false);
  });

  it("annulee → en_cours : false (terminal)", () => {
    expect(canTransitionSession("annulee", "en_cours")).toBe(false);
  });

  it("reportee → planifiee : false (terminal)", () => {
    expect(canTransitionSession("reportee", "planifiee")).toBe(false);
  });

  it("reportee → en_cours : false (terminal)", () => {
    expect(canTransitionSession("reportee", "en_cours")).toBe(false);
  });

  it("en_cours → planifiee : false (pas de retour arrière)", () => {
    expect(canTransitionSession("en_cours", "planifiee")).toBe(false);
  });

  it("en_cours → reportee : false", () => {
    expect(canTransitionSession("en_cours", "reportee")).toBe(false);
  });
});

describe("assertSessionTransition", () => {
  it("ne lève pas pour une transition valide : planifiee → en_cours", () => {
    expect(() => assertSessionTransition("planifiee", "en_cours")).not.toThrow();
  });

  it("ne lève pas pour une transition valide : en_cours → realisee", () => {
    expect(() => assertSessionTransition("en_cours", "realisee")).not.toThrow();
  });

  it("ne lève pas pour une transition valide : planifiee → annulee", () => {
    expect(() => assertSessionTransition("planifiee", "annulee")).not.toThrow();
  });

  it("lève pour une transition interdite : planifiee → realisee", () => {
    expect(() => assertSessionTransition("planifiee", "realisee")).toThrow(
      /Transition de session interdite/,
    );
  });

  it("lève pour une transition interdite depuis un statut terminal : realisee → planifiee", () => {
    expect(() => assertSessionTransition("realisee", "planifiee")).toThrow(/statut terminal/);
  });

  it("lève pour une transition interdite depuis un statut terminal : annulee → en_cours", () => {
    expect(() => assertSessionTransition("annulee", "en_cours")).toThrow(/statut terminal/);
  });

  it("le message d'erreur cite les transitions autorisées disponibles", () => {
    let message = "";
    try {
      assertSessionTransition("planifiee", "realisee");
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toContain("en_cours");
    expect(message).toContain("annulee");
    expect(message).toContain("reportee");
  });
});
