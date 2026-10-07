import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Sécurité du dossier apporteur (07/10) : pièces chiffrées au repos, certificat qui dit la
// version signée, dépôt de pièce qui ne se fait pas passer pour une coupure réseau.

const h = vi.hoisted(() => ({
  contenus: new Map<string, Buffer>(),
  empreintes: new Map<string, string>(),
  temoin: null as { email: string } | null,
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(async () =>
      [...h.contenus.entries()]
        .filter(([, o]) => !o.subarray(0, 4).equals(Buffer.from("AXB1")))
        .map(([id]) => ({ piece_id: id })),
    ),
    apporteurReseau: { findFirst: vi.fn(async () => h.temoin) },
    pieceApporteurContenu: {
      findUnique: vi.fn(async (a: { where: { pieceId: string } }) => {
        const o = h.contenus.get(a.where.pieceId);
        return o ? { octets: o, piece: { sha256: h.empreintes.get(a.where.pieceId) } } : null;
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

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

beforeEach(async () => {
  vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
  h.contenus = new Map();
  h.empreintes = new Map();
  // Une adresse écrite par le SITE avec la même clé : le témoin passe.
  const { encryptPii } = await import("@/lib/pii-crypto");
  h.temoin = { email: encryptPii("claire@exemple.fr") };
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
    h.empreintes.set("p1", sha(RIB));
    h.contenus.set("p2", chiffrerContenuPiece(RIB));
    expect(await chiffrerPiecesEnClair()).toBe(1);
    expect(h.contenus.size).toBe(2);
    expect(contenuChiffre(h.contenus.get("p1")!)).toBe(true);
    expect(Buffer.from(lireContenuPiece(h.contenus.get("p1")!)).equals(RIB)).toBe(true);
    expect(await chiffrerPiecesEnClair()).toBe(0);
  });

  it("témoin : une valeur du site que cette clé ne lit pas → arrêt, rien n'est écrit", async () => {
    const { encryptPii } = await import("@/lib/pii-crypto");
    vi.stubEnv("PII_ENCRYPTION_KEY", "b".repeat(64));
    h.temoin = { email: encryptPii("claire@exemple.fr") };
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    h.contenus.set("p1", RIB);
    h.empreintes.set("p1", sha(RIB));
    expect(await chiffrerPiecesEnClair()).toBe(0);
    expect(h.contenus.get("p1")!.equals(RIB)).toBe(true);
  });

  it("empreinte relue différente de celle du dépôt : la pièce est laissée telle quelle", async () => {
    h.contenus.set("p1", RIB);
    h.empreintes.set("p1", "0".repeat(64));
    expect(await chiffrerPiecesEnClair()).toBe(0);
    expect(h.contenus.get("p1")!.equals(RIB)).toBe(true);
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
