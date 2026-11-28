import { beforeEach, describe, expect, it, vi } from "vitest";

import { A1, A2, A3, CH, commande, neuf, Etat } from "./challenge-constat-faux";

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

describe("chaque apporteur qui atteint le seuil gagne", () => {
  it("10, 12 et 9 Journées → deux primes de même montant, aucune ligne pour celui à 9", async () => {
    commande(h.e, { apporteurId: A1, journees: 10 });
    commande(h.e, { apporteurId: A2, journees: 12 });
    commande(h.e, { apporteurId: A3, journees: 9 });
    await constaterChallenges(APRES);
    expect(h.e.primes.map((p) => p["apporteurId"]).sort()).toEqual([A1, A2]);
    expect(h.e.primes.every((p) => p["statut"] === "a_valider" && p["challengeId"] === CH)).toBe(
      true,
    );
    expect(h.e.primes.find((p) => p["apporteurId"] === A2)!["nbJournees"]).toBe(12);
  });
  it("les Journées de plusieurs commandes s'additionnent ; une offerte ne compte pas", async () => {
    commande(h.e, { apporteurId: A1, journees: 6 });
    commande(h.e, { apporteurId: A1, journees: 4, montantHtCents: 60_000 }); // prix réduit : compte
    commande(h.e, { apporteurId: A1, journees: 3, montantHtCents: 0 }); // offerte : non
    await constaterChallenges(APRES);
    expect(h.e.primes).toHaveLength(1);
    expect(h.e.primes[0]!["nbJournees"]).toBe(10);
  });
  it("une vente non payée en entier ne compte pas", async () => {
    commande(h.e, { apporteurId: A1, journees: 10, payeLe: null });
    await constaterChallenges(APRES);
    expect(h.e.primes).toHaveLength(0);
  });
  it("une facture hors période ne compte pas", async () => {
    commande(h.e, { apporteurId: A1, journees: 10, emiseAt: "2026-12-31T23:30:00Z" }); // 1er janvier à Paris
    await constaterChallenges(APRES);
    expect(h.e.primes).toHaveLength(0);
  });
  it("les preuves ne portent aucun nom", async () => {
    commande(h.e, { apporteurId: A1, journees: 10 });
    await constaterChallenges(APRES);
    const p = h.e.primes[0]!;
    expect(Object.keys((p["preuves"] as Array<Record<string, unknown>>)[0]!).sort()).toEqual(
      ["factureId", "journees", "jourFacture", "numero", "payeeIntegralementLe"].sort(),
    );
    expect(p["atteintLe"]).toBeInstanceOf(Date);
  });
});
