/**
 * INT-T81-A — la convocation et l'émargement d'une session sont BLOQUÉS côté
 * serveur tant que la condition suspensive OPCO de sa convention est en attente.
 *
 * Lentilles : sécurité et exactitude. Les TÉMOINS de l'acceptance :
 *   1. refusé en attente ; admis après accord (`active`) ou après une levée ;
 *   2. la levée par un non-administrateur est refusée ;
 *   3. l'appel direct au service est refusé, par un refus NOMMÉ ;
 *   4. échec fermé : un état illisible, inconnu ou une lecture qui lève bloque ;
 *   5. une levée est unique, journalisée, sans retour silencieux.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyDocs, findManyLogs, findUniqueDoc, countLogs, createLog, queryRaw, tx } =
  vi.hoisted(() => {
    const findManyDocs = vi.fn();
    const findManyLogs = vi.fn();
    const findUniqueDoc = vi.fn();
    const countLogs = vi.fn();
    const createLog = vi.fn();
    const queryRaw = vi.fn();
    const tx = {
      $queryRaw: (...a: unknown[]) => queryRaw(...a),
      documentGenere: {
        findMany: (...a: unknown[]) => findManyDocs(...a),
        findUnique: (...a: unknown[]) => findUniqueDoc(...a),
      },
      activityLog: {
        findMany: (...a: unknown[]) => findManyLogs(...a),
        count: (...a: unknown[]) => countLogs(...a),
        create: (...a: unknown[]) => createLog(...a),
      },
    };
    return { findManyDocs, findManyLogs, findUniqueDoc, countLogs, createLog, queryRaw, tx };
  });

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: tx.documentGenere,
    activityLog: tx.activityLog,
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));

import {
  ACTION_LEVEE_BLOCAGE,
  ConditionSuspensiveEnAttenteError,
  REFUS_CONDITION_SUSPENSIVE,
  REFUS_CONVENTION_CADUQUE,
  blocageConditionSuspensive,
  exigerConditionLevee,
  leverBlocage,
} from "../condition-suspensive-service";

const SESSION = "5f1d7d4a-0a8e-4c55-9a43-6a4c6e2f9b11";
const DOC = "0b6f0d55-6c1d-4d0e-9f73-0d2a1b7c3e44";

const convention = (
  etat: string | null,
  over: Partial<{ id: string; numero: string; conditionSuspensiveOpco: boolean }> = {},
) => ({
  id: DOC,
  numero: "CONV-2026-0001",
  conditionSuspensiveOpco: true,
  etatConditionSuspensive: etat,
  ...over,
});
const AUTRE = "7c1f9a3e-2b44-4d6a-8e10-5a9d3c2b1f00";

beforeEach(() => {
  for (const m of [findManyDocs, findManyLogs, findUniqueDoc, countLogs, createLog, queryRaw]) {
    m.mockReset();
  }
  findManyLogs.mockResolvedValue([]);
});

describe("blocageConditionSuspensive", () => {
  it("bloque une session dont la convention est en attente", async () => {
    findManyDocs.mockResolvedValue([convention("en_attente")]);
    expect(await blocageConditionSuspensive(SESSION)).toEqual({
      bloque: true,
      motif: "condition_en_attente",
      numeros: ["CONV-2026-0001"],
    });
  });

  it("n'interroge que les conventions de la session, non annulées", async () => {
    findManyDocs.mockResolvedValue([]);
    await blocageConditionSuspensive(SESSION);
    expect(findManyDocs.mock.calls[0]![0].where).toEqual({
      sessionId: SESSION,
      type: { in: ["convention", "convention_tripartite"] },
      annuleeAt: null,
    });
  });

  it("une session sans convention sous condition n'est pas jugée", async () => {
    findManyDocs.mockResolvedValue([convention(null, { conditionSuspensiveOpco: false })]);
    expect(await blocageConditionSuspensive(SESSION)).toEqual({ bloque: false });
    expect(findManyLogs).not.toHaveBeenCalled();
  });

  it("admet après accord (active) et ne bloque pas une session sans condition", async () => {
    findManyDocs.mockResolvedValue([convention("active")]);
    expect(await blocageConditionSuspensive(SESSION)).toEqual({ bloque: false });
    findManyDocs.mockResolvedValue([]);
    expect(await blocageConditionSuspensive(SESSION)).toEqual({ bloque: false });
  });

  it("INT-T81-A règle (2) : la SEULE convention caduque BLOQUE, refus `convention_caduque`", async () => {
    findManyDocs.mockResolvedValue([convention("caduque")]);
    expect(await blocageConditionSuspensive(SESSION)).toEqual({
      bloque: true,
      motif: "convention_caduque",
      numeros: ["CONV-2026-0001"],
    });
  });

  it("règle (2) : une caduque et une ACTIVE ⇒ la caduque est ignorée, session ouverte", async () => {
    findManyDocs.mockResolvedValue([
      convention("caduque"),
      convention("active", { id: AUTRE, numero: "CONV-2026-0002" }),
    ]);
    expect(await blocageConditionSuspensive(SESSION)).toEqual({ bloque: false });
  });

  it("règle (2) : une caduque et une convention SANS condition ⇒ session ouverte", async () => {
    findManyDocs.mockResolvedValue([
      convention("caduque"),
      convention(null, { id: AUTRE, conditionSuspensiveOpco: false }),
    ]);
    expect(await blocageConditionSuspensive(SESSION)).toEqual({ bloque: false });
  });

  it("règle (2) : une caduque et une en attente NON levée ⇒ bloquée par l'attente", async () => {
    findManyDocs.mockResolvedValue([
      convention("caduque"),
      convention("en_attente", { id: AUTRE, numero: "CONV-2026-0002" }),
    ]);
    expect(await blocageConditionSuspensive(SESSION)).toMatchObject({
      bloque: true,
      motif: "condition_en_attente",
      numeros: ["CONV-2026-0002"],
    });
  });

  it("règle (2) : une caduque et une en attente LEVÉE ⇒ ouverte", async () => {
    findManyDocs.mockResolvedValue([
      convention("caduque"),
      convention("en_attente", { id: AUTRE, numero: "CONV-2026-0002" }),
    ]);
    findManyLogs.mockResolvedValue([{ targetId: AUTRE }]);
    expect(await blocageConditionSuspensive(SESSION)).toEqual({ bloque: false });
  });

  it("une levée écrite avant la bascule en caduque ne couvre RIEN : pas d'état mixte", async () => {
    // La convention a été levée (ligne au journal) PUIS est devenue caduque.
    findManyDocs.mockResolvedValue([convention("caduque")]);
    findManyLogs.mockResolvedValue([{ targetId: DOC }]);
    expect(await blocageConditionSuspensive(SESSION)).toMatchObject({
      bloque: true,
      motif: "convention_caduque",
    });
  });

  it("admet après une levée journalisée de CETTE convention", async () => {
    findManyDocs.mockResolvedValue([convention("en_attente")]);
    findManyLogs.mockResolvedValue([{ targetId: DOC }]);
    expect(await blocageConditionSuspensive(SESSION)).toEqual({ bloque: false });
    expect(findManyLogs.mock.calls[0]![0].where).toEqual({
      action: ACTION_LEVEE_BLOCAGE,
      targetType: "DocumentGenere",
      targetId: { in: [DOC] },
    });
  });

  it("une levée d'une AUTRE convention ne lève rien", async () => {
    findManyDocs.mockResolvedValue([convention("en_attente")]);
    findManyLogs.mockResolvedValue([{ targetId: "autre" }]);
    expect((await blocageConditionSuspensive(SESSION)).bloque).toBe(true);
  });

  it("ÉCHEC FERMÉ : un état NULL ou inconnu bloque", async () => {
    for (const etat of [null, "n_importe_quoi"]) {
      findManyDocs.mockResolvedValue([convention(etat)]);
      expect(await blocageConditionSuspensive(SESSION)).toMatchObject({
        bloque: true,
        motif: "condition_illisible",
      });
    }
  });

  it("ÉCHEC FERMÉ : une lecture qui lève bloque, sans lever", async () => {
    findManyDocs.mockRejectedValue(new Error("connexion perdue"));
    expect(await blocageConditionSuspensive(SESSION)).toMatchObject({
      bloque: true,
      motif: "condition_illisible",
    });
  });
});

describe("exigerConditionLevee — l'appel direct au service", () => {
  it("lève un refus NOMMÉ quand la session est bloquée", async () => {
    findManyDocs.mockResolvedValue([convention("en_attente")]);
    const err = await exigerConditionLevee(SESSION).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConditionSuspensiveEnAttenteError);
    expect((err as ConditionSuspensiveEnAttenteError).code).toBe(REFUS_CONDITION_SUSPENSIVE);
  });

  it("la caducité a son refus NOMMÉ, distinct de celui de l'attente", async () => {
    findManyDocs.mockResolvedValue([convention("caduque")]);
    const err = await exigerConditionLevee(SESSION).catch((e: unknown) => e);
    expect((err as ConditionSuspensiveEnAttenteError).code).toBe(REFUS_CONVENTION_CADUQUE);
    expect((err as Error).message).toContain("caduque");
  });

  it("passe quand la session n'est pas bloquée", async () => {
    findManyDocs.mockResolvedValue([convention("active")]);
    await expect(exigerConditionLevee(SESSION)).resolves.toBeUndefined();
  });

  it("se relit sur le client de la TRANSACTION qu'on lui passe", async () => {
    const autre = {
      documentGenere: { findMany: vi.fn().mockResolvedValue([convention("en_attente")]) },
      activityLog: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await expect(exigerConditionLevee(SESSION, autre as never)).rejects.toBeInstanceOf(
      ConditionSuspensiveEnAttenteError,
    );
    expect(autre.documentGenere.findMany).toHaveBeenCalledOnce();
    expect(findManyDocs).not.toHaveBeenCalled();
  });
});

describe("leverBlocage", () => {
  const journal = (over: Record<string, unknown> = {}) =>
    ({
      adminUserId: "admin-1",
      action: ACTION_LEVEE_BLOCAGE,
      targetType: "DocumentGenere",
      targetId: DOC,
      changes: { numero: "CONV-2026-0001", motif: "renonciation_ecrite_client" },
      ipAddress: null,
      userAgent: null,
      ...over,
    }) as never;

  const docEnAttente = {
    type: "convention",
    annuleeAt: null,
    conditionSuspensiveOpco: true,
    etatConditionSuspensive: "en_attente",
  };

  it("écrit UNE ligne de journal, sous verrou de la ligne", async () => {
    findUniqueDoc.mockResolvedValue(docEnAttente);
    countLogs.mockResolvedValue(0);
    expect(await leverBlocage({ documentId: DOC, journal: journal() })).toEqual({ ok: true });
    expect(queryRaw).toHaveBeenCalledOnce();
    expect(createLog).toHaveBeenCalledOnce();
  });

  it("une levée est UNIQUE : la seconde est refusée, rien ne se réécrit", async () => {
    findUniqueDoc.mockResolvedValue(docEnAttente);
    countLogs.mockResolvedValue(1);
    expect(await leverBlocage({ documentId: DOC, journal: journal() })).toEqual({
      ok: false,
      raison: "deja_levee",
    });
    expect(createLog).not.toHaveBeenCalled();
  });

  it("refuse quand la condition n'est plus en attente ou la convention annulée", async () => {
    for (const doc of [
      { ...docEnAttente, etatConditionSuspensive: "active" },
      { ...docEnAttente, etatConditionSuspensive: "caduque" },
      { ...docEnAttente, annuleeAt: new Date() },
    ]) {
      findUniqueDoc.mockResolvedValue(doc);
      expect(await leverBlocage({ documentId: DOC, journal: journal() })).toEqual({
        ok: false,
        raison: "pas_en_attente",
      });
    }
    expect(createLog).not.toHaveBeenCalled();
  });

  it("refuse une pièce qui n'est pas une convention sous condition", async () => {
    for (const doc of [
      null,
      { ...docEnAttente, type: "facture" },
      { ...docEnAttente, conditionSuspensiveOpco: false },
    ]) {
      findUniqueDoc.mockResolvedValue(doc);
      expect(await leverBlocage({ documentId: DOC, journal: journal() })).toEqual({
        ok: false,
        raison: "introuvable",
      });
    }
  });

  it("refuse un journal qui n'est pas CELUI de la levée de CETTE convention", async () => {
    for (const j of [journal({ action: "autre" }), journal({ targetId: "autre-doc" })]) {
      expect(await leverBlocage({ documentId: DOC, journal: j })).toEqual({
        ok: false,
        raison: "journal_incoherent",
      });
    }
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("DEUX levées concurrentes sur la même convention : une acceptée, l'autre `deja_levee`, UNE ligne au journal", async () => {
    // Le verrou de ligne (`FOR UPDATE`) sérialise les transactions : on le
    // reproduit par une file, et le journal est un état partagé.
    const journalEcrit: unknown[] = [];
    let queue: Promise<unknown> = Promise.resolve();
    const verrou = <T>(fn: () => Promise<T>): Promise<T> => {
      const r = queue.then(fn, fn);
      queue = r.catch(() => undefined);
      return r;
    };
    findUniqueDoc.mockResolvedValue(docEnAttente);
    countLogs.mockImplementation(async () => journalEcrit.length);
    createLog.mockImplementation(async (a: unknown) => {
      await Promise.resolve();
      journalEcrit.push(a);
    });
    const { prisma } = await import("@/lib/prisma");
    const reel = prisma.$transaction;
    (prisma as unknown as { $transaction: unknown }).$transaction = (
      fn: (t: typeof tx) => Promise<unknown>,
    ) => verrou(() => fn(tx));
    try {
      const [a, b] = await Promise.all([
        leverBlocage({ documentId: DOC, journal: journal() }),
        leverBlocage({ documentId: DOC, journal: journal() }),
      ]);
      const resultats = [a, b].map((r) => (r.ok ? "ok" : r.raison)).sort();
      expect(resultats).toEqual(["deja_levee", "ok"]);
      expect(journalEcrit).toHaveLength(1);
      // Le verrou de ligne EST émis, une fois par levée, avant la relecture (note d'A02).
      expect(queryRaw).toHaveBeenCalledTimes(2);
      const sql = (queryRaw.mock.calls[0]![0] as readonly string[]).join("?");
      expect(sql).toMatch(/FOR UPDATE/);
      expect(sql).toMatch(/documents_generes/);
    } finally {
      (prisma as unknown as { $transaction: unknown }).$transaction = reel;
    }
  });

  it("levée concurrente à une bascule en caduque : jamais d'état mixte, dans les DEUX ordres", async () => {
    // Ordre 1 — la bascule passe d'abord : la levée relit `caduque` sous le verrou, REFUSÉE.
    findUniqueDoc.mockResolvedValue({ ...docEnAttente, etatConditionSuspensive: "caduque" });
    countLogs.mockResolvedValue(0);
    expect(await leverBlocage({ documentId: DOC, journal: journal() })).toEqual({
      ok: false,
      raison: "pas_en_attente",
    });
    expect(createLog).not.toHaveBeenCalled();

    // Ordre 2 — la levée passe d'abord, puis la bascule : la session reste BLOQUÉE
    // (la levée ne couvre plus une convention caduque).
    findManyDocs.mockResolvedValue([convention("caduque")]);
    findManyLogs.mockResolvedValue([{ targetId: DOC }]);
    expect(await blocageConditionSuspensive(SESSION)).toMatchObject({
      bloque: true,
      motif: "convention_caduque",
    });
  });
});
