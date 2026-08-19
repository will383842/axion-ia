/**
 * Tests — piece-lien-signature.ts : émission d'un lien de signature.
 *
 * ## Ce que ces tests gardent
 *
 * 🔴 **L'identité n'est JAMAIS saisie.** Elle est résolue depuis la base par une
 * action d'administration, puis figée dans la ligne de jeton. Ouvrir un champ
 * libre reviendrait à sceller « ce que l'organisme a bien voulu déclarer » — et
 * un lien se transfère. C'est la faille déjà corrigée deux fois sur ce dépôt.
 *
 * 🔴 **Un contact manquant produit un refus qui DIT lequel**, jamais un échec
 * plus loin ni un bouton muet. Deux circuits (sous-traitance, tripartite)
 * étaient refusés jusqu'au 2026-07-30 faute de donnée en base ; la migration
 * `20260730140000` a ajouté les contacts, et ces tests vérifient que la
 * résolution les trouve — et refuse proprement quand ils manquent encore.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: vi.fn() },
    documentSignature: { count: vi.fn() },
    documentSignatureToken: { count: vi.fn() },
    client: { findUnique: vi.fn() },
    trainee: { findUnique: vi.fn() },
    sousTraitant: { findUnique: vi.fn() },
    dossierFinancement: { findFirst: vi.fn() },
  },
}));

vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: vi.fn(),
  revoquerTokensDocument: vi.fn(),
  TokenDocumentError: class extends Error {},
}));

vi.mock("@/lib/public-url", () => ({
  publicUrl: (p: string) => new URL(p, "https://axion-ia.com"),
}));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "iphash" }));
vi.mock("next/headers", () => ({
  // `Headers.get()` rend `string | null`, jamais `undefined` — un `Map` nu ne
  // reproduirait pas le contrat réel.
  headers: async () => ({ get: (_: string): string | null => null }),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn(),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { creerTokenDocument } from "@/server/qualiopi/documents/signature/token-document";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import { emettreLienSignatureAction } from "./piece-lien-signature";

type Mock = ReturnType<typeof vi.fn>;
const mp = prisma as unknown as {
  documentGenere: { findUnique: Mock };
  documentSignature: { count: Mock };
  documentSignatureToken: { count: Mock };
  client: { findUnique: Mock };
  trainee: { findUnique: Mock };
  sousTraitant: { findUnique: Mock };
  dossierFinancement: { findFirst: Mock };
};
const mockCreer = creerTokenDocument as unknown as Mock;
const mockGuard = requireAdminWrite as unknown as Mock;
const mockLog = logQualiopiActivity as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const ST = "22222222-2222-4222-8222-222222222222";
const SESSION = "33333333-3333-4333-8333-333333333333";

function piece(over: Record<string, unknown> = {}) {
  return {
    id: DOC,
    type: "contrat_sous_traitance",
    numero: "AXI-CTRST-2026-001",
    hashSha256: "c".repeat(64),
    metadata: {},
    // Colonne toujours présente en base : la laisser absente du gabarit ferait
    // passer TOUTES les pièces pour annulées (`undefined !== null`).
    annuleeAt: null as Date | null,
    clientId: null,
    traineeId: null,
    sousTraitantId: ST,
    sessionId: null,
    suppressionPrevueAt: new Date("2031-01-01T00:00:00.000Z"),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // ⚠️ `clearAllMocks` efface les appels, PAS les valeurs de retour.
  mockGuard.mockResolvedValue({ userId: "admin-1", role: "super_admin" });
  mockLog.mockResolvedValue(undefined);
  mp.documentGenere.findUnique.mockResolvedValue(piece());
  mp.documentSignature.count.mockResolvedValue(0);
  mp.documentSignatureToken.count.mockResolvedValue(0);
  mp.sousTraitant.findUnique.mockResolvedValue({
    nom: "Prestataire SARL",
    contactNom: "Jean Dupont",
    contactEmail: "jean@prestataire.fr",
    contactFonction: "Gérant",
  });
  mp.dossierFinancement.findFirst.mockResolvedValue({
    financeurNom: "OPCO Atlas",
    financeurContactNom: "Sophie Martin",
    financeurContactEmail: "sophie@opco-atlas.fr",
    financeurContactFonction: "Gestionnaire de dossier",
  });
  mockCreer.mockResolvedValue({
    token: "jeton-clair",
    tokenId: "tok-1",
    expiresAt: new Date("2026-10-01T00:00:00.000Z"),
  });
});

describe("🔴 sous-traitant — l'identité vient de la FICHE, jamais d'une saisie", () => {
  it("émet le lien avec le contact figé de la fiche", async () => {
    const res = await emettreLienSignatureAction({
      documentGenereId: DOC,
      partie: "sous_traitant",
    });
    expect("data" in res).toBe(true);
    expect(mockCreer).toHaveBeenCalledWith(
      expect.objectContaining({
        partie: "sous_traitant",
        signataireNom: "Jean Dupont",
        signataireEmail: "jean@prestataire.fr",
        signataireQualite: "Gérant",
      }),
    );
  });

  it("se replie sur la raison sociale quand le contact n'a pas de nom", async () => {
    // Mieux vaut « Prestataire SARL » qu'un refus, DÈS LORS qu'une adresse
    // existe. On ne FABRIQUE rien : on utilise une donnée réelle de la fiche.
    mp.sousTraitant.findUnique.mockResolvedValue({
      nom: "Prestataire SARL",
      contactNom: null,
      contactEmail: "contact@prestataire.fr",
      contactFonction: null,
    });
    await emettreLienSignatureAction({ documentGenereId: DOC, partie: "sous_traitant" });
    expect(mockCreer).toHaveBeenCalledWith(
      expect.objectContaining({ signataireNom: "Prestataire SARL" }),
    );
  });

  it("🔴 REFUSE sans adresse, en disant quoi corriger", async () => {
    mp.sousTraitant.findUnique.mockResolvedValue({
      nom: "Prestataire SARL",
      contactNom: "Jean Dupont",
      contactEmail: null,
      contactFonction: null,
    });
    const res = await emettreLienSignatureAction({
      documentGenereId: DOC,
      partie: "sous_traitant",
    });
    expect("error" in res).toBe(true);
    if (!("error" in res)) return;
    expect(res.error).toContain("adresse de contact");
    expect(mockCreer).not.toHaveBeenCalled();
  });

  it("⚠️ refuse une pièce ANCIENNE, non rattachée à un sous-traitant", async () => {
    // Les contrats émis avant le 2026-07-30 ne portaient aucun `sousTraitantId` :
    // le refus doit dire de régénérer, pas laisser un bouton muet.
    mp.documentGenere.findUnique.mockResolvedValue(piece({ sousTraitantId: null }));
    const res = await emettreLienSignatureAction({
      documentGenereId: DOC,
      partie: "sous_traitant",
    });
    expect("error" in res).toBe(true);
    if (!("error" in res)) return;
    expect(res.error).toContain("Régénérez");
  });
});

describe("🔴 financeur — le contact vit sur le DOSSIER, pas sur l'OPCO", () => {
  function pieceTripartite() {
    return piece({ type: "convention_tripartite", sousTraitantId: null, sessionId: SESSION });
  }

  it("émet le lien avec le contact du dossier de financement", async () => {
    mp.documentGenere.findUnique.mockResolvedValue(pieceTripartite());
    const res = await emettreLienSignatureAction({ documentGenereId: DOC, partie: "financeur" });
    expect("data" in res).toBe(true);
    expect(mockCreer).toHaveBeenCalledWith(
      expect.objectContaining({
        partie: "financeur",
        signataireNom: "Sophie Martin",
        signataireEmail: "sophie@opco-atlas.fr",
      }),
    );
  });

  it("se replie sur le NOM DU FINANCEUR quand le contact est anonyme", async () => {
    mp.documentGenere.findUnique.mockResolvedValue(pieceTripartite());
    mp.dossierFinancement.findFirst.mockResolvedValue({
      financeurNom: "OPCO Atlas",
      financeurContactNom: null,
      financeurContactEmail: "dossiers@opco-atlas.fr",
      financeurContactFonction: null,
    });
    await emettreLienSignatureAction({ documentGenereId: DOC, partie: "financeur" });
    expect(mockCreer).toHaveBeenCalledWith(
      expect.objectContaining({ signataireNom: "OPCO Atlas" }),
    );
  });

  it("🔴 refuse quand AUCUN dossier n'existe, en disant d'en créer un", async () => {
    mp.documentGenere.findUnique.mockResolvedValue(pieceTripartite());
    mp.dossierFinancement.findFirst.mockResolvedValue(null);
    const res = await emettreLienSignatureAction({ documentGenereId: DOC, partie: "financeur" });
    expect("error" in res).toBe(true);
    if (!("error" in res)) return;
    expect(res.error).toContain("dossier de financement");
    expect(mockCreer).not.toHaveBeenCalled();
  });

  it("refuse sans adresse sur le dossier", async () => {
    mp.documentGenere.findUnique.mockResolvedValue(pieceTripartite());
    mp.dossierFinancement.findFirst.mockResolvedValue({
      financeurNom: "OPCO Atlas",
      financeurContactNom: "Sophie Martin",
      financeurContactEmail: null,
      financeurContactFonction: null,
    });
    const res = await emettreLienSignatureAction({ documentGenereId: DOC, partie: "financeur" });
    expect("error" in res).toBe(true);
    expect(mockCreer).not.toHaveBeenCalled();
  });
});

describe("🔴 gardes communes", () => {
  it("refuse une partie hors du circuit de la pièce", async () => {
    // Le contrat de sous-traitance se signe à deux : `sous_traitant` et
    // `axionia`. Un lien « financeur » n'y a rien à faire.
    const res = await emettreLienSignatureAction({ documentGenereId: DOC, partie: "financeur" });
    expect("error" in res).toBe(true);
    expect(mockCreer).not.toHaveBeenCalled();
  });

  it("refuse un SPÉCIMEN — le service refuserait au clic, autant le dire avant", async () => {
    mp.documentGenere.findUnique.mockResolvedValue(piece({ metadata: { specimen: true } }));
    const res = await emettreLienSignatureAction({
      documentGenereId: DOC,
      partie: "sous_traitant",
    });
    expect("error" in res).toBe(true);
    if (!("error" in res)) return;
    expect(res.error).toContain("SPÉCIMEN");
    expect(mockCreer).not.toHaveBeenCalled();
  });

  it("🔴 refuse une pièce ANNULÉE — n'envoyer personne signer ce qui ne vaut plus", async () => {
    // Le service refuse au clic ; adresser quand même l'invitation ferait
    // parcourir tout le geste au signataire — jusqu'au tracé — pour un défaut
    // que l'organisme voyait avant d'envoyer.
    mp.documentGenere.findUnique.mockResolvedValue(
      piece({ annuleeAt: new Date("2026-08-12T09:00:00Z") }),
    );
    const res = await emettreLienSignatureAction({
      documentGenereId: DOC,
      partie: "sous_traitant",
    });
    expect("error" in res).toBe(true);
    if (!("error" in res)) return;
    expect(res.error.toLowerCase()).toContain("annul");
    expect(mockCreer).not.toHaveBeenCalled();
  });

  it("refuse une pièce sans empreinte", async () => {
    mp.documentGenere.findUnique.mockResolvedValue(piece({ hashSha256: "" }));
    const res = await emettreLienSignatureAction({
      documentGenereId: DOC,
      partie: "sous_traitant",
    });
    expect("error" in res).toBe(true);
    expect(mockCreer).not.toHaveBeenCalled();
  });

  it("refuse quand cette partie a DÉJÀ signé", async () => {
    mp.documentSignature.count.mockResolvedValue(1);
    const res = await emettreLienSignatureAction({
      documentGenereId: DOC,
      partie: "sous_traitant",
    });
    expect("error" in res).toBe(true);
    expect(mockCreer).not.toHaveBeenCalled();
  });

  it("refuse un rôle `editor` — émettre un lien engage l'organisme", async () => {
    mockGuard.mockResolvedValue({ userId: "u", role: "editor" });
    const res = await emettreLienSignatureAction({
      documentGenereId: DOC,
      partie: "sous_traitant",
    });
    expect("error" in res).toBe(true);
    expect(mockCreer).not.toHaveBeenCalled();
  });

  it("⚠️ ne JOURNALISE jamais le lien — il vaut signature", async () => {
    await emettreLienSignatureAction({ documentGenereId: DOC, partie: "sous_traitant" });
    const changes = mockLog.mock.calls[0]?.[0]?.changes as Record<string, unknown>;
    expect(JSON.stringify(changes)).not.toContain("jeton-clair");
    expect(changes["partie"]).toBe("sous_traitant");
  });

  it("signale une RÉÉMISSION, qui invalide le lien précédent", async () => {
    mp.documentSignatureToken.count.mockResolvedValue(1);
    const res = await emettreLienSignatureAction({
      documentGenereId: DOC,
      partie: "sous_traitant",
    });
    expect("data" in res).toBe(true);
    if (!("data" in res)) return;
    expect(res.data.reemission).toBe(true);
  });
});
