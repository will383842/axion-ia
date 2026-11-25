// L3b — prestation RÉPUTÉE réalisée 90 jours calendaires après l'encaissement INTÉGRAL du client,
// sauf opposition motivée enregistrée avant l'échéance (décision D3 du dirigeant, 25/11/2026).
import { beforeEach, describe, expect, it, vi } from "vitest";

type Com = {
  id: string;
  factureId: string;
  statut: string;
  montantCents: number | null;
  litigeDepuis: Date | null;
  prestationRealiseeAt: Date | null;
  prestationRealiseePar: string | null;
};
type Fac = { id: string; statut: string; paidAt: Date | null };
type Log = { action: string; targetType: string; targetId: string; changes: unknown };

const h = vi.hoisted(() => ({
  coms: [] as Com[],
  facs: [] as Fac[],
  logs: [] as Log[],
  journalEnPanne: false,
  updateData: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/prisma", () => {
  const dans = (v: unknown, w: { in?: unknown[] } | string | undefined) =>
    w === undefined ? true : typeof w === "string" ? v === w : (w.in ?? []).includes(v);
  const creerLog = async ({ data }: { data: Log }) => {
    if (h.journalEnPanne) throw new Error("journal en panne");
    h.logs.push(data);
  };
  const updateMany = async ({
    where,
    data,
  }: {
    where: { id: string; statut: { in: string[] } };
    data: Record<string, unknown>;
  }) => {
    h.updateData.push(data);
    const c = h.coms.find(
      (x) =>
        x.id === where.id &&
        x.prestationRealiseeAt === null &&
        x.prestationRealiseePar === null &&
        x.litigeDepuis === null &&
        where.statut.in.includes(x.statut),
    );
    if (!c) return { count: 0 };
    Object.assign(c, data);
    return { count: 1 };
  };
  const prisma = {
    $queryRaw: async () => [],
    commissionApporteur: {
      findMany: async ({ where }: { where: { id?: { gt: string }; statut: { in: string[] } } }) =>
        h.coms
          .filter(
            (c) =>
              c.prestationRealiseeAt === null &&
              c.prestationRealiseePar === null &&
              c.litigeDepuis === null &&
              dans(c.statut, where.statut) &&
              (!where.id || c.id > where.id.gt),
          )
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, 200),
      findUnique: async ({ where }: { where: { id: string } }) =>
        h.coms.find((c) => c.id === where.id) ?? null,
      updateMany,
    },
    factureFormation: {
      findMany: async ({
        where,
      }: {
        where: { id: { in: string[] }; statut: string; paidAt: { lte: Date } };
      }) =>
        h.facs.filter(
          (f) =>
            where.id.in.includes(f.id) &&
            f.statut === where.statut &&
            f.paidAt !== null &&
            f.paidAt.getTime() <= where.paidAt.lte.getTime(),
        ),
      findUnique: async ({ where }: { where: { id: string } }) =>
        h.facs.find((f) => f.id === where.id) ?? null,
    },
    activityLog: {
      create: creerLog,
      findMany: async ({ where }: { where: { action: string; targetId: { in: string[] } } }) =>
        h.logs.filter((l) => l.action === where.action && where.targetId.in.includes(l.targetId)),
    },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
      const avant = { coms: h.coms.map((c) => ({ ...c })), logs: [...h.logs] };
      try {
        return await cb({ commissionApporteur: { updateMany }, activityLog: { create: creerLog } });
      } catch (e) {
        h.coms.splice(0, h.coms.length, ...avant.coms);
        h.logs.splice(0, h.logs.length, ...avant.logs);
        throw e;
      }
    },
  };
  return { prisma };
});

import {
  marquerRealiseesDOffice,
  REALISATION_REPUTEE_JOURS,
  sOpposerAuMarquageDOffice,
} from "../realisation-reputee";

const JOUR = 86_400_000;
const PAYE = new Date("2026-06-01T10:00:00.000Z");
const apres = (jours: number, plus = 0) => new Date(PAYE.getTime() + jours * JOUR + plus);

function poser(over: Partial<Com> = {}, fac: Partial<Fac> = {}) {
  h.facs.push({ id: "f1", statut: "payee", paidAt: PAYE, ...fac });
  h.coms.push({
    id: "c1",
    factureId: "f1",
    statut: "due",
    montantCents: 12345,
    litigeDepuis: null,
    prestationRealiseeAt: null,
    prestationRealiseePar: null,
    ...over,
  });
}

beforeEach(() => {
  h.coms.length = 0;
  h.facs.length = 0;
  h.logs.length = 0;
  h.updateData.length = 0;
  h.journalEnPanne = false;
});

describe("marquerRealiseesDOffice", () => {
  it("la constante vaut 90 jours (décision D3)", () => {
    expect(REALISATION_REPUTEE_JOURS).toBe(90);
  });

  it("89 jours après l'encaissement : rien", async () => {
    poser();
    expect(await marquerRealiseesDOffice(apres(89, JOUR - 1))).toBe(0);
    expect(h.coms[0]!.prestationRealiseeAt).toBeNull();
  });

  it("90 jours exactement : marquée, à la date encaissement + 90 j, par « office », journalisée", async () => {
    poser();
    expect(await marquerRealiseesDOffice(apres(90))).toBe(1);
    expect(h.coms[0]!.prestationRealiseeAt).toEqual(apres(90));
    expect(h.coms[0]!.prestationRealiseePar).toBe("office");
    expect(h.logs).toHaveLength(1);
    expect(h.logs[0]!.action).toBe("commission_apporteur.prestation_realisee");
    expect(h.logs[0]!.targetId).toBe("c1");
  });

  it("91 jours : marquée, mais toujours à encaissement + 90 j (pas à la date du passage)", async () => {
    poser();
    expect(await marquerRealiseesDOffice(apres(91))).toBe(1);
    expect(h.coms[0]!.prestationRealiseeAt).toEqual(apres(90));
  });

  it("paiement partiel ou en retard : jamais réputée réalisée", async () => {
    poser({}, { statut: "partiellement_payee" });
    h.facs.push({ id: "f2", statut: "en_retard", paidAt: null });
    h.coms.push({ ...h.coms[0]!, id: "c2", factureId: "f2" });
    expect(await marquerRealiseesDOffice(apres(400))).toBe(0);
    expect(h.coms.every((c) => c.prestationRealiseeAt === null)).toBe(true);
  });

  it("opposition motivée la veille de l'échéance : non marquée, même longtemps après", async () => {
    poser();
    const r = await sOpposerAuMarquageDOffice(
      "c1",
      "Client a signalé une session non tenue",
      apres(89, 23 * 3_600_000),
      "adm1",
    );
    expect(r).toEqual({ ok: true });
    expect(await marquerRealiseesDOffice(apres(200))).toBe(0);
    expect(h.coms[0]!.prestationRealiseeAt).toBeNull();
  });

  it("opposition sans motif, ou le jour de l'échéance ou après : refusée, rien ne change", async () => {
    poser();
    expect((await sOpposerAuMarquageDOffice("c1", "   ", apres(10), null)).ok).toBe(false);
    expect((await sOpposerAuMarquageDOffice("c1", "motif sérieux", apres(90), null)).ok).toBe(
      false,
    );
    expect(h.logs).toHaveLength(0);
    expect(await marquerRealiseesDOffice(apres(90))).toBe(1);
  });

  it("opposition : journal en échec → refusée (pas d'opposition fantôme)", async () => {
    poser();
    h.journalEnPanne = true;
    expect((await sOpposerAuMarquageDOffice("c1", "motif sérieux", apres(10), null)).ok).toBe(
      false,
    );
  });

  it("opposition redite : idempotente (une seule ligne de journal)", async () => {
    poser();
    await sOpposerAuMarquageDOffice("c1", "motif sérieux", apres(10), null);
    expect(await sOpposerAuMarquageDOffice("c1", "motif sérieux", apres(11), null)).toEqual({
      ok: true,
    });
    expect(
      h.logs.filter((l) => l.action === "commission_apporteur.realisation_opposition"),
    ).toHaveLength(1);
  });

  it("rejeu : le second passage ne fait rien et n'ajoute rien au journal", async () => {
    poser();
    expect(await marquerRealiseesDOffice(apres(95))).toBe(1);
    expect(await marquerRealiseesDOffice(apres(96))).toBe(0);
    expect(h.logs).toHaveLength(1);
  });

  it("n'agit que sur les commissions en attente de réalisation", async () => {
    poser({ prestationRealiseeAt: apres(5), prestationRealiseePar: "console" });
    poser({ id: "c2", statut: "versee" });
    poser({ id: "c3", statut: "annulee" });
    poser({ id: "c4", prestationRealiseePar: "annulee-console" });
    poser({ id: "c5", litigeDepuis: apres(10) });
    expect(await marquerRealiseesDOffice(apres(300))).toBe(0);
    expect(h.coms.find((c) => c.id === "c1")!.prestationRealiseePar).toBe("console");
  });

  it("ne recalcule jamais un montant ni ne change un statut", async () => {
    poser();
    await marquerRealiseesDOffice(apres(100));
    expect(h.coms[0]!.montantCents).toBe(12345);
    expect(h.coms[0]!.statut).toBe("due");
    for (const d of h.updateData) {
      expect(Object.keys(d).sort()).toEqual(["prestationRealiseeAt", "prestationRealiseePar"]);
    }
  });

  it("remboursement après le marquage : la commission reste dans un statut que la reprise sait traiter", async () => {
    poser();
    await marquerRealiseesDOffice(apres(100));
    // La reprise (avoirs clients, art. 4.5) travaille sur le statut et le montant : intacts.
    expect(h.coms[0]).toMatchObject({ statut: "due", montantCents: 12345 });
  });

  it("journal en échec : le marquage est annulé avec lui (rien de marqué sans trace)", async () => {
    poser();
    h.journalEnPanne = true;
    await expect(marquerRealiseesDOffice(apres(100))).rejects.toThrow();
    expect(h.coms[0]!.prestationRealiseeAt).toBeNull();
  });
});
