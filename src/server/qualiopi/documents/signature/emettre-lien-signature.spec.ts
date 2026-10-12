/**
 * Lot S6a (b, j) — le service d'émission du lien et l'identité du formateur
 * indépendant. Seuls Prisma, le jeton et le journal sont simulés.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  p: {
    documentGenere: { findUnique: vi.fn() },
    documentSignature: { count: vi.fn() },
    documentSignatureToken: { count: vi.fn(), findFirst: vi.fn() },
    trainer: { findUnique: vi.fn() },
    sousTraitant: { findUnique: vi.fn() },
  },
  creerToken: vi.fn(),
  log: vi.fn(),
  journal: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: h.log }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: h.journal }));
vi.mock("./token-document", () => ({
  creerTokenDocument: h.creerToken,
  TokenDocumentError: class TokenDocumentError extends Error {},
}));

import {
  emettreLienSignature,
  emettreLienSignatureSystem,
  resoudreIdentite,
} from "./emettre-lien-signature";

const DOC = "33333333-3333-4333-8333-333333333333";
const TRAINER = "44444444-4444-4444-8444-444444444444";
const ADMIN = { userId: "adm-1", role: "admin" } as never;

const PIECE_SANS_RATTACHEMENT = {
  clientId: null,
  traineeId: null,
  sousTraitantId: null,
  sessionId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db.example:5432/x";
});

describe("resoudreIdentite — branche formateur indépendant (j)", () => {
  it("un Trainer au statut sous_traitant signe au titre de sous_traitant", async () => {
    h.p.trainer.findUnique.mockResolvedValue({
      statut: "sous_traitant",
      prenom: "Ada",
      nom: "Lovelace",
      email: "ada@exemple.test",
    });
    const r = await resoudreIdentite("sous_traitant", {
      ...PIECE_SANS_RATTACHEMENT,
      trainerId: TRAINER,
    });
    expect(r).toEqual({
      ok: true,
      identite: {
        nom: "Ada Lovelace",
        email: "ada@exemple.test",
        qualite: "Formateur indépendant",
      },
    });
  });

  it("un salarié ou le dirigeant ne signe JAMAIS au titre de sous-traitant", async () => {
    for (const statut of ["salarie", "dirigeant"]) {
      h.p.trainer.findUnique.mockResolvedValue({
        statut,
        prenom: "A",
        nom: "B",
        email: "a@b.test",
      });
      const r = await resoudreIdentite("sous_traitant", {
        ...PIECE_SANS_RATTACHEMENT,
        trainerId: TRAINER,
      });
      expect(r.ok).toBe(false);
    }
  });

  it("la branche ORGANISME est intacte et prime sur l'ancre formateur", async () => {
    h.p.sousTraitant.findUnique.mockResolvedValue({
      nom: "Prestataire SARL",
      contactNom: null,
      contactEmail: "contact@prestataire.test",
      contactFonction: "Gérant",
    });
    const r = await resoudreIdentite("sous_traitant", {
      ...PIECE_SANS_RATTACHEMENT,
      sousTraitantId: "st-1",
      trainerId: TRAINER,
    });
    expect(r).toEqual({
      ok: true,
      identite: { nom: "Prestataire SARL", email: "contact@prestataire.test", qualite: "Gérant" },
    });
    expect(h.p.trainer.findUnique).not.toHaveBeenCalled();
  });

  it("sans organisme ni formateur, le refus d'origine est inchangé", async () => {
    const r = await resoudreIdentite("sous_traitant", PIECE_SANS_RATTACHEMENT);
    expect(r).toMatchObject({ ok: false });
    expect((r as { motif: string }).motif).toContain("aucun sous-traitant");
  });
});

describe("emettreLienSignature — le service (b)", () => {
  it("émet le lien du contrat-cadre d'un formateur indépendant et journalise au nom de l'acteur", async () => {
    h.p.documentGenere.findUnique.mockResolvedValue({
      id: DOC,
      type: "contrat_sous_traitance",
      numero: "AXI-DOC-2026-200",
      hashSha256: "b".repeat(64),
      metadata: {},
      annuleeAt: null,
      ...PIECE_SANS_RATTACHEMENT,
      trainerId: TRAINER,
      suppressionPrevueAt: new Date("2031-01-01T00:00:00Z"),
    });
    h.p.documentSignature.count.mockResolvedValue(0);
    h.p.documentSignatureToken.count.mockResolvedValue(0);
    h.p.trainer.findUnique.mockResolvedValue({
      statut: "sous_traitant",
      prenom: "Ada",
      nom: "Lovelace",
      email: "ada@exemple.test",
    });
    h.creerToken.mockResolvedValue({ token: "JETON", expiresAt: new Date() });

    const r = await emettreLienSignature({
      documentGenereId: DOC,
      partie: "sous_traitant",
      acteur: { session: ADMIN },
    });
    expect(r).toHaveProperty("data");
    expect(h.creerToken.mock.calls[0]![0]).toMatchObject({
      partie: "sous_traitant",
      signataireNom: "Ada Lovelace",
      signataireEmail: "ada@exemple.test",
    });
    expect(h.log.mock.calls[0]![0].session).toBe(ADMIN);
    // Le lien n'est JAMAIS journalisé.
    expect(JSON.stringify(h.log.mock.calls)).not.toContain("JETON");
  });

  it("refuse une entrée invalide sans rien lire", async () => {
    const r = await emettreLienSignature({
      documentGenereId: "pas-un-uuid",
      partie: "client",
      acteur: { session: ADMIN },
    });
    expect(r).toEqual({ error: "Entrée invalide." });
    expect(h.p.documentGenere.findUnique).not.toHaveBeenCalled();
  });
});

describe("emettreLienSignatureSystem — une relance ne rouvre JAMAIS un lien qu'un humain a fermé", () => {
  const PIECE = {
    id: DOC,
    type: "contrat_sous_traitance",
    numero: "AXI-DOC-2026-201",
    hashSha256: "c".repeat(64),
    metadata: {},
    annuleeAt: null,
    ...PIECE_SANS_RATTACHEMENT,
    trainerId: TRAINER,
    suppressionPrevueAt: new Date("2031-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    h.p.documentGenere.findUnique.mockResolvedValue(PIECE);
    h.p.documentSignature.count.mockResolvedValue(0);
    h.p.trainer.findUnique.mockResolvedValue({
      statut: "sous_traitant",
      prenom: "Ada",
      nom: "Lovelace",
      email: "ada@exemple.test",
    });
    h.creerToken.mockResolvedValue({ token: "JETON-SECRET", expiresAt: new Date() });
  });

  it("dernier lien révoqué par l'administrateur (`revokedById`) : refus, aucun jeton créé", async () => {
    h.p.documentSignatureToken.findFirst.mockResolvedValue({
      revokedAt: new Date("2026-10-10T09:00:00Z"),
      revokedById: "55555555-5555-4555-8555-555555555555",
    });
    const r = await emettreLienSignatureSystem(DOC, "sous_traitant");
    expect(r).toEqual({ error: "Lien révoqué par l'administrateur." });
    expect(h.creerToken).not.toHaveBeenCalled();
    expect(h.journal).not.toHaveBeenCalled();
  });

  it("aucun lien vivant (révoqué sans auteur : effacement RGPD, fin de collaboration) : refus", async () => {
    h.p.documentSignatureToken.findFirst.mockResolvedValue({
      revokedAt: new Date("2026-10-10T09:00:00Z"),
      revokedById: null,
    });
    expect(await emettreLienSignatureSystem(DOC, "sous_traitant")).toHaveProperty("error");
    h.p.documentSignatureToken.findFirst.mockResolvedValue(null);
    expect(await emettreLienSignatureSystem(DOC, "sous_traitant")).toHaveProperty("error");
    expect(h.creerToken).not.toHaveBeenCalled();
  });

  it("lien remplacé puis un lien vivant : la relance le renouvelle", async () => {
    // Le plus récent est le lien vivant ; l'ancien, « Remplacé par un nouveau lien »,
    // ne compte pas.
    h.p.documentSignatureToken.findFirst.mockResolvedValue({ revokedAt: null, revokedById: null });
    const r = await emettreLienSignatureSystem(DOC, "sous_traitant");
    expect(r).toHaveProperty("data");
    expect(h.creerToken).toHaveBeenCalledTimes(1);
    expect(h.p.documentSignatureToken.findFirst.mock.calls[0]![0]).toMatchObject({
      where: { documentGenereId: DOC, partie: "sous_traitant" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("l'émission système est journalisée (acteur système, cible UUID) sans le lien ni le jeton", async () => {
    h.p.documentSignatureToken.findFirst.mockResolvedValue({ revokedAt: null, revokedById: null });
    await emettreLienSignatureSystem(DOC, "sous_traitant");
    expect(h.journal).toHaveBeenCalledTimes(1);
    const entree = h.journal.mock.calls[0]![1];
    expect(entree).toMatchObject({
      action: "qualiopi.piece.lien_signature",
      targetType: "DocumentGenere",
      targetId: DOC,
      session: null,
      changes: {
        numero: "AXI-DOC-2026-201",
        type: "contrat_sous_traitance",
        partie: "sous_traitant",
        reemission: true,
        systeme: true,
      },
    });
    const brut = JSON.stringify(h.journal.mock.calls);
    expect(brut).not.toContain("JETON-SECRET");
    expect(brut).not.toContain("/portail/signer");
    expect(brut).not.toMatch(/"(url|token|lien)"/);
  });
});
