import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Sécurité du dossier apporteur (07/10) : pièces chiffrées au repos, certificat qui dit la
// version signée, dépôt de pièce qui ne se fait pas passer pour une coupure réseau.

const h = vi.hoisted(() => ({
  contenus: new Map<string, Buffer>(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(async () =>
      [...h.contenus.entries()]
        .filter(([, o]) => !o.subarray(0, 4).equals(Buffer.from("AXB1")))
        .map(([id]) => ({ piece_id: id })),
    ),
    pieceApporteurContenu: {
      findUnique: vi.fn(async (a: { where: { pieceId: string } }) => {
        const o = h.contenus.get(a.where.pieceId);
        return o ? { octets: o } : null;
      }),
      updateMany: vi.fn(
        async (a: {
          where: { pieceId: string; octets: { equals: Buffer } };
          data: { octets: Buffer };
        }) => {
          const o = h.contenus.get(a.where.pieceId);
          if (!o || !o.equals(a.where.octets.equals)) return { count: 0 };
          h.contenus.set(a.where.pieceId, a.data.octets);
          return { count: 1 };
        },
      ),
    },
  },
}));

import {
  chiffrerContenuPiece,
  chiffrerPiecesEnClair,
  contenuChiffre,
  lireContenuPiece,
} from "../pieces-chiffrement";

const RIB = Buffer.from("%PDF-1.7 RIB FR76 3000 6000 0112 3456 7890 189");

beforeEach(() => {
  vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
  h.contenus = new Map();
});

describe("1) pièces chiffrées au repos", () => {
  it("le contenu écrit n'est plus le clair, et se relit à l'identique", () => {
    const stocke = chiffrerContenuPiece(RIB);
    expect(contenuChiffre(stocke)).toBe(true);
    expect(stocke.includes(Buffer.from("FR76"))).toBe(false);
    expect(Buffer.from(lireContenuPiece(stocke)).equals(RIB)).toBe(true);
  });

  it("une ancienne pièce en clair reste lisible le temps du rattrapage", () => {
    expect(Buffer.from(lireContenuPiece(RIB)).equals(RIB)).toBe(true);
  });

  it("sans clé : refus, jamais de repli en clair", () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    expect(() => chiffrerContenuPiece(RIB)).toThrow();
  });

  it("le dépôt écrit le contenu CHIFFRÉ", () => {
    const src = readFileSync(resolve(__dirname, "../donnees.ts"), "utf8");
    expect(src).toContain("octets: chiffrerContenuPiece(octets)");
    expect(src).not.toContain("octets: Buffer.from(octets)");
  });

  it("rattrapage : chiffre les pièces en clair, sans rien effacer, et ne rechiffre jamais", async () => {
    h.contenus.set("p1", RIB);
    h.contenus.set("p2", chiffrerContenuPiece(RIB));
    expect(await chiffrerPiecesEnClair()).toBe(1);
    expect(h.contenus.size).toBe(2);
    expect(contenuChiffre(h.contenus.get("p1")!)).toBe(true);
    expect(Buffer.from(lireContenuPiece(h.contenus.get("p1")!)).equals(RIB)).toBe(true);
    expect(await chiffrerPiecesEnClair()).toBe(0);
  });
});

describe("2) le certificat du PDF dit la version signée", () => {
  it("plus de « version 2 » écrit en dur ; la signature enregistre sa version", () => {
    const pdf = readFileSync(resolve(__dirname, "../contrat-pdf.tsx"), "utf8");
    expect(pdf).not.toMatch(/affaires, version 2, et ses annexes/);
    expect(pdf).toContain("version {version}");
    const sig = readFileSync(resolve(__dirname, "../signature.ts"), "utf8");
    expect(sig).toContain("version: CONTRAT_VERSION");
  });
});

describe("4) dépôt de pièce : une panne serveur est dite comme telle", () => {
  it("try/catch, Sentry, message exact", () => {
    const src = readFileSync(
      resolve(__dirname, "../../../app/apporteur/dossier/[id]/[jeton]/actions.ts"),
      "utf8",
    );
    expect(src).toContain("n'a pas pu être enregistré de notre côté");
    expect(src).toMatch(/etape: "depot-piece"/);
  });
});
