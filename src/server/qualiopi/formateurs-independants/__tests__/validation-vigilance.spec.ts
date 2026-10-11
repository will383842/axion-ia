/**
 * Lot L4b (ADR 0066 (d) 4, art. L.8222-1) — validation de l'attestation de
 * vigilance URSSAF d'un formateur indépendant, et sa `PreuveVigilance`.
 *
 * Test ROUGE au premier commit : l'action n'existait pas, et la seule voie de
 * validation (`validateTrainerDocumentAction`) acceptait une attestation SANS
 * code de vérification ni case « authenticité vérifiée ».
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  docUpdate: vi.fn(),
  preuveCreate: vi.fn(),
  preuveUpdate: vi.fn(),
  logFindFirst: vi.fn(),
  logCreate: vi.fn(),
  session: { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "admin" } as {
    userId: string;
    role: string;
  },
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    trainerDocument: {
      findUnique: (...a: unknown[]) => m.findUnique(...a),
      updateMany: (...a: unknown[]) => m.docUpdate(...a),
    },
    preuveVigilance: {
      create: (...a: unknown[]) => m.preuveCreate(...a),
      update: (...a: unknown[]) => m.preuveUpdate(...a),
    },
    activityLog: {
      findFirst: (...a: unknown[]) => m.logFindFirst(...a),
      create: (...a: unknown[]) => m.logCreate(...a),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  };
  return { prisma: client };
});

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: vi.fn(async () => m.session),
}));

import { validerAttestationVigilance } from "../validation-vigilance";

const DOC = "22222222-2222-4222-8222-222222222222";
const TRAINER = "11111111-1111-4111-8111-111111111111";
const JOUR = 24 * 3600 * 1000;
const SHA = "a".repeat(64);

function piece(over: Record<string, unknown> = {}) {
  return {
    id: DOC,
    trainerId: TRAINER,
    type: "attestation_vigilance_urssaf",
    numeroPiece: "A1B2C3D4E5F6G7",
    hashSha256: SHA,
    dateEmission: new Date(Date.now() - 10 * JOUR),
    statutValidation: "en_attente",
    rejetMotif: null,
    archiveAt: null,
    trainer: { statut: "sous_traitant" },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.session = { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "admin" };
  m.findUnique.mockResolvedValue(piece());
  m.docUpdate.mockResolvedValue({ count: 1 });
  m.preuveCreate.mockResolvedValue({ id: "p1" });
  m.logCreate.mockResolvedValue({});
  // Pièce déposée par le formateur depuis son dossier : trace sans auteur console.
  m.logFindFirst.mockResolvedValue({
    action: "qualiopi.trainer_document.depot_formateur",
    adminUserId: null,
  });
});

const base = {
  trainerDocumentId: DOC,
  codeVerification: "A1B2C3D4E5F6G7",
  authenticiteVerifiee: true as const,
  resultat: "valide" as const,
};

describe("validerAttestationVigilance", () => {
  it("🔴 une validation SANS code est refusée, rien n'est écrit", async () => {
    const r = await validerAttestationVigilance({ ...base, codeVerification: "" });
    expect("error" in r).toBe(true);
    expect(m.preuveCreate).not.toHaveBeenCalled();
    expect(m.docUpdate).not.toHaveBeenCalled();
  });

  it("sans la case « authenticité vérifiée sur urssaf.fr » → refus", async () => {
    const r = await validerAttestationVigilance({
      ...base,
      authenticiteVerifiee: false as never,
    });
    expect("error" in r).toBe(true);
    expect(m.preuveCreate).not.toHaveBeenCalled();
  });

  it("valide : écrit UNE preuve (ajout seul) puis valide la pièce, avec échéance calculée", async () => {
    const r = await validerAttestationVigilance(base);
    expect(r).toEqual({ data: { id: DOC } });
    expect(m.preuveCreate).toHaveBeenCalledTimes(1);
    const data = (m.preuveCreate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      trainerId: TRAINER,
      trainerDocumentId: DOC,
      resultat: "valide",
      codeVerification: "A1B2C3D4E5F6G7",
      fichierSha256: SHA,
      verifieeParId: m.session.userId,
    });
    const emission = piece().dateEmission as Date;
    const fin = data.dateFinValidite as Date;
    expect(fin.getMonth()).toBe((emission.getMonth() + 6) % 12);
    expect(m.preuveUpdate).not.toHaveBeenCalled();
    const maj = (m.docUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(maj).toMatchObject({ statutValidation: "valide", valideParUserId: m.session.userId });
    expect(m.logCreate).toHaveBeenCalledTimes(1);
  });

  it("le code saisi diffère de celui donné par le formateur → refus", async () => {
    const r = await validerAttestationVigilance({ ...base, codeVerification: "ZZZZ9999" });
    expect("error" in r).toBe(true);
    expect(m.preuveCreate).not.toHaveBeenCalled();
  });

  it("code comparé sans espaces ni casse", async () => {
    const r = await validerAttestationVigilance({
      ...base,
      codeVerification: " a1b2 c3d4 e5f6 g7 ",
    });
    expect(r).toEqual({ data: { id: DOC } });
  });

  it("une autre pièce qu'une attestation URSSAF → refus", async () => {
    m.findUnique.mockResolvedValue(piece({ type: "cv" }));
    const r = await validerAttestationVigilance(base);
    expect("error" in r).toBe(true);
    expect(m.preuveCreate).not.toHaveBeenCalled();
  });

  it("pièce archivée → refus", async () => {
    m.findUnique.mockResolvedValue(piece({ archiveAt: new Date() }));
    expect("error" in (await validerAttestationVigilance(base))).toBe(true);
    m.findUnique.mockResolvedValue(piece({ rejetMotif: "[archivée] retirée" }));
    expect("error" in (await validerAttestationVigilance(base))).toBe(true);
    expect(m.preuveCreate).not.toHaveBeenCalled();
  });

  it("formateur salarié → hors périmètre, refus", async () => {
    m.findUnique.mockResolvedValue(piece({ trainer: { statut: "salarie" } }));
    expect("error" in (await validerAttestationVigilance(base))).toBe(true);
    expect(m.preuveCreate).not.toHaveBeenCalled();
  });

  it("sans date d'émission → refus (l'échéance en dépend)", async () => {
    m.findUnique.mockResolvedValue(piece({ dateEmission: null }));
    expect("error" in (await validerAttestationVigilance(base))).toBe(true);
    expect(m.preuveCreate).not.toHaveBeenCalled();
  });

  it("quatre yeux : celui qui a saisi la pièce en console ne la valide pas", async () => {
    m.logFindFirst.mockResolvedValue({
      action: "qualiopi.trainer_document.create",
      adminUserId: m.session.userId,
    });
    expect("error" in (await validerAttestationVigilance(base))).toBe(true);
    expect(m.preuveCreate).not.toHaveBeenCalled();
  });

  it("quatre yeux : aucune trace de création → auteur inconnu, garde FERMÉE", async () => {
    m.logFindFirst.mockResolvedValue(null);
    expect("error" in (await validerAttestationVigilance(base))).toBe(true);
    expect(m.preuveCreate).not.toHaveBeenCalled();
  });

  it("quatre yeux : saisie console dont l'auteur a disparu → refus", async () => {
    m.logFindFirst.mockResolvedValue({
      action: "qualiopi.trainer_document.create",
      adminUserId: null,
    });
    expect("error" in (await validerAttestationVigilance(base))).toBe(true);
    expect(m.preuveCreate).not.toHaveBeenCalled();
  });

  it("validation concurrente : la pièce n'est plus en attente → erreur, rien d'acté", async () => {
    m.docUpdate.mockResolvedValue({ count: 0 });
    const r = await validerAttestationVigilance(base);
    expect("error" in r).toBe(true);
    expect(m.logCreate).not.toHaveBeenCalled();
    const where = (m.docUpdate.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ statutValidation: "en_attente", archiveAt: null });
  });

  it("une attestation déjà vérifiée ne se revalide pas", async () => {
    m.findUnique.mockResolvedValue(piece({ statutValidation: "valide" }));
    expect("error" in (await validerAttestationVigilance(base))).toBe(true);
    expect(m.preuveCreate).not.toHaveBeenCalled();
  });

  it("invalide : preuve « invalide » ET pièce rejetée avec motif", async () => {
    const r = await validerAttestationVigilance({
      ...base,
      resultat: "invalide",
      motif: "Le code ne renvoie aucune attestation sur urssaf.fr.",
    });
    expect(r).toEqual({ data: { id: DOC } });
    const data = (m.preuveCreate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data.resultat).toBe("invalide");
    expect(data.dateFinValidite).toBeNull();
    const maj = (m.docUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(maj.statutValidation).toBe("rejete");
    expect(String(maj.rejetMotif)).toContain("urssaf.fr");
  });

  it("invalide sans motif → refus", async () => {
    const r = await validerAttestationVigilance({ ...base, resultat: "invalide" });
    expect("error" in r).toBe(true);
  });
});
