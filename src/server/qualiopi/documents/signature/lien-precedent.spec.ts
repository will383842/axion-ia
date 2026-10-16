/**
 * V2-P-6 — rendre le lien de signature précédent quand le lien neuf n'arrive jamais.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  neuf: null as unknown,
  precedent: null as unknown,
  signee: 0,
  retire: 1,
  ops: [] as string[],
}));
vi.mock("@/lib/prisma", () => {
  const tx = {
    documentSignatureToken: {
      deleteMany: async () => {
        db.ops.push("supprimer-neuf");
        return { count: db.retire };
      },
      updateMany: async () => {
        db.ops.push("revoquer-neuf");
        return { count: db.retire };
      },
      update: async () => {
        db.ops.push("rendre-precedent");
        return {};
      },
    },
  };
  return {
    prisma: {
      documentSignatureToken: {
        findUnique: async () => db.neuf,
        findFirst: async () => db.precedent,
      },
      documentSignature: { count: async () => db.signee },
      $transaction: async (f: (t: typeof tx) => Promise<unknown>) => {
        const avant = db.ops.length;
        try {
          return await f(tx);
        } catch (e) {
          db.ops.splice(avant); // annulée : rien n'est écrit
          throw e;
        }
      },
    },
  };
});

import {
  MOTIF_REMPLACE,
  empreinteJeton,
  jetonDuLienSignature,
  rendreLienPrecedent,
} from "./lien-precedent";

const LIEN = "https://axion-ia.test/fr/portail/signer/abc.def";

beforeEach(() => {
  db.neuf = {
    id: "n",
    documentGenereId: "d",
    partie: "sous_traitant",
    createdAt: new Date(),
    revokedAt: null,
  };
  db.precedent = { id: "p" };
  db.signee = 0;
  db.retire = 1;
  db.ops = [];
});

describe("le lien neuf et son jeton", () => {
  it("le motif posé par l'émission est celui que l'on cherche", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "token-document.ts"), "utf8");
    expect(src).toContain(`revokedMotif: "${MOTIF_REMPLACE}"`);
  });
  it("le jeton se lit sur un lien de signature, et seulement là", () => {
    expect(jetonDuLienSignature(LIEN)).toBe("abc.def");
    expect(jetonDuLienSignature("https://x.test/fr/espace-formateur?lettre=1")).toBeNull();
    expect(jetonDuLienSignature(undefined)).toBeNull();
    expect(empreinteJeton("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("rendre le lien précédent", () => {
  it("passage : le neuf disparaît, PUIS le précédent revit (un seul vivant à la fois)", async () => {
    expect(await rendreLienPrecedent(LIEN, "supprimer")).toBe(true);
    expect(db.ops).toEqual(["supprimer-neuf", "rendre-precedent"]);
  });
  it("départ : le neuf est révoqué, le précédent revit", async () => {
    expect(await rendreLienPrecedent(LIEN, "revoquer")).toBe(true);
    expect(db.ops).toEqual(["revoquer-neuf", "rendre-precedent"]);
  });
  it("aucun précédent rendable (expiré, révoqué par l'administrateur) : rien ne bouge", async () => {
    db.precedent = null;
    expect(await rendreLienPrecedent(LIEN, "supprimer")).toBe(false);
    expect(db.ops).toEqual([]);
  });
  it("partie déjà signataire, lien inconnu ou déjà révoqué : rien ne bouge", async () => {
    db.signee = 1;
    expect(await rendreLienPrecedent(LIEN, "supprimer")).toBe(false);
    db.signee = 0;
    db.neuf = null;
    expect(await rendreLienPrecedent(LIEN, "supprimer")).toBe(false);
    expect(db.ops).toEqual([]);
  });
  it("le neuf a changé entre-temps : la transaction est annulée", async () => {
    db.retire = 0;
    await expect(rendreLienPrecedent(LIEN, "supprimer")).rejects.toThrow();
    expect(db.ops).toEqual([]);
  });
});
