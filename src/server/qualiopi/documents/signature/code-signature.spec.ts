/**
 * Lot S6a (e) — le code à usage unique, contre une table EN MÉMOIRE qui
 * reproduit la sémantique des écritures conditionnelles (`updateMany`).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Ligne {
  id: string;
  documentGenereId: string;
  partie: string;
  codeHash: string;
  expiresAt: Date;
  essais: number;
  utiliseAt: Date | null;
  invalideAt: Date | null;
  createdAt: Date;
}

const table: Ligne[] = [];

type Filtre = Record<string, unknown>;
function correspond(l: Ligne, w: Filtre): boolean {
  return Object.entries(w).every(([k, v]) => {
    const val = (l as unknown as Record<string, unknown>)[k];
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      const o = v as { lt?: number; gt?: Date };
      if (o.lt !== undefined) return (val as number) < o.lt;
      if (o.gt !== undefined) return (val as Date).getTime() > o.gt.getTime();
    }
    return val === v;
  });
}

vi.mock("@/lib/prisma", () => {
  const documentSignatureCode = {
    create: async ({
      data,
    }: {
      data: Omit<Ligne, "essais" | "utiliseAt" | "invalideAt" | "createdAt">;
    }) => {
      const l = {
        ...data,
        essais: 0,
        utiliseAt: null,
        invalideAt: null,
        createdAt: new Date(Date.now() + table.length),
      };
      table.push(l);
      return l;
    },
    updateMany: async ({ where, data }: { where: Filtre; data: Record<string, unknown> }) => {
      let count = 0;
      for (const l of table) {
        if (!correspond(l, where)) continue;
        count++;
        for (const [k, v] of Object.entries(data)) {
          const r = l as unknown as Record<string, unknown>;
          r[k] =
            typeof v === "object" && v !== null && "increment" in v
              ? (r[k] as number) + (v as { increment: number }).increment
              : v;
        }
      }
      return { count };
    },
    findFirst: async ({ where }: { where: Filtre }) =>
      [...table].reverse().find((l) => correspond(l, where)) ?? null,
  };
  return {
    prisma: {
      documentSignatureCode,
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    },
  };
});

import {
  CODE_ESSAIS_MAX,
  emettreCodeSignature,
  empreinteCode,
  MESSAGE_CODE_REFUSE,
  tirerCode,
  verifierCodeSignature,
} from "./code-signature";

const DOC = "55555555-5555-4555-8555-555555555555";
const T0 = new Date("2026-10-10T10:00:00Z");
const base = { documentGenereId: DOC, partie: "sous_traitant" as const };

function faux(code: string): string {
  return code === "000000" ? "000001" : "000000";
}

beforeEach(() => {
  table.length = 0;
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-pour-hmac";
});

describe("émission", () => {
  it("six chiffres, zéros de tête compris", () => {
    for (let i = 0; i < 200; i++) expect(tirerCode()).toMatch(/^\d{6}$/);
  });

  it("le code n'est JAMAIS stocké en clair, seulement son HMAC", async () => {
    const { code } = await emettreCodeSignature({ ...base, maintenant: T0 });
    expect(table).toHaveLength(1);
    expect(JSON.stringify(table)).not.toContain(`"${code}"`);
    expect(table[0]!.codeHash).toBe(empreinteCode(table[0]!.id, code));
    expect(table[0]!.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("valable 10 minutes", async () => {
    const { expiresAt } = await emettreCodeSignature({ ...base, maintenant: T0 });
    expect(expiresAt.getTime() - T0.getTime()).toBe(10 * 60 * 1000);
  });

  it("sans secret serveur, l'émission est REFUSÉE (garde fermée)", async () => {
    delete process.env["AUTH_SECRET"];
    await expect(emettreCodeSignature({ ...base, maintenant: T0 })).rejects.toThrow();
    expect(table).toHaveLength(0);
  });

  it("émettre un nouveau code invalide le précédent", async () => {
    const premier = await emettreCodeSignature({ ...base, maintenant: T0 });
    await emettreCodeSignature({ ...base, maintenant: T0 });
    expect(await verifierCodeSignature({ ...base, code: premier.code, maintenant: T0 })).toEqual({
      ok: false,
      message: MESSAGE_CODE_REFUSE,
    });
  });
});

describe("vérification", () => {
  it("le bon code passe une fois, puis plus jamais (usage unique)", async () => {
    const { code } = await emettreCodeSignature({ ...base, maintenant: T0 });
    expect(await verifierCodeSignature({ ...base, code, maintenant: T0 })).toEqual({ ok: true });
    expect((await verifierCodeSignature({ ...base, code, maintenant: T0 })).ok).toBe(false);
  });

  it("expiré après 10 minutes", async () => {
    const { code } = await emettreCodeSignature({ ...base, maintenant: T0 });
    const apres = new Date(T0.getTime() + 10 * 60 * 1000 + 1);
    expect((await verifierCodeSignature({ ...base, code, maintenant: apres })).ok).toBe(false);
  });

  it(`${CODE_ESSAIS_MAX} essais au plus : même le bon code est refusé ensuite`, async () => {
    const { code } = await emettreCodeSignature({ ...base, maintenant: T0 });
    for (let i = 0; i < CODE_ESSAIS_MAX; i++) {
      expect((await verifierCodeSignature({ ...base, code: faux(code), maintenant: T0 })).ok).toBe(
        false,
      );
    }
    expect(table[0]!.invalideAt).not.toBeNull();
    expect((await verifierCodeSignature({ ...base, code, maintenant: T0 })).ok).toBe(false);
  });

  it("un code d'une autre partie ou d'une autre pièce ne passe pas", async () => {
    const { code } = await emettreCodeSignature({ ...base, maintenant: T0 });
    expect(
      (await verifierCodeSignature({ ...base, partie: "client", code, maintenant: T0 })).ok,
    ).toBe(false);
    expect(
      (
        await verifierCodeSignature({
          ...base,
          documentGenereId: "66666666-6666-4666-8666-666666666666",
          code,
          maintenant: T0,
        })
      ).ok,
    ).toBe(false);
  });

  it("refus UNIFORMES : faux, expiré, épuisé, inexistant ou mal formé disent la même chose", async () => {
    const attendu = { ok: false, message: MESSAGE_CODE_REFUSE };
    expect(await verifierCodeSignature({ ...base, code: "123456", maintenant: T0 })).toEqual(
      attendu,
    );
    expect(await verifierCodeSignature({ ...base, code: "12a456", maintenant: T0 })).toEqual(
      attendu,
    );
    const { code } = await emettreCodeSignature({ ...base, maintenant: T0 });
    expect(await verifierCodeSignature({ ...base, code: faux(code), maintenant: T0 })).toEqual(
      attendu,
    );
  });

  it("la comparaison se fait à temps constant (timingSafeEqual)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(__dirname, "code-signature.ts"), "utf8");
    expect(source).toMatch(/timingSafeEqual\(/);
    expect(source).not.toMatch(/codeHash\s*===|===\s*ligne\.codeHash/);
  });
});
