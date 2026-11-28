import { beforeEach, describe, expect, it, vi } from "vitest";

import { A1, A2, commande, neuf, Etat } from "./challenge-constat-faux";

const h = vi.hoisted(() => ({ e: null as unknown as Etat }));
vi.mock("@/lib/prisma", async () => {
  const f = await import("./challenge-constat-faux");
  h.e = f.neuf();
  return { prisma: f.creerPrisma(h.e) };
});
vi.mock("../paiement-integral", () => ({
  paiementsIntegrauxParFacture: async (ids: string[]) =>
    new Map(ids.map((i) => [i, h.e.paiements.get(i) ?? null])),
}));
vi.mock("../alerte-interne", () => ({
  alerteInterne: async (a: { jobId: string }) => {
    if (h.e.alertes.includes(a.jobId)) return false;
    h.e.alertes.push(a.jobId);
    return true;
  },
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));

import { constaterChallenges } from "../challenge-constat";

const APRES = new Date("2027-01-01T08:00:00Z"); // 1er janvier, Paris
beforeEach(() => {
  const v = neuf();
  h.e.challenges = v.challenges;
  h.e.commissions = [];
  h.e.factures = [];
  h.e.devis = [];
  h.e.paiements = new Map();
  h.e.primes = [];
  h.e.alertes = [];
  h.e.refuserCreation = false;
});

describe("le constat est idempotent", () => {
  it("deux passages → une seule prime ; une prime validée ou refusée n'est jamais réécrite", async () => {
    commande(h.e, { apporteurId: A1, journees: 10 });
    commande(h.e, { apporteurId: A2, journees: 10 });
    await constaterChallenges(APRES);
    await constaterChallenges(APRES);
    expect(h.e.primes).toHaveLength(2);
    h.e.primes[0]!["statut"] = "refusee";
    h.e.primes[0]!["motif"] = "doublon";
    h.e.primes[0]!["nbJournees"] = 99;
    await constaterChallenges(APRES);
    expect(h.e.primes[0]!["nbJournees"]).toBe(99);
    expect(h.e.primes[0]!["statut"]).toBe("refusee");
  });
  it("une prime à valider est remise à jour avec le recompte", async () => {
    commande(h.e, { apporteurId: A1, journees: 10 });
    await constaterChallenges(APRES);
    commande(h.e, { apporteurId: A1, journees: 2 });
    await constaterChallenges(APRES);
    expect(h.e.primes).toHaveLength(1);
    expect(h.e.primes[0]!["nbJournees"]).toBe(12);
  });
  it("aucune prime sans challenge publié dans sa fenêtre", async () => {
    commande(h.e, { apporteurId: A1, journees: 10 });
    await constaterChallenges(new Date("2026-12-15T08:00:00Z"));
    expect(h.e.primes).toHaveLength(0);
  });
});
