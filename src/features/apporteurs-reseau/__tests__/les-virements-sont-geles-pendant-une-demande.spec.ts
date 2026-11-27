// Lot 7 (plan §4.2) : une demande de changement de compte OUVERTE gèle les virements de l'apporteur.
// Calculé à la lecture ; table absente = comportement d'aujourd'hui.
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  demandes: [] as Array<Record<string, unknown>>,
  absente: false,
  lectures: 0,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurChangementIban: {
      findMany: vi.fn(async (a: { where: { apporteurId: { in: string[] } } }) => {
        etat.lectures += 1;
        if (etat.absente) throw Object.assign(new Error("absente"), { code: "P2021" });
        return etat.demandes.filter((d) => a.where.apporteurId.in.includes(String(d["apporteurId"])));
      }),
    },
  },
}));

import { demandesQuiGelent, MESSAGE_GEL } from "../virement-compte";

const maintenant = new Date("2026-12-01T10:00:00Z");
const A = "11111111-1111-4111-8111-111111111111";
const d = (statut: string, extra: Record<string, unknown> = {}) => ({
  id: "22222222-2222-4222-8222-222222222222",
  apporteurId: A,
  statut,
  demandeeAt: new Date("2026-12-01T08:00:00Z"),
  confirmeeAt: null,
  ...extra,
});

beforeEach(() => {
  etat.demandes = [];
  etat.absente = false;
  etat.lectures = 0;
});

describe("gel des virements", () => {
  it.each(["a_confirmer", "confirmee"])("demande %s : gel actif", async (s) => {
    etat.demandes = [d(s)];
    const m = await demandesQuiGelent([A], maintenant);
    expect(m.get(A)?.statut).toBe(s);
  });

  it.each(["validee", "refusee", "opposee", "annulee", "expiree"])(
    "demande %s : gel levé",
    async (s) => {
      etat.demandes = [d(s)];
      expect((await demandesQuiGelent([A], maintenant)).size).toBe(0);
    },
  );

  it("demande a_confirmer de plus de 24 h non encore écrite « expirée » : ne gèle plus", async () => {
    etat.demandes = [d("a_confirmer", { demandeeAt: new Date("2026-11-30T09:00:00Z") })];
    expect((await demandesQuiGelent([A], maintenant)).size).toBe(0);
  });

  it("table absente (P2021) : comportement d'aujourd'hui, aucun gel", async () => {
    etat.absente = true;
    expect((await demandesQuiGelent([A], maintenant)).size).toBe(0);
  });

  it("toute autre erreur est relancée : jamais de virement par défaut sur une panne", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.apporteurChangementIban.findMany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("connexion perdue"),
    );
    await expect(demandesQuiGelent([A], maintenant)).rejects.toThrow("connexion perdue");
  });

  it("aucun apporteur : aucune lecture", async () => {
    await demandesQuiGelent([], maintenant);
    expect(etat.lectures).toBe(0);
  });

  it("le message de refus est celui du plan", () => {
    expect(MESSAGE_GEL).toBe("Virements gelés : changement de compte en cours");
  });
});
