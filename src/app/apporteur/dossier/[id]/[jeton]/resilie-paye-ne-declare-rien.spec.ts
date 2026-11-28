import { beforeEach, describe, expect, it, vi } from "vitest";

// PR K (#2464) : en archive (résilié, payé), toute écriture est refusée côté serveur.
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  lireDossierParLien: vi.fn(),
  deposerPiece: vi.fn(),
  enregistrerActivite: vi.fn(),
  enregistrerDeclarations: vi.fn(),
}));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  TAILLE_MAX_PIECE: 10 * 1024 * 1024,
  deposerPiece: (...a: unknown[]) => h.deposerPiece(...a),
  enregistrerActivite: (...a: unknown[]) => h.enregistrerActivite(...a),
  enregistrerDeclarations: (...a: unknown[]) => h.enregistrerDeclarations(...a),
  lireDossierParLien: (...a: unknown[]) => h.lireDossierParLien(...a),
}));
vi.mock("@/features/apporteurs-reseau/annuaire", () => ({ lireEntrepriseParSiren: vi.fn() }));
vi.mock("@/features/apporteurs-reseau/signature", async () => {
  const regles = await import("@/features/apporteurs-reseau/signature-regles");
  return { ...regles, signerContrat: vi.fn() };
});
vi.mock("@/lib/client-ip", () => ({
  getClientIp: async () => "203.0.113.9",
  getClientUserAgent: async () => null,
}));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash" }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { deposerPieceAction, enregistrerActiviteAction } from "./actions";
import { peutLireSesPieces } from "@/features/apporteurs-reseau/acces-pieces";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JETON = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";
const ARCHIVE = {
  id: ID,
  statut: "resilie" as const,
  restreint: true as const,
  archive: true as const,
  pieces: [],
};

function depot(type: string): FormData {
  const fichier = new File([new Uint8Array([37, 80, 68, 70])], "p.pdf", {
    type: "application/pdf",
  });
  Object.defineProperty(fichier, "arrayBuffer", {
    value: async () => new Uint8Array([37, 80, 68, 70]).buffer,
  });
  const champs: Record<string, unknown> = { id: ID, jeton: JETON, type, fichier };
  return { get: (k: string) => champs[k] ?? null, getAll: () => [] } as unknown as FormData;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.lireDossierParLien.mockResolvedValue(ARCHIVE);
});

describe("archive : aucune écriture", () => {
  it.each(["vigilance", "immatriculation", "rib", "identite", "rc_pro"])(
    "dépôt de « %s » : refusé, rien n'est écrit",
    async (t) => {
      expect((await deposerPieceAction(depot(t))).ok).toBe(false);
      expect(h.deposerPiece).not.toHaveBeenCalled();
    },
  );

  it("activité : refusée", async () => {
    const fd = new FormData();
    fd.set("id", ID);
    fd.set("jeton", JETON);
    expect((await enregistrerActiviteAction(fd)).ok).toBe(false);
    expect(h.enregistrerActivite).not.toHaveBeenCalled();
  });

  it("déclaration, compte bancaire, outils, challenge : gardes sources inchangés (restreint ⇒ refus)", async () => {
    const { readFileSync } = await import("node:fs");
    const base = "src/app/apporteur/dossier/[id]/[jeton]/";
    for (const f of [
      "actions-declaration.ts",
      "actions-compte.ts",
      "outils/page.tsx",
      "challenge/reglements/page.tsx",
      "challenge/reglement/[challengeId]/page.tsx",
    ]) {
      expect(readFileSync(base + f, "utf8"), f).toMatch(/dossier\.restreint|d\.restreint/);
    }
    expect(peutLireSesPieces(ARCHIVE)).toBe(true); // la lecture reste ouverte, seule elle
  });
});
