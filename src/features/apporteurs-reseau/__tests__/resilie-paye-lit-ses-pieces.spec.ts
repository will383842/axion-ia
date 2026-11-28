import { beforeEach, describe, expect, it, vi } from "vitest";

// PR K (2464) : un apporteur RÉSILIÉ et payé garde la lecture de SES pièces.
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  retraitDe: vi.fn(async () => null as Date | null),
  argentEnJeu: vi.fn(async () => false),
  lireDossierParLien: vi.fn(),
  numeroDePiece: vi.fn(),
  getObjectBufferR2: vi.fn(),
  lireContratPdf: vi.fn(),
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => (v ? v.replace(/^enc:/, "") : null),
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "e" }));
vi.mock("@/server/careers/clamav", () => ({ analyserOctets: vi.fn() }));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("../retrait", () => ({
  retraitDe: (...a: unknown[]) => h.retraitDe(...(a as [])),
  argentEnJeu: (...a: unknown[]) => h.argentEnJeu(...(a as [])),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: { findUnique: (...a: unknown[]) => h.findUnique(...a) },
    apporteurReseauSiret: { findUnique: async () => null },
  },
}));

import { lireDossierParLien } from "../donnees";
import { jetonDossier } from "../jeton";
import { peutLireSesPieces } from "../acces-pieces";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const LIGNE = {
  id: ID,
  statut: "resilie",
  versionLien: 3,
  prenom: "enc:Claire",
  nom: "enc:Durand",
  email: "enc:c@exemple.fr",
  telephone: null,
  siren: null,
  denomination: null,
  adresse: null,
  codeNaf: null,
  statutJuridique: null,
  regimeTva: null,
  numeroTva: null,
  iban: null,
  declarations: null,
  dernierMessage: null,
  signeParApporteurAt: new Date(),
  signeParSocieteAt: new Date(),
  contratSigneCle: "cle",
  pieces: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.findUnique.mockResolvedValue(LIGNE);
  h.retraitDe.mockResolvedValue(null);
  h.argentEnJeu.mockResolvedValue(false);
});

describe("accès aux pièces d'un résilié payé", () => {
  it("lien valide, résilié, rien en jeu → archive (restreint, lecture seule)", async () => {
    const vue = await lireDossierParLien(ID, jetonDossier(ID, 3)!);
    expect(vue).toMatchObject({ archive: true, restreint: true, statut: "resilie" });
    expect(peutLireSesPieces(vue!)).toBe(true);
  });

  it("lien valide, résilié, argent en jeu → restreint sans archive, pièces lisibles", async () => {
    h.argentEnJeu.mockResolvedValue(true);
    const vue = await lireDossierParLien(ID, jetonDossier(ID, 3)!);
    expect(vue!.restreint).toBe(true);
    expect(vue!.archive).toBeUndefined();
    expect(peutLireSesPieces(vue!)).toBe(true);
  });

  it("mauvais jeton → null", async () => {
    expect(await lireDossierParLien(ID, jetonDossier(ID, 2)!)).toBeNull();
  });

  it("garde pur : signé libre oui ; signé restreint (retiré) non ; autres statuts non", () => {
    expect(peutLireSesPieces({ statut: "signe" })).toBe(true);
    expect(peutLireSesPieces({ statut: "signe", restreint: true })).toBe(false);
    expect(peutLireSesPieces({ statut: "resilie", restreint: true, archive: true })).toBe(true);
    for (const s of ["dossier_en_cours", "a_completer", "a_verifier", "refuse"] as const)
      expect(peutLireSesPieces({ statut: s })).toBe(false);
  });
});

describe("routes en archive", () => {
  const ARCHIVE = {
    id: ID,
    statut: "resilie",
    restreint: true,
    archive: true,
    aContratSigne: true,
  };

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/features/apporteurs-reseau/donnees", () => ({
      lireDossierParLien: (...a: unknown[]) => h.lireDossierParLien(...a),
    }));
    vi.doMock("@/features/apporteurs-reseau/espace-commissions", () => ({
      NUMERO_PIECE: /^AXI-APP-\d{4}-\d{4,}$/,
      NUMERO_PIECE_MAX: 40,
      numeroDePieceDeLApporteur: (...a: unknown[]) => h.numeroDePiece(...a),
    }));
    vi.doMock("@/lib/r2-storage", () => ({
      getObjectBufferR2: (...a: unknown[]) => h.getObjectBufferR2(...a),
    }));
    vi.doMock("@/features/apporteurs-reseau/verification", () => ({
      lireContratPdf: (...a: unknown[]) => h.lireContratPdf(...a),
    }));
    vi.doMock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
    vi.doMock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash" }));
    vi.doMock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
    process.env.APPORTEUR_MES_COMMISSIONS_ENABLED = "true";
    h.lireDossierParLien.mockResolvedValue(ARCHIVE);
    h.numeroDePiece.mockImplementation(async (_i: string, n: string) =>
      n.endsWith("0014") ? n : null,
    );
    h.getObjectBufferR2.mockResolvedValue(Buffer.from("%PDF"));
    h.lireContratPdf.mockResolvedValue(Buffer.from("%PDF-signe"));
  });

  const ctx = (numero = "") => ({
    params: Promise.resolve({ id: ID, jeton: "j".repeat(43), numero }),
  });

  it("sa facture → 200", async () => {
    const { GET } = await import("@/app/apporteur/dossier/[id]/[jeton]/factures/[numero]/route");
    const r = await GET(new Request("https://axion-ia.com/x"), ctx("AXI-APP-2026-0014"));
    expect(r.status).toBe(200);
  });

  it("la facture d'un autre → 404, R2 jamais lu", async () => {
    const { GET } = await import("@/app/apporteur/dossier/[id]/[jeton]/factures/[numero]/route");
    const r = await GET(new Request("https://axion-ia.com/x"), ctx("AXI-APP-2026-0099"));
    expect(r.status).toBe(404);
    expect(h.getObjectBufferR2).not.toHaveBeenCalled();
  });

  it("son contrat signé → 200", async () => {
    const { GET } = await import("@/app/apporteur/dossier/[id]/[jeton]/contrat/route");
    const r = await GET(new Request("https://axion-ia.com/x?dl=1"), ctx());
    expect(r.status).toBe(200);
    expect(h.lireContratPdf).toHaveBeenCalledWith(ID, "signe");
  });

  it("retiré avec argent (signé + restreint) : ni facture ni contrat", async () => {
    h.lireDossierParLien.mockResolvedValue({
      id: ID,
      statut: "signe",
      restreint: true,
      aContratSigne: true,
    });
    const f = await import("@/app/apporteur/dossier/[id]/[jeton]/factures/[numero]/route");
    const c = await import("@/app/apporteur/dossier/[id]/[jeton]/contrat/route");
    expect(
      (await f.GET(new Request("https://axion-ia.com/x"), ctx("AXI-APP-2026-0014"))).status,
    ).toBe(404);
    expect((await c.GET(new Request("https://axion-ia.com/x"), ctx())).status).toBe(404);
  });
});
