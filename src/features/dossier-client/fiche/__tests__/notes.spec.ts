// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ajouterNote,
  basculerEpingle,
  choisirNotes,
  ErreurNoteFiche,
  lireNotes,
  type BaseNotes,
} from "../notes";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";
const PROJET = "33333333-3333-4333-8333-333333333333";
const CLE = "ab".repeat(32);
const ACTEUR = { userId: "u1", auteurLabel: "Will" };

const h = vi.hoisted(() => ({
  creations: [] as Array<Record<string, unknown>>,
  journaux: [] as Array<Record<string, unknown>>,
  maj: [] as Array<Record<string, unknown>>,
  notes: [] as Array<Record<string, unknown>>,
  projets: new Map<string, string>(),
  panneLecture: false,
}));

function fausseBase(): BaseNotes {
  const tx = {
    clientNote: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        h.creations.push(data);
        return { id: "n-1" };
      },
      updateMany: async (a: { where: { id: string; clientId: string }; data: unknown }) => {
        h.maj.push(a as unknown as Record<string, unknown>);
        const n = h.notes.find((x) => x["id"] === a.where.id && x["clientId"] === a.where.clientId);
        return { count: n ? 1 : 0 };
      },
    },
    activityLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        h.journaux.push(data);
      },
    },
  };
  return {
    projet: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const c = h.projets.get(where.id);
        return c === undefined ? null : { clientId: c };
      },
    },
    clientNote: {
      findFirst: async ({ where }: { where: { id: string; clientId: string } }) => {
        const n = h.notes.find((x) => x["id"] === where.id && x["clientId"] === where.clientId);
        return n ? { epinglee: n["epinglee"] as boolean } : null;
      },
      findMany: async () => {
        if (h.panneLecture) throw new Error("panne");
        return h.notes as never;
      },
    },
    $transaction: async (t: (tx: never) => Promise<unknown>) => t(tx as never),
  } as unknown as BaseNotes;
}

beforeEach(() => {
  h.creations.length = 0;
  h.journaux.length = 0;
  h.maj.length = 0;
  h.notes.length = 0;
  h.projets.clear();
  h.panneLecture = false;
  vi.stubEnv("PII_ENCRYPTION_KEY", CLE);
});
afterEach(() => vi.unstubAllEnvs());

describe("ajouterNote", () => {
  it("n'écrit en base que du chiffré, et la trace d'audit ne contient pas le texte", async () => {
    const texte = "Budget serré, rappeler Madame Dupont";
    await ajouterNote(fausseBase(), { clientId: CLIENT, texte, projetId: null, acteur: ACTEUR });
    expect(h.creations).toHaveLength(1);
    const c = h.creations[0]!["contenuChiffre"] as string;
    expect(c.startsWith("enc:v1:")).toBe(true);
    expect(c).not.toContain("Dupont");
    expect(JSON.stringify(h.journaux)).not.toContain("Dupont");
    expect(JSON.stringify(h.journaux)).not.toContain("Budget");
  });

  it("clé absente : erreur lisible, rien n'est écrit", async () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    const p = ajouterNote(fausseBase(), {
      clientId: CLIENT,
      texte: "secret",
      projetId: null,
      acteur: ACTEUR,
    });
    await expect(p).rejects.toBeInstanceOf(ErreurNoteFiche);
    await p.catch((e: Error) => expect(e.message).not.toContain("secret"));
    expect(h.creations).toHaveLength(0);
    expect(h.journaux).toHaveLength(0);
  });

  it("refuse une note vide ou trop longue", async () => {
    const base = fausseBase();
    for (const texte of ["   ", "x".repeat(2001)]) {
      await expect(
        ajouterNote(base, { clientId: CLIENT, texte, projetId: null, acteur: ACTEUR }),
      ).rejects.toBeInstanceOf(ErreurNoteFiche);
    }
    expect(h.creations).toHaveLength(0);
  });

  it("accepte une prestation du même client, refuse celle d'un autre client", async () => {
    h.projets.set(PROJET, CLIENT);
    await ajouterNote(fausseBase(), {
      clientId: CLIENT,
      texte: "ok",
      projetId: PROJET,
      acteur: ACTEUR,
    });
    expect(h.creations).toHaveLength(1);
    await expect(
      ajouterNote(fausseBase(), {
        clientId: AUTRE,
        texte: "non",
        projetId: PROJET,
        acteur: ACTEUR,
      }),
    ).rejects.toBeInstanceOf(ErreurNoteFiche);
    expect(h.creations).toHaveLength(1);
  });
});

describe("basculerEpingle", () => {
  it("épingle puis détache, et refuse une note d'une autre fiche", async () => {
    h.notes.push({ id: "n1", clientId: CLIENT, epinglee: false });
    const base = fausseBase();
    expect(
      (await basculerEpingle(base, { clientId: CLIENT, noteId: "n1", acteur: ACTEUR })).epinglee,
    ).toBe(true);
    h.notes[0]!["epinglee"] = true;
    expect(
      (await basculerEpingle(base, { clientId: CLIENT, noteId: "n1", acteur: ACTEUR })).epinglee,
    ).toBe(false);
    await expect(
      basculerEpingle(base, { clientId: AUTRE, noteId: "n1", acteur: ACTEUR }),
    ).rejects.toBeInstanceOf(ErreurNoteFiche);
    expect(h.journaux.map((j) => j["action"])).toEqual([
      "client.note_epinglee",
      "client.note_detachee",
    ]);
  });
});

describe("lecture", () => {
  const d = (jour: number) => new Date(Date.UTC(2026, 9, jour, 10));
  it("épinglées d'abord, puis les 3 plus récentes", () => {
    const sel = choisirNotes([
      { id: "a", epinglee: false, createdAt: d(1) },
      { id: "b", epinglee: false, createdAt: d(2) },
      { id: "c", epinglee: true, createdAt: d(3) },
      { id: "d", epinglee: false, createdAt: d(4) },
      { id: "e", epinglee: false, createdAt: d(5) },
    ]);
    expect(sel.map((n) => n.id)).toEqual(["c", "e", "d", "b"]);
  });

  it("déchiffre à la lecture ; clé absente = texte nul ; panne = ok:false", async () => {
    await ajouterNote(fausseBase(), {
      clientId: CLIENT,
      texte: "bonjour",
      projetId: null,
      acteur: ACTEUR,
    });
    h.notes.push({
      id: "n1",
      auteurLabel: "Will",
      contenuChiffre: h.creations[0]!["contenuChiffre"],
      epinglee: false,
      createdAt: d(1),
      projetId: null,
    });
    const l = await lireNotes(fausseBase(), CLIENT);
    expect(l.ok && l.notes[0]!.texte).toBe("bonjour");
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    const sansCle = await lireNotes(fausseBase(), CLIENT);
    expect(sansCle.ok && sansCle.notes[0]!.texte).toBeNull();
    h.panneLecture = true;
    expect((await lireNotes(fausseBase(), CLIENT)).ok).toBe(false);
  });
});
