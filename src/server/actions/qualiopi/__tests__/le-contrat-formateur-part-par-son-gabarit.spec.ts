// S6b (d) — L'e-mail du lien de signature suit le TYPE de pièce. Le contrat-cadre d'un
// formateur indépendant part par F16, et seulement texte validé ; toute autre pièce garde
// exactement le chemin `convention-envoi`.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  piece: vi.fn(),
  resoudre: vi.fn(),
  emettre: vi.fn(),
  enqueue: vi.fn(),
  envoyerFormateur: vi.fn(),
  texteValide: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: (...a: unknown[]) => h.piece(...a) },
    trainer: { findUnique: async () => ({ prenom: "Claire" }) },
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("../_guards", () => ({
  requireAdminWrite: async () => ({ userId: "u-1", role: "admin" }),
  requireHabilitation: async () => ({ userId: "u-1", role: "admin" }),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/emettre-lien-signature", async () => {
  const { z } = await import("zod");
  return {
    emettreLienSignature: (...a: unknown[]) => h.emettre(...a),
    resoudreIdentite: (...a: unknown[]) => h.resoudre(...a),
    schemaEmissionLien: z.object({ documentGenereId: z.string(), partie: z.string() }),
  };
});
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  revoquerTokensDocument: vi.fn(),
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => h.enqueue(...a) }));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({
  envoyer: (...a: unknown[]) => h.envoyerFormateur(...a),
  texteValide: (...a: unknown[]) => h.texteValide(...a),
}));

import { envoyerLienSignatureParEmailAction } from "../piece-lien-signature";

const DOC = "00000000-0000-4000-8000-0000000000d1";
const TRAINER = "00000000-0000-4000-8000-0000000000f1";
const basePiece = {
  id: DOC,
  numero: "AXI-CST-2026-001",
  clientId: null,
  traineeId: null,
  sousTraitantId: null,
  sessionId: null,
  trainerId: TRAINER,
  session: null,
  client: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.resoudre.mockResolvedValue({
    ok: true,
    identite: { nom: "Claire Martin", email: "claire@exemple.invalid", qualite: null },
  });
  h.emettre.mockResolvedValue({
    data: { url: "https://axion-ia.com/s/jeton", expiresAt: new Date(), reemission: false },
  });
  h.enqueue.mockResolvedValue({ enqueued: true });
  h.envoyerFormateur.mockResolvedValue("envoye");
});

describe("contrat-cadre d'un formateur indépendant", () => {
  beforeEach(() => h.piece.mockResolvedValue({ ...basePiece, type: "contrat_sous_traitance" }));

  it("texte F16 non validé : rien n'est émis, rien n'est envoyé", async () => {
    h.texteValide.mockResolvedValue(false);
    const r = await envoyerLienSignatureParEmailAction({
      documentGenereId: DOC,
      partie: "sous_traitant",
    });
    expect(r).toEqual({ error: expect.stringMatching(/pas encore validé/) });
    expect(h.emettre).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.envoyerFormateur).not.toHaveBeenCalled();
  });

  it("texte validé : F16 part par l'adaptateur, avec le lien ; jamais convention-envoi", async () => {
    h.texteValide.mockResolvedValue(true);
    const r = await envoyerLienSignatureParEmailAction({
      documentGenereId: DOC,
      partie: "sous_traitant",
    });
    expect(r).toEqual({
      data: {
        destinataire: "claire@exemple.invalid",
        garePourValidation: false,
        reemission: false,
      },
    });
    expect(h.texteValide).toHaveBeenCalledWith("formateur-contrat-a-signer");
    expect(h.envoyerFormateur).toHaveBeenCalledWith({
      gabarit: "formateur-contrat-a-signer",
      destinataire: "claire@exemple.invalid",
      entityType: "Trainer",
      entityId: TRAINER,
      payload: { prenom: "Claire", lien: "https://axion-ia.com/s/jeton" },
    });
    expect(h.enqueue).not.toHaveBeenCalled();
    // La fiche formateur est bien transmise à la résolution d'identité.
    expect(h.resoudre.mock.calls[0]![1]).toMatchObject({ trainerId: TRAINER });
  });
});

describe("mot personnel sur le contrat formateur", () => {
  it("refusé explicitement plutôt qu'ignoré", async () => {
    h.piece.mockResolvedValue({ ...basePiece, type: "contrat_sous_traitance" });
    h.texteValide.mockResolvedValue(true);
    const r = await envoyerLienSignatureParEmailAction({
      documentGenereId: DOC,
      partie: "sous_traitant",
      messagePersonnalise: "Bonjour",
    });
    expect(r).toEqual({ error: expect.stringMatching(/mot personnel/) });
    expect(h.emettre).not.toHaveBeenCalled();
  });
});

describe("toute autre pièce : chemin d'avant", () => {
  it("une convention part par convention-envoi, sans fiche formateur", async () => {
    h.piece.mockResolvedValue({ ...basePiece, type: "convention", clientId: "c-1" });
    await envoyerLienSignatureParEmailAction({ documentGenereId: DOC, partie: "client" });
    expect(h.texteValide).not.toHaveBeenCalled();
    expect(h.enqueue.mock.calls[0]![0]).toBe("convention-envoi");
    expect(h.envoyerFormateur).not.toHaveBeenCalled();
  });
  it("une lettre de mission garde sa résolution d'avant (trainerId non transmis)", async () => {
    h.piece.mockResolvedValue({ ...basePiece, type: "lettre_mission" });
    await envoyerLienSignatureParEmailAction({ documentGenereId: DOC, partie: "sous_traitant" });
    expect(h.resoudre.mock.calls[0]![1]).toMatchObject({ trainerId: null });
  });
});
