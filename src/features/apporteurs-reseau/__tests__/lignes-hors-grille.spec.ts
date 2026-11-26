import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot « grille » (contrat 2.8, annexe 1 : A1.3 coaching et A1.6 conférence = aucune commission) :
// les ANCIENNES lignes encore non facturées sont annulées (jamais supprimées, jamais ramenées à
// 0,00 €) ; une ligne déjà facturée mais pas versée n'est pas touchée (Williams est alerté) ; une
// ligne versée n'est jamais reprise par cette règle (seul un avoir du client la reprend).

const d = vi.hoisted(() => ({
  lignes: [] as Array<Record<string, unknown>>,
  filleuls: [] as Array<Record<string, unknown>>,
  annuler: vi.fn(async (_id: string, _motif: string) => ({ ok: true }) as Record<string, unknown>),
  maj: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
  alertes: [] as Array<{ payload: Record<string, unknown>; opts: Record<string, unknown> }>,
  deja: false,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("../ajustement", () => ({ annulerCommission: d.annuler }));
vi.mock("../commissions", () => ({ dejaEnvoye: vi.fn(async () => d.deja) }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(
    async (
      _g: string,
      _d: string,
      _l: string,
      payload: Record<string, unknown>,
      opts: Record<string, unknown>,
    ) => {
      d.alertes.push({ payload, opts });
      return { enqueued: true };
    },
  ),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    commissionApporteur: {
      findMany: vi.fn(async (a: { where: { factureId?: unknown } }) =>
        a.where.factureId ? d.filleuls : d.lignes,
      ),
      updateMany: vi.fn(
        async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          d.maj.push(a);
          return { count: 1 };
        },
      ),
    },
    activityLog: { create: vi.fn(async () => ({})) },
  },
}));

import { annulerLignesHorsGrille, estHorsGrille } from "../lignes-hors-grille";

const MAINTENANT = new Date("2026-11-26T08:00:00Z");
const l = (o: Record<string, unknown>) => ({
  id: "C1",
  apporteurId: "APP1",
  factureId: "F1",
  parrainage: false,
  activite: "conference",
  palier: "conference",
  statut: "due",
  montantCents: 50_000,
  autofactureNumero: null,
  verseeAt: null,
  ...o,
});

beforeEach(() => {
  d.lignes = [];
  d.filleuls = [];
  d.annuler.mockClear();
  d.maj = [];
  d.alertes = [];
  d.deja = false;
});

describe("ce qui est hors de la grille 2.8", () => {
  it("conférence (activité ou palier) et coaching ; rien d'autre", () => {
    expect(estHorsGrille({ activite: "conference", palier: null })).toBe(true);
    expect(estHorsGrille({ activite: "formation", palier: "conference" })).toBe(true);
    expect(estHorsGrille({ activite: "un_a_un", palier: null })).toBe(true);
    expect(estHorsGrille({ activite: "audit", palier: null })).toBe(false);
    expect(estHorsGrille({ activite: "formation", palier: "formation-generale-1j" })).toBe(false);
    expect(estHorsGrille({ activite: "journee_ia", palier: "journee-ia" })).toBe(false);
  });
});

describe("annulation des anciennes lignes non facturées", () => {
  it("conférence due non facturée et coaching à qualifier : annulés (motif tracé), jamais à 0 €", async () => {
    d.lignes = [l({}), l({ id: "C2", activite: "un_a_un", palier: null, statut: "a_qualifier" })];
    const r = await annulerLignesHorsGrille(MAINTENANT);
    expect(d.annuler.mock.calls.map((c) => c[0])).toEqual(["C1", "C2"]);
    expect(d.annuler.mock.calls[0]![1]).toMatch(/annexe 1/);
    expect(r.annulees).toBe(2);
    expect(d.maj.some((m) => m.data.montantCents === 0)).toBe(false);
  });

  it("une ligne d'une autre activité, filtrée à tort par la requête, n'est jamais touchée", async () => {
    d.lignes = [l({ activite: "audit", palier: null })];
    await annulerLignesHorsGrille(MAINTENANT);
    expect(d.annuler).not.toHaveBeenCalled();
  });

  it("déjà facturée, pas versée : rien n'est modifié, Williams est alerté une fois", async () => {
    d.lignes = [l({ autofactureNumero: "AXI-APP-2026-0001" })];
    const r = await annulerLignesHorsGrille(MAINTENANT);
    expect(d.annuler).not.toHaveBeenCalled();
    expect(r.alertes).toBe(1);
    expect(d.alertes[0]!.opts.jobId).toBe("apporteur-ligne-hors-grille-facturee-C1");
    d.alertes = [];
    d.deja = true;
    await annulerLignesHorsGrille(MAINTENANT);
    expect(d.alertes).toEqual([]);
  });

  it("versée : jamais reprise par cette règle", async () => {
    d.lignes = [l({ statut: "versee", verseeAt: new Date("2026-11-01T00:00:00Z") })];
    await annulerLignesHorsGrille(MAINTENANT);
    expect(d.annuler).not.toHaveBeenCalled();
    expect(d.maj).toEqual([]);
  });

  it("part de parrain restée due alors que la ligne du filleul est déjà annulée : annulée aussi", async () => {
    d.lignes = [l({ id: "PP", apporteurId: "PAR1", parrainage: true, montantCents: 5_000 })];
    d.filleuls = [{ factureId: "F1", statut: "annulee" }];
    await annulerLignesHorsGrille(MAINTENANT);
    expect(d.maj).toEqual([
      expect.objectContaining({
        where: expect.objectContaining({ id: "PP", autofactureNumero: null }),
        data: { statut: "annulee" },
      }),
    ]);
  });

  it("part de parrain dont le filleul est encore vivant : laissée (elle suit le filleul)", async () => {
    d.lignes = [l({ id: "PP", apporteurId: "PAR1", parrainage: true, montantCents: 5_000 })];
    d.filleuls = [{ factureId: "F1", statut: "versee" }];
    await annulerLignesHorsGrille(MAINTENANT);
    expect(d.maj).toEqual([]);
    expect(d.annuler).not.toHaveBeenCalled();
  });
});

// Relecture : un COMPLÉMENT ou une REPRISE d'une ligne déjà versée n'est jamais annulé par cette règle
// (le complément rend à l'apporteur ce qu'une reprise lui avait retiré sur une ligne acquise), et
// l'étape est idempotente : rejouée, elle ne crée ni n'annule rien de plus.
describe("compléments et reprises : jamais touchés ; rejeu sans effet", () => {
  it("palier `complement-de:` ou `reprise-de:` : ni annulé, ni modifié", async () => {
    d.lignes = [
      l({ id: "K1", palier: "complement-de:C0", factureId: "aleatoire-1" }),
      l({ id: "K2", activite: "un_a_un", palier: "complement-de:C9", statut: "a_qualifier" }),
      l({ id: "R1", palier: "reprise-de:C0", montantCents: -10_000 }),
      l({ id: "R2", palier: "reprise:C0", montantCents: -10_000 }),
    ];
    expect(estHorsGrille({ activite: "conference", palier: "complement-de:C0" })).toBe(false);
    const r = await annulerLignesHorsGrille(MAINTENANT);
    expect(r).toEqual({ annulees: 0, alertes: 0 });
    expect(d.annuler).not.toHaveBeenCalled();
    expect(d.maj).toEqual([]);
  });

  it("la requête elle-même écarte compléments et reprises", async () => {
    const { prisma } = await import("@/lib/prisma");
    const fm = prisma.commissionApporteur.findMany as unknown as {
      mock: { calls: Array<[{ where: Record<string, unknown> }]> };
    };
    await annulerLignesHorsGrille(MAINTENANT);
    const where = fm.mock.calls.at(-1)![0].where;
    expect(JSON.stringify(where)).toContain("complement-de:");
    expect(JSON.stringify(where)).toContain("reprise");
  });

  it("rejouée 3 fois : une annulation au premier passage, rien ensuite", async () => {
    const vivante = l({});
    d.lignes = [vivante];
    d.annuler.mockImplementation(async (id: string) => {
      // La ligne annulée sort de la requête (statut « annulee ») au passage suivant.
      d.lignes = d.lignes.filter((x) => x.id !== id);
      return { ok: true };
    });
    const bilans = [];
    for (let i = 0; i < 3; i += 1) bilans.push(await annulerLignesHorsGrille(MAINTENANT));
    expect(bilans).toEqual([
      { annulees: 1, alertes: 0 },
      { annulees: 0, alertes: 0 },
      { annulees: 0, alertes: 0 },
    ]);
    expect(d.annuler).toHaveBeenCalledTimes(1);
    d.annuler.mockImplementation(async () => ({ ok: true }));
  });

  it("ligne facturée rejouée 3 fois : une seule alerte, aucune modification", async () => {
    d.lignes = [l({ autofactureNumero: "AXI-APP-2026-0002" })];
    const { dejaEnvoye } = await import("../commissions");
    const envoyes = new Set<string>();
    (
      dejaEnvoye as unknown as { mockImplementation: (f: (j: string) => unknown) => void }
    ).mockImplementation(async (j: string) => envoyes.has(j));
    const { enqueueEmail } = await import("@/server/queue/queues");
    (
      enqueueEmail as unknown as { mockImplementation: (f: (...a: unknown[]) => unknown) => void }
    ).mockImplementation(async (...a: unknown[]) => {
      const opts = a[4] as { jobId: string };
      envoyes.add(opts.jobId);
      d.alertes.push({ payload: a[3] as Record<string, unknown>, opts });
      return { enqueued: true };
    });
    for (let i = 0; i < 3; i += 1) await annulerLignesHorsGrille(MAINTENANT);
    expect(d.alertes).toHaveLength(1);
    expect(d.annuler).not.toHaveBeenCalled();
    expect(d.maj).toEqual([]);
  });
});
