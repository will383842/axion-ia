/**
 * Signature renforcée du devis — audit sécurité : le blocage ne se contourne pas en redemandant
 * un code. Compteur d'échecs CUMULÉ par (pièce, partie) ; code lié au lien (jetonId).
 *
 * Tables EN MÉMOIRE reproduisant la sémantique des écritures conditionnelles de Prisma.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { codes, echecs, fabrique } = vi.hoisted(() => {
  type L = Record<string, unknown>;
  const codes: L[] = [];
  const echecs: L[] = [];
  let seq = 0;

  function correspond(l: L, w: Record<string, unknown>): boolean {
    return Object.entries(w).every(([k, v]) => {
      const val = l[k];
      if (v !== null && typeof v === "object" && !(v instanceof Date)) {
        const o = v as { lt?: unknown; lte?: unknown; gt?: unknown; gte?: unknown };
        const n = (x: unknown): number => (x instanceof Date ? x.getTime() : (x as number));
        if (val === null || val === undefined) return false;
        if (o.lt !== undefined) return n(val) < n(o.lt);
        if (o.lte !== undefined) return n(val) <= n(o.lte);
        if (o.gt !== undefined) return n(val) > n(o.gt);
        if (o.gte !== undefined) return n(val) >= n(o.gte);
      }
      if (v instanceof Date) return val instanceof Date && val.getTime() === v.getTime();
      return val === v;
    });
  }

  function appliquer(l: L, data: Record<string, unknown>): void {
    for (const [k, v] of Object.entries(data)) {
      l[k] =
        typeof v === "object" && v !== null && "increment" in v
          ? (l[k] as number) + (v as { increment: number }).increment
          : v;
    }
  }

  function table(t: L[], defauts: () => L) {
    return {
      create: async ({ data }: { data: L }) => {
        const l = { ...defauts(), ...data };
        t.push(l);
        return l;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: L }) => {
        let count = 0;
        for (const l of t) {
          if (!correspond(l, where)) continue;
          count++;
          appliquer(l, data);
        }
        return { count };
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        [...t].reverse().find((l) => correspond(l, where)) ?? null,
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        const w =
          (where["documentGenereId_partie"] as Record<string, unknown> | undefined) ?? where;
        return t.find((l) => correspond(l, w)) ?? null;
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const avant = t.length;
        for (let i = t.length - 1; i >= 0; i--) if (correspond(t[i]!, where)) t.splice(i, 1);
        return { count: avant - t.length };
      },
    };
  }

  return {
    codes,
    echecs,
    fabrique: () => ({
      documentSignatureCode: table(codes, () => ({
        essais: 0,
        utiliseAt: null,
        invalideAt: null,
        bloqueJusquA: null,
        jetonId: null,
        createdAt: new Date(Date.now() + seq++),
      })),
      documentSignatureEchecs: table(echecs, () => ({
        id: `e${seq++}`,
        echecs: 0,
        bloqueJusquA: null,
      })),
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    }),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: fabrique() }));

import {
  CODE_DEVIS_BLOCAGE_MS,
  CODE_DEVIS_ECHECS_CUMULES_FENETRE_MS,
  CODE_DEVIS_ECHECS_CUMULES_MAX,
  CODE_DEVIS_VALIDITE_MS,
} from "@/server/qualiopi/devis/signature-renforcee";
import { emettreCodeSignature, MESSAGE_CODE_BLOQUE, verifierCodeSignature } from "./code-signature";
import { reinitialiserEchecsSignature } from "./echecs-cumules";

const DOC = "66666666-6666-4666-8666-666666666666";
const LIEN_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LIEN_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const T0 = new Date("2026-11-07T10:00:00Z");
const base = { documentGenereId: DOC, partie: "client" as const };
const renforce = {
  blocageMs: CODE_DEVIS_BLOCAGE_MS,
  echecsCumules: {
    max: CODE_DEVIS_ECHECS_CUMULES_MAX,
    fenetreMs: CODE_DEVIS_ECHECS_CUMULES_FENETRE_MS,
  },
};
const faux = (c: string): string => (c === "000000" ? "000001" : "000000");
const apres = (ms: number): Date => new Date(T0.getTime() + ms);

/** Émet un code et le rate `n` fois (jamais plus de 4 par code : le plafond par code reste muet). */
async function rater(n: number, at: Date, jetonId = LIEN_A): Promise<string> {
  let dernier = "";
  let restant = n;
  while (restant > 0) {
    const e = await emettreCodeSignature({
      ...base,
      maintenant: at,
      validiteMs: CODE_DEVIS_VALIDITE_MS,
      jetonId,
    });
    dernier = e.code;
    for (let i = 0; i < Math.min(4, restant); i++) {
      await verifierCodeSignature({ ...base, code: faux(e.code), maintenant: at, ...renforce });
    }
    restant -= 4;
  }
  return dernier;
}

beforeEach(() => {
  codes.length = 0;
  echecs.length = 0;
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-pour-hmac";
});

describe("échecs cumulés par pièce (audit : contournement par nouveau code)", () => {
  it("redemander un code après 4 échecs ne remet PAS le compteur à zéro", async () => {
    await rater(4, T0);
    const e2 = await emettreCodeSignature({ ...base, maintenant: T0, jetonId: LIEN_A });
    for (let i = 0; i < 4; i++) {
      await verifierCodeSignature({ ...base, code: faux(e2.code), maintenant: T0, ...renforce });
    }
    // 8 échecs cumulés : encore sous 10.
    expect(echecs[0]!["echecs"]).toBe(8);
  });

  it("le 10e échec cumulé (sur plusieurs codes) bloque la pièce 15 min, tous codes confondus", async () => {
    let dernier = "";
    for (let i = 0; i < 3; i++) {
      dernier = await rater(i < 2 ? 4 : 2, T0);
    }
    // 4 + 4 + 2 = 10 échecs : bloqué.
    const frais = await emettreCodeSignature({ ...base, maintenant: T0, jetonId: LIEN_A });
    const r = await verifierCodeSignature({
      ...base,
      code: frais.code,
      maintenant: T0,
      ...renforce,
    });
    expect(r).toEqual({ ok: false, message: MESSAGE_CODE_BLOQUE, bloque: true });
    expect(dernier).not.toBe("");
  });

  it("le bon code est refusé tant que le blocage court, accepté ensuite", async () => {
    await rater(10, T0);
    const e = await emettreCodeSignature({ ...base, maintenant: T0, jetonId: LIEN_A });
    expect(
      (
        await verifierCodeSignature({
          ...base,
          code: e.code,
          maintenant: apres(60_000),
          ...renforce,
        })
      ).ok,
    ).toBe(false);
    const plusTard = apres(CODE_DEVIS_BLOCAGE_MS + 1_000);
    const e2 = await emettreCodeSignature({ ...base, maintenant: plusTard, jetonId: LIEN_A });
    expect(
      (await verifierCodeSignature({ ...base, code: e2.code, maintenant: plusTard, ...renforce }))
        .ok,
    ).toBe(true);
  });

  it("après le blocage, un seul nouvel échec re-bloque (le compteur n'est pas remis à zéro)", async () => {
    await rater(10, T0);
    const plusTard = apres(CODE_DEVIS_BLOCAGE_MS + 1_000);
    const e = await emettreCodeSignature({ ...base, maintenant: plusTard, jetonId: LIEN_A });
    const r = await verifierCodeSignature({
      ...base,
      code: faux(e.code),
      maintenant: plusTard,
      ...renforce,
    });
    expect(r).toMatchObject({ ok: false, bloque: true });
  });

  it("le compteur repart à zéro 24 h après le premier échec de la fenêtre", async () => {
    await rater(8, T0);
    const lendemain = apres(CODE_DEVIS_ECHECS_CUMULES_FENETRE_MS + 1_000);
    const e = await emettreCodeSignature({ ...base, maintenant: lendemain, jetonId: LIEN_A });
    await verifierCodeSignature({
      ...base,
      code: faux(e.code),
      maintenant: lendemain,
      ...renforce,
    });
    expect(echecs[0]!["echecs"]).toBe(1);
    expect(echecs[0]!["bloqueJusquA"]).toBeNull();
  });

  it("se remet à zéro après une signature réussie, pas avant", async () => {
    await rater(6, T0);
    expect(echecs).toHaveLength(1);
    await reinitialiserEchecsSignature(DOC, "client");
    expect(echecs).toHaveLength(0);
  });

  it("une autre pièce ou une autre partie n'est pas touchée", async () => {
    await rater(10, T0);
    const e = await emettreCodeSignature({
      documentGenereId: "77777777-7777-4777-8777-777777777777",
      partie: "client",
      maintenant: T0,
    });
    expect(
      (
        await verifierCodeSignature({
          documentGenereId: "77777777-7777-4777-8777-777777777777",
          partie: "client",
          code: e.code,
          maintenant: T0,
          ...renforce,
        })
      ).ok,
    ).toBe(true);
  });

  it("sans option renforcée (contrat-cadre), aucun compteur n'est tenu", async () => {
    const e = await emettreCodeSignature({ ...base, partie: "sous_traitant", maintenant: T0 });
    await verifierCodeSignature({
      ...base,
      partie: "sous_traitant",
      code: faux(e.code),
      maintenant: T0,
    });
    expect(echecs).toHaveLength(0);
  });
});

describe("code lié au lien (jetonId)", () => {
  it("un code émis pour le lien A ne signe pas via le lien B", async () => {
    const e = await emettreCodeSignature({ ...base, maintenant: T0, jetonId: LIEN_A });
    const viaB = await verifierCodeSignature({
      ...base,
      code: e.code,
      maintenant: T0,
      jetonId: LIEN_B,
      ...renforce,
    });
    expect(viaB.ok).toBe(false);
    const viaA = await verifierCodeSignature({
      ...base,
      code: e.code,
      maintenant: T0,
      jetonId: LIEN_A,
      ...renforce,
    });
    expect(viaA.ok).toBe(true);
  });
});
