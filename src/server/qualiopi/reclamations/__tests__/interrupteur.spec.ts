/**
 * L09 — ce que l'interrupteur `qualiopi.reclamations.actif` ouvre.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  valeur: undefined as unknown,
  inscription: null as null | { estTestInterne: boolean; session: { estTestInterne: boolean } },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: {
      findUnique: vi.fn(async () => (h.valeur === undefined ? null : { value: h.valeur })),
    },
    enrollment: { findUnique: vi.fn(async () => h.inscription) },
  },
}));

import { cycleActifPour, lireInterrupteurReclamations } from "../interrupteur";
import { formulaireOuvert } from "../depot-public";

beforeEach(() => {
  h.valeur = undefined;
  h.inscription = null;
});

describe("interrupteur des réclamations", () => {
  it("clé absente = éteint : rien ne s'applique", async () => {
    expect(await lireInterrupteurReclamations()).toBe("eteint");
    expect(await cycleActifPour({ enrollmentId: "e" })).toBe(false);
  });

  it("actif : le cycle vaut pour toutes les réclamations, même sans inscription", async () => {
    h.valeur = { etat: "actif" };
    expect(await cycleActifPour({ enrollmentId: null })).toBe(true);
  });

  it("essai : seulement une inscription (ou une session) du banc d'essai", async () => {
    h.valeur = { etat: "essai" };
    expect(await cycleActifPour({ enrollmentId: null })).toBe(false);
    h.inscription = { estTestInterne: false, session: { estTestInterne: false } };
    expect(await cycleActifPour({ enrollmentId: "e" })).toBe(false);
    h.inscription = { estTestInterne: false, session: { estTestInterne: true } };
    expect(await cycleActifPour({ enrollmentId: "e" })).toBe(true);
  });

  it("une valeur mal formée vaut éteint", async () => {
    h.valeur = { etat: "allume" };
    expect(await lireInterrupteurReclamations()).toBe("eteint");
  });

  it("le formulaire public : fermé éteint, banc d'essai seul en essai, ouvert actif", () => {
    expect(formulaireOuvert("eteint", { inscriptionDeTest: true })).toBe(false);
    expect(formulaireOuvert("essai", { inscriptionDeTest: false })).toBe(false);
    expect(formulaireOuvert("essai", { inscriptionDeTest: true })).toBe(true);
    expect(formulaireOuvert("actif", { inscriptionDeTest: false })).toBe(true);
  });
});
