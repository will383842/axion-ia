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

describe("une prime validée dont le recompte retombe sous le seuil", () => {
  it("passe à « à reprendre » avec une alerte interne, sans rien supprimer", async () => {
    const f = commande(h.e, { apporteurId: A1, journees: 10 });
    await constaterChallenges(APRES);
    h.e.primes[0]!["statut"] = "validee";
    // Remboursement total : un avoir efface la commande.
    h.e.factures.push({
      id: "avoir-1",
      devisId: h.e.factures[0]!["devisId"],
      numero: "AV-1",
      statut: "payee",
      avoirDeId: f,
      montantHtCents: -(h.e.factures[0]!["montantHtCents"] as number),
      emiseAt: new Date("2026-12-28T10:00:00Z"),
      paidAt: new Date("2026-12-28T10:00:00Z"),
    });
    await constaterChallenges(APRES);
    expect(h.e.primes).toHaveLength(1);
    expect(h.e.primes[0]!["statut"]).toBe("a_reprendre");
    expect(h.e.alertes).toHaveLength(1);
    await constaterChallenges(APRES);
    expect(h.e.alertes).toHaveLength(1); // une alerte par fait
  });
});
