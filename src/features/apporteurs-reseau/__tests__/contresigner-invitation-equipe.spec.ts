import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Chantier « Pages équipe » : à la contresignature, l'apporteur reçoit l'invitation à remplir son
// questionnaire de collaborateur. Jamais bloquant, jamais en double. Tout le serveur est remplacé.
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  envoyer: vi.fn(),
  lireDossier: vi.fn(),
  registre: vi.fn(),
  appFindUnique: vi.fn(),
  appUpdateMany: vi.fn(async (_a?: unknown) => ({ count: 1 })),
  inviter: vi.fn(),
  inviteFindFirst: vi.fn(),
}));

vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: (...a: unknown[]) => h.registre(...a),
  lireRegistre: (...a: unknown[]) => h.registre(...a),
}));
vi.mock("../alerte-telegram", () => ({ alerterContresignature: vi.fn() }));
vi.mock("../apercu-envoi", () => ({ apercu: vi.fn() }));
vi.mock("../envois", () => ({
  envoyer: (...a: unknown[]) => h.envoyer(...a),
  avecTexteLibre: (payload: Record<string, unknown>) => payload,
}));
vi.mock("../donnees", () => ({
  lireDossier: (...a: unknown[]) => h.lireDossier(...a),
  purgerContenuPieces: vi.fn(),
}));
vi.mock("@/server/equipe/questionnaire/inviter", () => ({
  inviterCollaborateur: (...a: unknown[]) => h.inviter(...a),
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `hash:${e}`,
}));
const TEXTE = "CONTRAT signé";
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
vi.mock("../contrat-pdf", async () => {
  const { createHash } = await import("node:crypto");
  return {
    texteDuContrat: vi.fn(),
    empreinte: (t: string) => createHash("sha256").update(t).digest("hex"),
    rendreContratPdf: vi.fn(async () => Buffer.from("%PDF")),
  };
});
vi.mock("@/lib/r2-storage", () => ({
  deleteFromR2: vi.fn(),
  getObjectBufferR2: vi.fn(),
  isR2Configured: () => true,
  uploadToR2: vi.fn(),
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: {
      findUnique: (...a: unknown[]) => h.appFindUnique(...a),
      updateMany: (...a: unknown[]) => h.appUpdateMany(...a),
    },
    pieceApporteur: { findMany: vi.fn().mockResolvedValue([]) },
    activityLog: { create: vi.fn() },
    teamQuestionnaireInvite: { findFirst: (...a: unknown[]) => h.inviteFindFirst(...a) },
  },
}));

import { appliquerDecision } from "../verification";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "secret-de-test");
  h.envoyer.mockResolvedValue("envoye");
  h.inviter.mockResolvedValue({ ok: true, inviteId: "i1", remplacees: 0 });
  h.inviteFindFirst.mockResolvedValue(null);
  h.registre.mockResolvedValue({
    ok: true,
    entreprise: {
      siren: "732829320",
      active: true,
      personnes: [{ nom: "MARTIN", prenoms: "CLAIRE", qualite: null }],
      dirigeantsSocietes: 0,
    },
  });
  h.lireDossier.mockResolvedValue({
    id: ID,
    statut: "a_verifier",
    versionLien: 1,
    prenom: "Claire",
    nom: "Martin",
    email: "Claire@Exemple.fr",
    siren: "732829320",
    pieces: [{ type: "identite", statut: "conforme" }],
  });
  h.appFindUnique.mockResolvedValue({
    signatureApporteur: {
      nomTape: "Claire Martin",
      signeAt: "2026-10-05T10:00:00.000Z",
      texteSha256: sha(TEXTE),
      texte: TEXTE,
      valeurs: {},
    },
  });
});

describe("contresignature : invitation au questionnaire équipe", () => {
  it("invite l'apporteur (catégorie apporteur, prénom, e-mail, source contrat_apporteur)", async () => {
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: true });
    expect(h.inviter).toHaveBeenCalledTimes(1);
    expect(h.inviter).toHaveBeenCalledWith({
      categorie: "apporteur",
      email: "Claire@Exemple.fr",
      prenom: "Claire",
      source: "contrat_apporteur",
    });
  });

  it("une erreur d'invitation ne casse pas la contresignature", async () => {
    h.inviter.mockRejectedValue(new Error("boum"));
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: true });
    expect(h.envoyer).toHaveBeenCalledTimes(1);
  });

  it("un refus d'envoi (ok: false) ne casse pas non plus la contresignature", async () => {
    h.inviter.mockResolvedValue({ ok: false, raison: "envoi" });
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: true });
  });

  it("la vérification des doublons qui échoue ne casse pas la contresignature", async () => {
    h.inviteFindFirst.mockRejectedValue(new Error("base"));
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: true });
  });

  it("pas de doublon : une invitation active existe déjà, on n'en envoie pas une seconde", async () => {
    h.inviteFindFirst.mockResolvedValue({ id: "deja" });
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: true });
    expect(h.inviter).not.toHaveBeenCalled();
    expect(h.inviteFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          emailHash: "hash:claire@exemple.fr",
          category: "apporteur",
          usedAt: null,
          revokedAt: null,
        }),
      }),
    );
  });

  it("aucune invitation quand la contresignature est refusée (SIREN cessé)", async () => {
    h.registre.mockResolvedValue({ ok: true, entreprise: { siren: "732829320", active: false } });
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: false });
    expect(h.inviter).not.toHaveBeenCalled();
  });
});
