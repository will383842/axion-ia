import { beforeEach, describe, expect, it, vi } from "vitest";

import { A1, commande, neuf, Etat } from "./challenge-constat-faux";

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

describe("le passage ne constate qu'après la fin", () => {
  it("pendant la période → rien ; le lendemain de la fin → constat", async () => {
    commande(h.e, { apporteurId: A1, journees: 10 });
    await constaterChallenges(new Date("2026-12-31T22:00:00Z")); // 31 décembre 23 h à Paris
    expect(h.e.primes).toHaveLength(0);
    await constaterChallenges(new Date("2026-12-31T23:30:00Z")); // 1er janvier 0 h 30 à Paris
    expect(h.e.primes).toHaveLength(1);
  });
});
