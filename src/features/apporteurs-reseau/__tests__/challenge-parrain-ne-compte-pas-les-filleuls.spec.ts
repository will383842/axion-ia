import { beforeEach, describe, expect, it, vi } from "vitest";

import { A1, commande, neuf, Etat } from "./challenge-constat-faux";

const h = vi.hoisted(() => ({ e: null as unknown as Etat }));
vi.mock("@/lib/prisma", async () => {
  const f = await import("./challenge-constat-faux");
  h.e = f.neuf();
  return { prisma: f.creerPrisma(h.e) };
});
vi.mock("../paiement-integral", () => ({
  lirePaiementsIntegrauxParFacture: async (ids: string[]) =>
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

describe("le parrain ne compte pas les Journées de ses filleuls", () => {
  it("une part de parrainage est écartée", async () => {
    commande(h.e, { apporteurId: A1, journees: 6 });
    commande(h.e, { apporteurId: A1, journees: 4, parrainage: true });
    await constaterChallenges(APRES);
    expect(h.e.primes).toHaveLength(0);
  });
});
