import { beforeEach, describe, expect, it, vi } from "vitest";

import { A1, commande, neuf, Etat } from "./challenge-constat-faux";

const h = vi.hoisted(() => ({
  e: null as unknown as Etat,
  mode: "ok" as "ok" | "leve" | "incomplete",
}));
vi.mock("@/lib/prisma", async () => {
  const f = await import("./challenge-constat-faux");
  h.e = f.neuf();
  return { prisma: f.creerPrisma(h.e) };
});
vi.mock("../paiement-integral", () => ({
  lirePaiementsIntegrauxParFacture: async (ids: string[]) => {
    if (h.mode === "leve") throw new Error("délai dépassé");
    if (h.mode === "incomplete") return new Map();
    return new Map(ids.map((i) => [i, h.e.paiements.get(i) ?? null]));
  },
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

const APRES = new Date("2027-01-01T08:00:00Z");
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
  h.mode = "ok";
});

async function primeValidee() {
  commande(h.e, { apporteurId: A1, journees: 12 });
  await constaterChallenges(APRES);
  h.e.primes[0]!["statut"] = "validee";
}

describe("lecture des paiements en échec : aucune prime validée ne change", () => {
  it.each(["leve", "incomplete"] as const)("lecture %s", async (mode) => {
    await primeValidee();
    h.mode = mode;
    await constaterChallenges(APRES);
    await constaterChallenges(APRES);
    expect(h.e.primes).toHaveLength(1);
    expect(h.e.primes[0]!["statut"]).toBe("validee");
    // Une seule alerte « constat interrompu », jamais une alerte de reprise.
    expect(h.e.alertes).toHaveLength(1);
    expect(h.e.alertes[0]).toMatch(/^challenge-constat-interrompu:/);
  });
});
