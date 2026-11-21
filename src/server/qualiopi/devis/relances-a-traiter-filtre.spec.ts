import { beforeEach, describe, expect, it, vi } from "vitest";

import { pasSigneParLeClient } from "./pas-signe-par-le-client";
import { relancesAtraiterWhere } from "./relances-a-traiter-filtre";

const NOW = new Date("2030-06-01T10:00:00Z");

describe("relancesAtraiterWhere : relances de devis sans objet masquées à la lecture", () => {
  const where = relancesAtraiterWhere(NOW);
  const [aTraiter, typeOuDevis] = where.AND as Array<{ OR: Array<Record<string, unknown>> }>;

  it("garde la définition « à traiter » (jamais traitées + reportées échues)", () => {
    expect(aTraiter?.OR).toEqual([
      { statut: "a_traiter" },
      { statut: "reportee", reporteeJusqua: { lte: NOW } },
    ]);
  });

  it("les relances de facture et de dossier financeur ne changent pas", () => {
    expect(typeOuDevis?.OR[0]).toEqual({ type: { not: "devis_sans_reponse" } });
  });

  it("une relance de devis exige un devis envoyé, valide et non signé par le client", () => {
    expect(typeOuDevis?.OR[1]).toEqual({
      type: "devis_sans_reponse",
      devis: {
        is: { statut: "envoye", dateValidite: { gte: NOW }, AND: [pasSigneParLeClient] },
      },
    });
  });
});

describe("relancesAtraiterWhere : devis en délai demandé par le client", () => {
  it("sans liste (ou liste vide), l'objet rendu est IDENTIQUE à celui d'avant", () => {
    expect(relancesAtraiterWhere(NOW, [])).toEqual(relancesAtraiterWhere(NOW));
  });

  it("avec une liste, `devisId.notIn` n'est posé que dans la branche devis_sans_reponse", () => {
    const where = relancesAtraiterWhere(NOW, ["d1", "d2"]);
    const [aTraiter, typeOuDevis] = where.AND as Array<{ OR: Array<Record<string, unknown>> }>;
    expect(aTraiter?.OR).toEqual([
      { statut: "a_traiter" },
      { statut: "reportee", reporteeJusqua: { lte: NOW } },
    ]);
    expect(typeOuDevis?.OR[0]).toEqual({ type: { not: "devis_sans_reponse" } });
    expect(typeOuDevis?.OR[1]).toEqual({
      type: "devis_sans_reponse",
      devisId: { notIn: ["d1", "d2"] },
      devis: {
        is: { statut: "envoye", dateValidite: { gte: NOW }, AND: [pasSigneParLeClient] },
      },
    });
  });
});

const prismaMock = vi.hoisted(() => ({
  relanceProposee: { count: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

describe("le compteur du menu utilise le MÊME filtre que la page Facturation", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.relanceProposee.count.mockReset().mockResolvedValue(0);
  });

  it("relanceProposee.count reçoit relancesAtraiterWhere(now)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      vi.doMock("@/server/qualiopi/documents/signature/pieces-en-attente", () => ({
        compterPiecesEnAttente: async () => 0,
      }));
      vi.doMock("@/server/qualiopi/alertes/alertes-service", () => ({
        countNonLues: async () => 0,
      }));
      vi.doMock("@/server/qualiopi/parcours/echeances-service", () => ({
        compterEcheancesDepassees: async () => 0,
      }));
      const mod = await import("@/server/admin/qualiopi-nav-counts");
      const compter = (mod as Record<string, unknown>)[
        "compterQualiopiNav"
      ] as () => Promise<unknown>;
      await compter();
      expect(prismaMock.relanceProposee.count).toHaveBeenCalledWith({
        where: relancesAtraiterWhere(NOW),
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
