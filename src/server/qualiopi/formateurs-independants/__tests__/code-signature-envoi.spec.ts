// S6b — L'envoi du code de signature F17 : l'appelant ne donne que la pièce ; texte validé
// exigé ; 2 minutes entre deux codes, 3 par heure par pièce, 5 par heure par formateur ;
// le code ne va que dans l'e-mail, jamais en corbeille ; une seule demande simultanée part.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  piece: vi.fn(),
  pieces: vi.fn(),
  formateur: vi.fn(),
  codes: vi.fn(),
  compte: vi.fn(),
  vivant: vi.fn(),
  emettre: vi.fn(),
  envoyer: vi.fn(),
  texteValide: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      findUnique: (...a: unknown[]) => h.piece(...a),
      findMany: (...a: unknown[]) => h.pieces(...a),
    },
    trainer: { findUnique: (...a: unknown[]) => h.formateur(...a) },
    documentSignatureCode: {
      findMany: (...a: unknown[]) => h.codes(...a),
      count: (...a: unknown[]) => h.compte(...a),
      findFirst: (...a: unknown[]) => h.vivant(...a),
    },
  },
}));
vi.mock("@/server/qualiopi/documents/signature/code-signature", () => ({
  CODE_VALIDITE_MS: 10 * 60 * 1000,
  emettreCodeSignature: (...a: unknown[]) => h.emettre(...a),
}));
vi.mock("../envois", () => ({
  envoyer: (...a: unknown[]) => h.envoyer(...a),
  texteValide: (...a: unknown[]) => h.texteValide(...a),
}));

import { envoyerCodeSignature, libelleDuree } from "../code-signature-envoi";

const MAINTENANT = new Date("2026-10-13T08:00:00Z");
const MIN = 60 * 1000;
const EXPIRE = new Date(MAINTENANT.getTime() + 10 * MIN);
const demande = () => envoyerCodeSignature({ documentGenereId: "d-1", maintenant: MAINTENANT });

beforeEach(() => {
  vi.clearAllMocks();
  process.env["PII_ENCRYPTION_KEY"] = "b2".repeat(32);
  h.texteValide.mockResolvedValue(true);
  h.piece.mockResolvedValue({
    type: "contrat_sous_traitance",
    sousTraitantId: null,
    trainerId: "t-1",
  });
  h.formateur.mockResolvedValue({
    statut: "sous_traitant",
    prenom: "Claire",
    email: "claire@exemple.invalid",
  });
  h.pieces.mockResolvedValue([{ id: "d-1" }]);
  h.codes.mockResolvedValue([]);
  h.compte.mockResolvedValue(0);
  h.emettre.mockResolvedValue({ code: "042517", expiresAt: EXPIRE });
  h.vivant.mockResolvedValue({ expiresAt: EXPIRE });
  h.envoyer.mockResolvedValue("envoye");
});

describe("envoyerCodeSignature", () => {
  it("texte F17 non validé : aucun code n'est émis", async () => {
    h.texteValide.mockResolvedValue(false);
    expect(await demande()).toMatchObject({ ok: false, raison: "texte-non-valide" });
    expect(h.emettre).not.toHaveBeenCalled();
  });
  it.each([
    [{ type: "convention", sousTraitantId: null, trainerId: "t-1" }],
    [{ type: "contrat_sous_traitance", sousTraitantId: "org-1", trainerId: "t-1" }],
    [{ type: "contrat_sous_traitance", sousTraitantId: null, trainerId: null }],
    [null],
  ])("pièce hors circuit (%j) : refus, rien n'est émis", async (piece) => {
    h.piece.mockResolvedValue(piece);
    expect(await demande()).toMatchObject({ ok: false, raison: "piece-hors-circuit" });
    expect(h.emettre).not.toHaveBeenCalled();
  });
  it("le destinataire est TOUJOURS l'adresse de la fiche formateur", async () => {
    await demande();
    expect(h.envoyer.mock.calls[0]![0]).toMatchObject({
      destinataire: "claire@exemple.invalid",
      entityId: "t-1",
    });
  });
  it("moins de 2 minutes après le précédent : refus", async () => {
    h.codes.mockResolvedValue([{ createdAt: new Date(MAINTENANT.getTime() - MIN) }]);
    expect(await demande()).toMatchObject({ ok: false, raison: "trop-tot" });
    expect(h.emettre).not.toHaveBeenCalled();
  });
  it("trois codes dans l'heure pour la pièce : refus", async () => {
    h.codes.mockResolvedValue([
      { createdAt: new Date(MAINTENANT.getTime() - 5 * MIN) },
      { createdAt: new Date(MAINTENANT.getTime() - 20 * MIN) },
      { createdAt: new Date(MAINTENANT.getTime() - 40 * MIN) },
    ]);
    expect(await demande()).toMatchObject({ ok: false, raison: "trop-de-codes" });
  });
  it("cinq codes dans l'heure pour le formateur : refus", async () => {
    h.compte.mockResolvedValue(5);
    expect(await demande()).toMatchObject({ ok: false, raison: "trop-de-codes" });
    expect(h.emettre).not.toHaveBeenCalled();
  });
  it("le code part dans l'e-mail, avec sa vraie durée, jamais en corbeille, sans priorité ni clé", async () => {
    const r = await demande();
    expect(r).toEqual({ ok: true });
    expect(JSON.stringify(r)).not.toContain("042517");
    expect(h.envoyer).toHaveBeenCalledWith({
      gabarit: "formateur-code-signature",
      destinataire: "claire@exemple.invalid",
      entityType: "Trainer",
      entityId: "t-1",
      sansValidation: true,
      payload: {
        prenom: "Claire",
        // Le code traverse la file SCELLÉ : jamais en clair dans Redis ni chez Sentry.
        valeurs: { code: expect.stringMatching(/^enc:v2:/), durée: "10 minutes" },
      },
    });
    expect(JSON.stringify(h.envoyer.mock.calls)).not.toContain("042517");
  });
  it("sans clé de scellement : rien n'est enfilé (aucun repli en clair)", async () => {
    delete process.env["PII_ENCRYPTION_KEY"];
    expect(await demande()).toMatchObject({ ok: false, raison: "envoi-impossible" });
    expect(h.envoyer).not.toHaveBeenCalled();
    // La clé est éprouvée AVANT : aucun code n'est émis (le précédent reste valable).
    expect(h.emettre).not.toHaveBeenCalled();
  });
  it("deux demandes simultanées : celle dont le code a été invalidé n'envoie rien", async () => {
    h.vivant.mockResolvedValue({ expiresAt: new Date(EXPIRE.getTime() + 5) });
    expect(await demande()).toMatchObject({ ok: false, raison: "trop-tot" });
    expect(h.envoyer).not.toHaveBeenCalled();
  });
  it("garé en corbeille ou non parti : jamais « ok »", async () => {
    h.envoyer.mockResolvedValue("en-validation");
    expect(await demande()).toMatchObject({ ok: false, raison: "envoi-impossible" });
  });
  it("le mécanisme refuse d'émettre (secret absent) : envoi impossible", async () => {
    h.emettre.mockRejectedValue(new Error("indisponible"));
    expect(await demande()).toMatchObject({ ok: false, raison: "envoi-impossible" });
    expect(h.envoyer).not.toHaveBeenCalled();
  });
  it("la durée affichée est celle du mécanisme", () => {
    expect(libelleDuree(10 * MIN)).toBe("10 minutes");
    expect(libelleDuree(MIN)).toBe("1 minute");
  });
});
