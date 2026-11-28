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

describe("seul l'attributaire compte", () => {
  it("deux apporteurs sur le même SIREN : la commission n'existe que pour l'attributaire", async () => {
    // Une seule CommissionApporteur existe par commande (celle de l'attributaire) : on la lit, jamais une copie.
    commande(h.e, { apporteurId: A1, journees: 10 });
    await constaterChallenges(APRES);
    expect(h.e.primes.map((p) => p["apporteurId"])).toEqual([A1]);
  });
  it("une commission annulée, reprise ou retenue ne compte pas", async () => {
    commande(h.e, { apporteurId: A1, journees: 4, statut: "annulee" });
    commande(h.e, { apporteurId: A1, journees: 3, statut: "reprise" });
    commande(h.e, { apporteurId: A1, journees: 3, statut: "retenue" });
    await constaterChallenges(APRES);
    expect(h.e.primes).toHaveLength(0);
  });
});
