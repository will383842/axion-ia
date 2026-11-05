/**
 * « Un prospect passe en client lorsqu'un devis est signé » : la règle, sur une base SIMULÉE en
 * mémoire (le client Prisma ordinaire reçu, hors transaction d'acceptation). Garde : le statut ne fait que monter, un rejeu ne trace pas deux fois,
 * un devis non accepté ne fait rien monter, une panne n'échoue jamais.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => sentry);

import { faireMonterLesFichesDesDevisSignes } from "../devis-signe-fait-client";

type Statut = "prospect" | "devis_envoye" | "client_actif" | "client_inactif" | "perdu";

interface Monde {
  devis: Map<string, { clientId: string; numero: string; statut: string }>;
  clients: Map<string, { statut: Statut }>; // réaffecté par le retour arrière d'une transaction
  fusions: { absorbeId: string; absorbantId: string; defaiteLe: Date | null }[];
  traces: Record<string, unknown>[];
  ecritures: number;
}

function monde(): Monde {
  return { devis: new Map(), clients: new Map(), fusions: [], traces: [], ecritures: 0 };
}

function faux(m: Monde) {
  // Les écritures ne vivent que dans `t`, le client de la petite transaction : elles ne sont
  // joignables qu'à travers `$transaction`, comme en production.
  const t = {
    client: {
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; statut: Statut };
          data: { statut: Statut };
        }) => {
          const c = m.clients.get(where.id);
          if (c === undefined || c.statut !== where.statut) return { count: 0 };
          c.statut = data.statut;
          m.ecritures += 1;
          return { count: 1 };
        },
      ),
    },
    activityLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        m.traces.push(data);
        return data;
      }),
    },
  };
  const db = {
    devis: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) => m.devis.get(where.id) ?? null,
      ),
    },
    client: {
      findUnique: vi.fn(
        // Une COPIE, comme Prisma : la ligne lue ne bouge pas avec l'écriture suivante.
        async ({ where }: { where: { id: string } }) => {
          const c = m.clients.get(where.id);
          return c === undefined ? null : { ...c };
        },
      ),
    },
    clientFusion: {
      findMany: vi.fn(async ({ where }: { where: { absorbeId: { in: string[] } } }) =>
        m.fusions.filter((f) => where.absorbeId.in.includes(f.absorbeId) && f.defaiteLe === null),
      ),
    },
    // Une vraie transaction : si le travail lève, tout ce qu'il a écrit est annulé.
    $transaction: vi.fn(async (travail: (x: typeof t) => Promise<unknown>) => {
      const avant = new Map([...m.clients].map(([id, c]) => [id, { ...c }]));
      const ecrituresAvant = m.ecritures;
      const tracesAvant = m.traces.length;
      try {
        return await travail(t);
      } catch (err) {
        m.clients = avant;
        m.ecritures = ecrituresAvant;
        m.traces.length = tracesAvant;
        throw err;
      }
    }),
    t,
  };
  return db;
}

const D1 = "d1";
const C1 = "c1";
const lancer = (m: Monde, ids: string[] = [D1], origine: "docuseal" | "console" = "docuseal") =>
  faireMonterLesFichesDesDevisSignes(faux(m) as never, ids, { origine });

let m: Monde;
beforeEach(() => {
  vi.clearAllMocks();
  m = monde();
  m.devis.set(D1, { clientId: C1, numero: "DEV-1", statut: "accepte" });
  m.clients.set(C1, { statut: "prospect" });
});

describe("la montée", () => {
  it.each(["prospect", "devis_envoye"] as const)(
    "%s devient client actif, avec sa trace",
    async (s) => {
      m.clients.get(C1)!.statut = s;
      expect(await lancer(m)).toBe(1);
      expect(m.clients.get(C1)!.statut).toBe("client_actif");
      expect(m.traces).toHaveLength(1);
      expect(m.traces[0]).toMatchObject({
        action: "client.devient_client",
        targetType: "Client",
        targetId: C1,
        adminUserId: null,
        changes: {
          origine: "devis_signe:docuseal",
          statutAvant: s,
          statutApres: "client_actif",
          numeroDevis: "DEV-1",
        },
      });
    },
  );

  it.each(["client_actif", "client_inactif", "perdu"] as const)(
    "%s ne bouge jamais tout seul",
    async (s) => {
      m.clients.get(C1)!.statut = s;
      expect(await lancer(m)).toBe(0);
      expect(m.clients.get(C1)!.statut).toBe(s);
      expect(m.ecritures).toBe(0);
      expect(m.traces).toHaveLength(0);
    },
  );

  it("un rejeu (ou un second chemin) ne trace pas une seconde fois", async () => {
    await lancer(m);
    await lancer(m, [D1, D1], "console");
    expect(m.traces).toHaveLength(1);
    expect(m.ecritures).toBe(1);
  });

  it("course perdue (la fiche a changé entre la lecture et l'écriture) : aucune trace", async () => {
    const tx = faux(m);
    tx.t.client.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await faireMonterLesFichesDesDevisSignes(tx as never, [D1], { origine: "docuseal" }),
    ).toBe(0);
    expect(m.traces).toHaveLength(0);
  });

  it("l'écriture et sa trace vont ensemble dans UNE transaction", async () => {
    const db = faux(m);
    expect(
      await faireMonterLesFichesDesDevisSignes(db as never, [D1], { origine: "docuseal" }),
    ).toBe(1);
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(db.t.client.updateMany).toHaveBeenCalledOnce();
    expect(db.t.activityLog.create).toHaveBeenCalledOnce();
    // L'écriture et la trace sont passées par le client de la transaction, dans cet ordre.
    expect(db.t.client.updateMany.mock.invocationCallOrder[0]!).toBeLessThan(
      db.t.activityLog.create.mock.invocationCallOrder[0]!,
    );
  });

  it("si la trace échoue, l'écriture est annulée avec elle (Sentry le dit, le statut ne bouge pas)", async () => {
    const db = faux(m);
    db.t.activityLog.create.mockRejectedValue(new Error("trace"));
    expect(
      await faireMonterLesFichesDesDevisSignes(db as never, [D1], { origine: "docuseal" }),
    ).toBe(0);
    expect(m.clients.get(C1)!.statut).toBe("prospect");
    expect(m.traces).toHaveLength(0);
    expect(sentry.captureException).toHaveBeenCalledOnce();
  });

  it("l'administrateur de la console est nommé dans la trace", async () => {
    await faireMonterLesFichesDesDevisSignes(faux(m) as never, [D1], {
      origine: "console",
      adminUserId: "adm",
    });
    expect(m.traces[0]).toMatchObject({ adminUserId: "adm" });
  });
});

describe("ce qui ne fait rien monter", () => {
  it.each(["envoye", "refuse", "expire", "brouillon"])(
    "un devis %s (pas accepté) ne fait rien monter",
    async (statut) => {
      m.devis.get(D1)!.statut = statut;
      expect(await lancer(m)).toBe(0);
      expect(m.clients.get(C1)!.statut).toBe("prospect");
    },
  );

  it("aucun devis visé : rien", async () => {
    expect(await lancer(m, [])).toBe(0);
    expect(m.clients.get(C1)!.statut).toBe("prospect");
  });

  it("devis ou fiche absents : on passe, sans lever", async () => {
    expect(await lancer(m, ["inconnu"])).toBe(0);
    m.clients.delete(C1);
    expect(await lancer(m)).toBe(0);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

describe("fiche absorbée par fusion", () => {
  it("la fiche absorbante vivante monte aussi ; une fusion défaite ne compte pas", async () => {
    m.clients.set("abs", { statut: "prospect" });
    m.clients.set("ancienne", { statut: "prospect" });
    m.fusions.push({ absorbeId: C1, absorbantId: "abs", defaiteLe: null });
    m.fusions.push({ absorbeId: C1, absorbantId: "ancienne", defaiteLe: new Date() });
    expect(await lancer(m)).toBe(2);
    expect(m.clients.get("abs")!.statut).toBe("client_actif");
    expect(m.clients.get("ancienne")!.statut).toBe("prospect");
  });
});

describe("panne", () => {
  it("une erreur est signalée à Sentry et n'échoue jamais", async () => {
    const tx = faux(m);
    tx.t.client.updateMany.mockRejectedValue(new Error("base"));
    await expect(
      faireMonterLesFichesDesDevisSignes(tx as never, [D1], { origine: "docuseal" }),
    ).resolves.toBe(0);
    expect(sentry.captureException).toHaveBeenCalledOnce();
  });
});
