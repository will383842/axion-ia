/**
 * Audit S1 — `rendreLienPrecedent` ne rend que le lien REMPLACÉ PAR le lien neuf.
 * Faux Prisma en mémoire : les filtres sont réellement appliqués.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = {
  id: string;
  documentGenereId: string;
  partie: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedMotif: string | null;
  revokedById: string | null;
  usedAt: Date | null;
};

const db = vi.hoisted(() => ({
  lignes: [] as unknown[],
  signees: 0,
}));

vi.mock("@/lib/prisma", () => {
  const egal = (a: unknown, b: unknown): boolean =>
    a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
  const num = (v: unknown): number => (v instanceof Date ? v.getTime() : (v as number));
  const champ = (v: unknown, cond: unknown): boolean => {
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>;
      if ("not" in c && (c["not"] === null ? v === null : egal(v, c["not"]))) return false;
      if ("gt" in c && !(v !== null && num(v) > num(c["gt"]))) return false;
      if ("gte" in c && !(v !== null && num(v) >= num(c["gte"]))) return false;
      if ("lt" in c && !(v !== null && num(v) < num(c["lt"]))) return false;
      if ("lte" in c && !(v !== null && num(v) <= num(c["lte"]))) return false;
      return true;
    }
    return egal(v, cond);
  };
  const correspond = (l: Record<string, unknown>, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([k, cond]) => champ(l[k], cond));
  const api = (
    get: () => Record<string, unknown>[],
    set: (v: Record<string, unknown>[]) => void,
  ) => ({
    findUnique: async ({ where }: { where: Record<string, unknown> }) =>
      get().find((l) => correspond(l, where)) ?? null,
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      [...get()]
        .sort((a, b) => num(b["createdAt"]) - num(a["createdAt"]))
        .find((l) => correspond(l, where)) ?? null,
    findMany: async ({ where, take }: { where: Record<string, unknown>; take?: number }) =>
      [...get()]
        .filter((l) => correspond(l, where))
        .sort((a, b) => num(b["createdAt"]) - num(a["createdAt"]))
        .slice(0, take),
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const cibles = get().filter((l) => correspond(l, where));
      cibles.forEach((l) => Object.assign(l, data));
      return { count: cibles.length };
    },
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      const cibles = get().filter((l) => correspond(l, where));
      set(get().filter((l) => !cibles.includes(l)));
      return { count: cibles.length };
    },
    update: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const l = get().find((x) => correspond(x, where));
      if (!l) throw new Error("introuvable");
      Object.assign(l, data);
      return l;
    },
  });
  const lignes = () => db.lignes as Record<string, unknown>[];
  return {
    prisma: {
      documentSignatureToken: api(lignes, (v) => {
        db.lignes = v;
      }),
      documentSignature: { count: async () => db.signees },
      $transaction: async (f: (t: unknown) => Promise<unknown>) => {
        const copie = lignes().map((l) => ({ ...l }));
        let courant = copie;
        const tx = {
          documentSignatureToken: api(
            () => courant,
            (v) => {
              courant = v;
            },
          ),
        };
        const r = await f(tx);
        db.lignes = courant;
        return r;
      },
    },
  };
});

import {
  MOTIF_RELANCE_NON_PARTIE,
  MOTIF_REMPLACE,
  empreinteJeton,
  rendreLienPrecedent,
} from "./lien-precedent";

const H = 3_600_000;
const t1 = new Date("2026-11-20T08:00:00.000Z");
const t2 = new Date(t1.getTime() + H);
const t3 = new Date(t2.getTime() + H);
const apres = new Date(t3.getTime() + 60_000);
const MOTIF_ADMIN = "Erreur de destinataire";
const ADMIN = "00000000-0000-4000-8000-000000000001";

const lien = (j: string) => `https://axion-ia.test/fr/portail/signer/${j}`;
const lignes = () => db.lignes as Ligne[];
const get = (j: string) => lignes().find((l) => l.tokenHash === empreinteJeton(j));

function jeton(j: string, o: Partial<Ligne> & { createdAt: Date }): Ligne {
  return {
    id: j,
    documentGenereId: "doc",
    partie: "client",
    tokenHash: empreinteJeton(j),
    expiresAt: new Date(o.createdAt.getTime() + 30 * 24 * H),
    revokedAt: null,
    revokedMotif: null,
    revokedById: null,
    usedAt: null,
    ...o,
  };
}
const remplace = (j: string, created: Date, par: Date, o: Partial<Ligne> = {}) =>
  jeton(j, { createdAt: created, revokedAt: par, revokedMotif: MOTIF_REMPLACE, ...o });

function aucunDoubleVivant() {
  const vivants = new Map<string, number>();
  for (const l of lignes()) {
    if (l.revokedAt === null) {
      const k = `${l.documentGenereId}/${l.partie}`;
      vivants.set(k, (vivants.get(k) ?? 0) + 1);
    }
  }
  for (const n of vivants.values()) expect(n).toBeLessThanOrEqual(1);
}

beforeEach(() => {
  db.lignes = [];
  db.signees = 0;
});

describe("rendreLienPrecedent — exactement le lien remplacé par le lien neuf", () => {
  it("T1 remplacé par T2, T2 révoqué par l'administrateur, T3 annulé : T1 reste mort", async () => {
    db.lignes = [
      remplace("T1", t1, t2),
      jeton("T2", { createdAt: t2, revokedAt: t3, revokedMotif: MOTIF_ADMIN, revokedById: ADMIN }),
      jeton("T3", { createdAt: t3 }),
    ];
    expect(await rendreLienPrecedent(lien("T3"), "revoquer", apres)).toBe(false);
    expect(get("T1")!.revokedAt).not.toBeNull();
    expect(get("T3")!.revokedAt).toBeNull();
    aucunDoubleVivant();
  });

  it("lien intermédiaire expiré : le lien plus ancien n'est pas ressuscité", async () => {
    db.lignes = [
      remplace("T1", t1, t2),
      remplace("T2", t2, t3, { expiresAt: new Date(t3.getTime() - 1) }),
      jeton("T3", { createdAt: t3 }),
    ];
    expect(await rendreLienPrecedent(lien("T3"), "revoquer", apres)).toBe(false);
    expect(get("T1")!.revokedAt).not.toBeNull();
    expect(get("T2")!.revokedAt).not.toBeNull();
    aucunDoubleVivant();
  });

  it("lien intermédiaire révoqué par une révision de devis : rien n'est rendu", async () => {
    db.lignes = [
      remplace("T1", t1, t2),
      jeton("T2", {
        createdAt: t2,
        revokedAt: t3,
        revokedMotif: "Devis révisé — remplacé par DEV-2",
      }),
      jeton("T3", { createdAt: t3 }),
    ];
    expect(await rendreLienPrecedent(lien("T3"), "revoquer", apres)).toBe(false);
    expect(get("T1")!.revokedAt).not.toBeNull();
    aucunDoubleVivant();
  });

  it("le lien remplacé par CE lien est rendu (mode revoquer)", async () => {
    db.lignes = [remplace("T2", t2, t3), jeton("T3", { createdAt: t3 })];
    expect(await rendreLienPrecedent(lien("T3"), "revoquer", apres)).toBe(true);
    expect(get("T2")!.revokedAt).toBeNull();
    expect(get("T2")!.revokedMotif).toBeNull();
    expect(get("T3")!.revokedAt).not.toBeNull();
    expect(get("T3")!.revokedMotif).toBe(MOTIF_RELANCE_NON_PARTIE);
    aucunDoubleVivant();
  });

  it("mode supprimer : le neuf disparaît, le remplacé revit", async () => {
    db.lignes = [remplace("T2", t2, t3), jeton("T3", { createdAt: t3 })];
    expect(await rendreLienPrecedent(lien("T3"), "supprimer", apres)).toBe(true);
    expect(get("T3")).toBeUndefined();
    expect(get("T2")!.revokedAt).toBeNull();
    aucunDoubleVivant();
  });

  it("autre partie : jamais rendue", async () => {
    db.lignes = [remplace("T2", t2, t3, { partie: "axionia" }), jeton("T3", { createdAt: t3 })];
    expect(await rendreLienPrecedent(lien("T3"), "revoquer", apres)).toBe(false);
    expect(get("T2")!.revokedAt).not.toBeNull();
    aucunDoubleVivant();
  });

  it("ancien jeton (avant correctif) : revokedAt différent de createdAt d'une milliseconde, rien n'est rendu", async () => {
    db.lignes = [remplace("T2", t2, new Date(t3.getTime() - 1)), jeton("T3", { createdAt: t3 })];
    expect(await rendreLienPrecedent(lien("T3"), "revoquer", apres)).toBe(false);
    expect(get("T2")!.revokedAt).not.toBeNull();
    aucunDoubleVivant();
  });

  it("deux candidats au même instant : rien n'est rendu", async () => {
    db.lignes = [remplace("A", t1, t3), remplace("B", t2, t3), jeton("T3", { createdAt: t3 })];
    expect(await rendreLienPrecedent(lien("T3"), "revoquer", apres)).toBe(false);
    expect(get("A")!.revokedAt).not.toBeNull();
    expect(get("B")!.revokedAt).not.toBeNull();
    expect(get("T3")!.revokedAt).toBeNull();
  });

  it("partie déjà signataire : rien n'est rendu", async () => {
    db.signees = 1;
    db.lignes = [remplace("T2", t2, t3), jeton("T3", { createdAt: t3 })];
    expect(await rendreLienPrecedent(lien("T3"), "revoquer", apres)).toBe(false);
    expect(get("T2")!.revokedAt).not.toBeNull();
    aucunDoubleVivant();
  });

  it("lien remplacé expiré : rien n'est rendu", async () => {
    db.lignes = [
      remplace("T2", t2, t3, { expiresAt: new Date(apres.getTime() - 1) }),
      jeton("T3", { createdAt: t3 }),
    ];
    expect(await rendreLienPrecedent(lien("T3"), "revoquer", apres)).toBe(false);
    expect(get("T2")!.revokedAt).not.toBeNull();
    aucunDoubleVivant();
  });
});
