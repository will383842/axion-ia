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

describe("une seule prime par période", () => {
  it("20 Journées → une prime", async () => {
    commande(h.e, { apporteurId: A1, journees: 20 });
    await constaterChallenges(APRES);
    expect(h.e.primes).toHaveLength(1);
  });
  it("si la base refuse la prime (déclencheur), le passage ne plante pas et alerte une fois", async () => {
    commande(h.e, { apporteurId: A1, journees: 10 });
    h.e.refuserCreation = true;
    await constaterChallenges(APRES);
    await constaterChallenges(APRES);
    expect(h.e.primes).toHaveLength(0);
    expect(h.e.alertes).toHaveLength(1);
  });
});
