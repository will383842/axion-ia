/**
 * Lot L5b (ADR 0066) — dépôt d'une pièce par le formateur indépendant, et sa
 * lecture en console.
 *
 * Tests ROUGES d'abord : aucun module n'écrivait `TrainerDocumentContenu`, et
 * aucune route ne servait une pièce déposée.
 */

import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  allume: vi.fn(),
  debit: vi.fn(),
  controler: vi.fn(),
  trainerFindUnique: vi.fn(),
  docCreate: vi.fn(),
  docFindUnique: vi.fn(),
  contenuCreate: vi.fn(),
  logCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    trainer: { findUnique: (...a: unknown[]) => m.trainerFindUnique(...a) },
    trainerDocument: {
      create: (...a: unknown[]) => m.docCreate(...a),
      findUnique: (...a: unknown[]) => m.docFindUnique(...a),
    },
    trainerDocumentContenu: { create: (...a: unknown[]) => m.contenuCreate(...a) },
    activityLog: { create: (...a: unknown[]) => m.logCreate(...a) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  };
  return { prisma: client };
});

vi.mock("../interrupteurs-envoi", () => ({ envoiAllume: (...a: unknown[]) => m.allume(...a) }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => m.debit(...a),
}));
vi.mock("@/server/pieces/depot-controle", async (orig) => {
  const vrai = await orig<typeof import("@/server/pieces/depot-controle")>();
  return {
    ...vrai,
    controlerPiece: (...a: unknown[]) => m.controler(...a),
    // Chiffrement factice et réversible : le test lit ce qui est écrit.
    chiffrerPieceAuRepos: (clair: Uint8Array) => Buffer.concat([Buffer.from("AXB1"), clair]),
  };
});
vi.mock("@/lib/pii-crypto", () => ({
  dechiffrerOctetsPii: (b: Buffer) => b.subarray(4),
}));

import { ACTION_DEPOT_FORMATEUR } from "../vigilance";
import { deposerPieceFormateur, TYPES_DEPOSABLES } from "../depot";
import { lirePieceDeposee } from "../lecture-piece";

const TRAINER = "11111111-1111-4111-8111-111111111111";
const AUTRE = "33333333-3333-4333-8333-333333333333";
const DOC = "22222222-2222-4222-8222-222222222222";
const CLAIR = Buffer.from("%PDF-1.7 contenu de test");
const SHA = createHash("sha256").update(CLAIR).digest("hex");

const depot = (over: Record<string, unknown> = {}) =>
  deposerPieceFormateur({
    trainerId: TRAINER,
    type: "cv",
    nomFichier: "cv.pdf",
    octets: new Uint8Array(CLAIR),
    ...over,
  } as Parameters<typeof deposerPieceFormateur>[0]);

beforeEach(() => {
  vi.clearAllMocks();
  m.allume.mockResolvedValue(true);
  m.debit.mockResolvedValue({ allowed: true });
  m.controler.mockResolvedValue({
    ok: true,
    typeMime: "application/pdf",
    taille: CLAIR.length,
    sha256: SHA,
  });
  m.trainerFindUnique.mockResolvedValue({ id: TRAINER, statut: "sous_traitant" });
  m.docCreate.mockResolvedValue({ id: DOC });
  m.contenuCreate.mockResolvedValue({});
  m.logCreate.mockResolvedValue({});
});

describe("deposerPieceFormateur — écriture du dépôt", () => {
  it("🔴 écrit la pièce EN ATTENTE, ses octets chiffrés, et la trace « dépôt du formateur »", async () => {
    const r = await depot();
    expect(r).toEqual({ ok: true, documentId: DOC });
    const doc = (m.docCreate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(doc).toMatchObject({ trainerId: TRAINER, type: "cv", hashSha256: SHA });
    expect(doc).not.toHaveProperty("statutValidation", "valide");
    expect(doc.fichierUrl ?? null).toBeNull();
    const c = (m.contenuCreate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(c.trainerDocumentId).toBe(DOC);
    expect(c.sha256).toBe(SHA);
    expect(
      Buffer.from(c.octets as Buffer)
        .subarray(0, 4)
        .toString(),
    ).toBe("AXB1");
    expect(c.taille).toBe((c.octets as Buffer).length);
    const log = (m.logCreate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(log).toMatchObject({ action: ACTION_DEPOT_FORMATEUR, adminUserId: null, targetId: DOC });
  });

  it("interrupteur éteint → rien n'est contrôlé ni écrit", async () => {
    m.allume.mockResolvedValue(false);
    const r = await depot();
    expect(r.ok).toBe(false);
    expect(m.controler).not.toHaveBeenCalled();
    expect(m.docCreate).not.toHaveBeenCalled();
  });

  it("refus du contrôle commun (antivirus, format…) → message rendu tel quel, rien d'écrit", async () => {
    m.controler.mockResolvedValue({
      ok: false,
      message: "Ce fichier a été refusé par notre antivirus. Envoyez-en un autre.",
    });
    const r = await depot();
    expect(r).toEqual({
      ok: false,
      message: "Ce fichier a été refusé par notre antivirus. Envoyez-en un autre.",
    });
    expect(m.docCreate).not.toHaveBeenCalled();
  });

  it("limite de débit atteinte → refus avant tout contrôle", async () => {
    m.debit.mockResolvedValue({ allowed: false });
    expect((await depot()).ok).toBe(false);
    expect(m.controler).not.toHaveBeenCalled();
  });

  it("formateur salarié ou introuvable → refus", async () => {
    m.trainerFindUnique.mockResolvedValue({ id: TRAINER, statut: "salarie" });
    expect((await depot()).ok).toBe(false);
    m.trainerFindUnique.mockResolvedValue(null);
    expect((await depot()).ok).toBe(false);
    expect(m.docCreate).not.toHaveBeenCalled();
  });

  it("un type réservé à la console (contrat, DPAE) ne se dépose pas", async () => {
    for (const type of ["contrat_travail", "dpae", "contrat_sous_traitance"]) {
      expect(TYPES_DEPOSABLES as readonly string[]).not.toContain(type);
      expect((await depot({ type })).ok).toBe(false);
    }
    expect(m.docCreate).not.toHaveBeenCalled();
  });

  it("pièce gardée (vigilance, avis SIRENE) : date d'émission exigée, jamais future, échéance CALCULÉE", async () => {
    expect((await depot({ type: "kbis_avis_sirene" })).ok).toBe(false);
    expect(
      (await depot({ type: "kbis_avis_sirene", dateEmission: new Date(Date.now() + 86_400_000) }))
        .ok,
    ).toBe(false);
    expect(m.docCreate).not.toHaveBeenCalled();
    const emise = new Date(Date.now() - 10 * 86_400_000);
    await depot({ type: "kbis_avis_sirene", dateEmission: emise });
    const doc = (m.docCreate.mock.calls[0]![0] as { data: { dateExpiration: Date } }).data;
    expect(doc.dateExpiration.getTime()).toBeGreaterThan(emise.getTime());
  });

  it("un RIB ne garde jamais de numéro de pièce (l'IBAN n'y est jamais recopié)", async () => {
    await depot({ type: "rib", nomFichier: "rib.pdf", numeroPiece: "FR7630006000011234567890189" });
    const doc = (m.docCreate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(doc.numeroPiece).toBeNull();
  });

  it("le nom d'origine est nettoyé et tronqué", async () => {
    await depot({ nomFichier: `../../${"x".repeat(400)}<script>.pdf` });
    const c = (m.contenuCreate.mock.calls[0]![0] as { data: { nomOriginal: string } }).data;
    expect(c.nomOriginal.length).toBeLessThanOrEqual(255);
    expect(c.nomOriginal).not.toMatch(/[/<>]/);
  });
});

describe("lirePieceDeposee — route console", () => {
  const qualite = { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "responsable_qualite" };
  const admin = { userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role: "admin" };

  function doc(over: Record<string, unknown> = {}) {
    return {
      id: DOC,
      trainerId: TRAINER,
      type: "cv",
      contenu: {
        octets: Buffer.concat([Buffer.from("AXB1"), CLAIR]),
        sha256: SHA,
        mime: "application/pdf",
        nomOriginal: "cv.pdf",
      },
      ...over,
    };
  }

  beforeEach(() => m.docFindUnique.mockResolvedValue(doc()));

  it("🔴 sert le CLAIR et journalise la lecture", async () => {
    const r = await lirePieceDeposee({ trainerId: TRAINER, documentId: DOC, session: qualite });
    expect(r.ok).toBe(true);
    if (r.ok) expect(Buffer.from(r.octets).equals(CLAIR)).toBe(true);
    const log = (m.logCreate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(log).toMatchObject({
      action: "qualiopi.trainer_document.lecture",
      adminUserId: qualite.userId,
      targetId: DOC,
    });
  });

  it("IDOR : la pièce d'un AUTRE formateur → introuvable, aucun journal", async () => {
    const r = await lirePieceDeposee({ trainerId: AUTRE, documentId: DOC, session: qualite });
    expect(r).toEqual({ ok: false, statut: 404 });
    expect(m.logCreate).not.toHaveBeenCalled();
  });

  it("la pièce RIB n'est servie qu'avec le droit de rémunérer", async () => {
    m.docFindUnique.mockResolvedValue(doc({ type: "rib" }));
    expect(
      await lirePieceDeposee({ trainerId: TRAINER, documentId: DOC, session: qualite }),
    ).toEqual({
      ok: false,
      statut: 404,
    });
    expect(
      (await lirePieceDeposee({ trainerId: TRAINER, documentId: DOC, session: admin })).ok,
    ).toBe(true);
  });

  it("rôle sans droit d'habiliter → refus", async () => {
    const r = await lirePieceDeposee({
      trainerId: TRAINER,
      documentId: DOC,
      session: { userId: qualite.userId, role: "editor" },
    });
    expect(r.ok).toBe(false);
    expect(m.docFindUnique).not.toHaveBeenCalled();
  });

  it("interrupteur éteint → introuvable (comportement d'aujourd'hui)", async () => {
    m.allume.mockResolvedValue(false);
    expect(
      await lirePieceDeposee({ trainerId: TRAINER, documentId: DOC, session: qualite }),
    ).toEqual({
      ok: false,
      statut: 404,
    });
  });

  it("empreinte qui ne correspond plus → refus, jamais d'octets douteux servis", async () => {
    m.docFindUnique.mockResolvedValue(
      doc({ contenu: { ...doc().contenu, sha256: "0".repeat(64) } }),
    );
    expect(
      (await lirePieceDeposee({ trainerId: TRAINER, documentId: DOC, session: qualite })).ok,
    ).toBe(false);
  });

  it("journal indisponible → la pièce n'est PAS servie (lecture tracée ou rien)", async () => {
    m.logCreate.mockRejectedValue(new Error("base"));
    const r = await lirePieceDeposee({ trainerId: TRAINER, documentId: DOC, session: qualite });
    expect(r.ok).toBe(false);
  });

  it("identifiants en majuscules : même pièce", async () => {
    const r = await lirePieceDeposee({
      trainerId: TRAINER.toUpperCase(),
      documentId: DOC.toUpperCase(),
      session: qualite,
    });
    expect(r.ok).toBe(true);
  });

  it("identifiants non UUID → introuvable sans requête", async () => {
    const r = await lirePieceDeposee({ trainerId: "x", documentId: "y", session: qualite });
    expect(r).toEqual({ ok: false, statut: 404 });
    expect(m.docFindUnique).not.toHaveBeenCalled();
  });
});
