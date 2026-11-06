/**
 * Tests — signature publique d'un devis À FORMULES (lot 4), côté action.
 *
 * L'action ne fait confiance qu'au jeton : le choix du client est validé contre l'offre FIGÉE en
 * base, tout champ de prix envoyé par le navigateur est écarté, et `signerDocument` ne reçoit que
 * le choix canonique + l'instant serveur de la case cochée.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: vi.fn() },
    devis: { findFirst: vi.fn() },
  },
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  verifierTokenDocument: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/apres-signature", () => ({
  apresSignature: vi.fn(async () => ({ activationRefusee: null })),
  PREFIXE_ACTIVATION_REFUSEE: "x",
}));
const interrupteur = vi.hoisted(() => ({ formulesActives: vi.fn() }));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => interrupteur);
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: (_: string): string | null => null })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn(),
  requireHabilitation: vi.fn(),
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { CGV_VERSION } from "@/content/cgv-version";
import { verifierTokenDocument } from "@/server/qualiopi/documents/signature/token-document";
import { signerDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { choixCanonique, sha256Choix, sha256Offre } from "@/server/qualiopi/devis/offre-calculs";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { signerPieceParJetonAction } from "./piece-signature";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  documentGenere: { findUnique: Mock };
  devis: { findFirst: Mock };
};
const mockVerif = verifierTokenDocument as unknown as Mock;
const mockSigner = signerDocument as unknown as Mock;
const mockLimit = checkRateLimit as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const TOKEN_ID = "22222222-2222-4222-8222-222222222222";
const NUMERO = "AXI-DEV-2026-004";
const OFFRE = offreFictive();
const OFFRE_SHA = sha256Offre(OFFRE);

function entree(over: Record<string, unknown> = {}) {
  return {
    token: "jeton-en-clair",
    methode: "trace" as const,
    imageDataUrl: "data:image/png;base64,AAAA",
    cgvAcceptees: true as const,
    cgvVersionAffichee: CGV_VERSION,
    choix: {
      formule: "abonnement" as const,
      automatisationsRetenues: [] as string[],
      maintenanceRetenue: null,
      periodiciteMois: 1,
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLimit.mockResolvedValue({ allowed: true });
  interrupteur.formulesActives.mockResolvedValue(true);
  mockVerif.mockResolvedValue({
    ok: true,
    tokenId: TOKEN_ID,
    documentGenereId: DOC,
    partie: "client",
    signataireNom: "Camille Durand",
    signataireEmail: "camille@client.test",
    signataireQualite: "Gérante",
  });
  mockPrisma.documentGenere.findUnique.mockResolvedValue({
    type: "devis",
    numero: NUMERO,
    metadata: {},
  });
  // Les deux lectures du devis (objection métier, puis offre figée).
  mockPrisma.devis.findFirst.mockImplementation(
    async (args: { select: Record<string, boolean> }) =>
      args.select["statut"] === true
        ? { statut: "envoye" }
        : { numero: NUMERO, offre: OFFRE, offreSha256: OFFRE_SHA },
  );
  mockSigner.mockResolvedValue({
    ok: true,
    signatureId: "sig-1",
    selfHash: "a".repeat(64),
    statutSignature: "partielle",
  });
});

describe("devis à formules — l'action valide le choix contre l'offre figée", () => {
  it("choix valide : signerDocument reçoit le choix canonique, l'instant serveur et la version des CGV serveur", async () => {
    const avant = Date.now();
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: true });
    const arg = mockSigner.mock.calls[0]?.[0] as Record<string, unknown>;
    const attendu = choixCanonique({
      devisNumero: NUMERO,
      offreSha256: OFFRE_SHA,
      formule: "abonnement",
      automatisationsRetenues: [],
      maintenanceRetenue: false,
      periodiciteMois: 1,
    });
    expect(arg["choixOffre"]).toEqual({ choix: attendu, sha256: sha256Choix(attendu) });
    expect(arg["cgvVersion"]).toBe(CGV_VERSION);
    const accepteeAt = arg["cgvAccepteeAt"] as Date;
    expect(accepteeAt).toBeInstanceOf(Date);
    expect(accepteeAt.getTime()).toBeGreaterThanOrEqual(avant);
    expect(accepteeAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("🔴 interrupteur `devis_formules` éteint : un devis à formules ne se signe pas", async () => {
    interrupteur.formulesActives.mockResolvedValue(false);
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("sans choix : `choix_requis`, rien n'est signé", async () => {
    const res = await signerPieceParJetonAction(entree({ choix: undefined }));
    expect(res).toMatchObject({ ok: false, raison: "choix_requis" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("formule hors offre : refusée", async () => {
    const offre = offreFictive();
    offre.formulesProposees = ["abonnement"];
    delete offre.achat;
    const sha = sha256Offre(offre);
    mockPrisma.devis.findFirst.mockImplementation(
      async (args: { select: Record<string, boolean> }) =>
        args.select["statut"] === true
          ? { statut: "envoye" }
          : { numero: NUMERO, offre, offreSha256: sha },
    );
    const res = await signerPieceParJetonAction(
      entree({
        choix: {
          formule: "achat",
          automatisationsRetenues: [],
          maintenanceRetenue: false,
          periodiciteMois: null,
        },
      }),
    );
    expect(res).toMatchObject({ ok: false, raison: "formule_hors_offre" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("valeur de formule inconnue : requête invalide (le schéma la rejette)", async () => {
    const res = await signerPieceParJetonAction(
      entree({
        choix: {
          formule: "gratuite",
          automatisationsRetenues: [],
          maintenanceRetenue: null,
          periodiciteMois: 1,
        },
      }),
    );
    expect(res).toMatchObject({ ok: false, raison: "requete_invalide" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("maintenance obligatoire décochée : refusée", async () => {
    const offre = offreFictive();
    offre.achat!.maintenance.regle = "obligatoire";
    const sha = sha256Offre(offre);
    mockPrisma.devis.findFirst.mockImplementation(
      async (args: { select: Record<string, boolean> }) =>
        args.select["statut"] === true
          ? { statut: "envoye" }
          : { numero: NUMERO, offre, offreSha256: sha },
    );
    const res = await signerPieceParJetonAction(
      entree({
        choix: {
          formule: "achat",
          automatisationsRetenues: [],
          maintenanceRetenue: false,
          periodiciteMois: null,
        },
      }),
    );
    expect(res).toMatchObject({ ok: false, raison: "maintenance_obligatoire" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 un prix, une remise ou un numéro envoyés par le navigateur n'entrent pas dans le choix scellé", async () => {
    await signerPieceParJetonAction(
      entree({
        choix: {
          formule: "abonnement",
          automatisationsRetenues: [],
          maintenanceRetenue: null,
          periodiciteMois: 1,
          prixHtCents: 1,
          remiseBps: 10000,
          devisNumero: "AXI-DEV-2026-999",
          offreSha256: "0".repeat(64),
        },
      }),
    );
    const arg = mockSigner.mock.calls[0]?.[0] as {
      choixOffre: { choix: Record<string, unknown> };
    };
    expect(arg.choixOffre.choix["devisNumero"]).toBe(NUMERO);
    expect(arg.choixOffre.choix["offreSha256"]).toBe(OFFRE_SHA);
    expect(JSON.stringify(arg.choixOffre.choix)).not.toMatch(/prix|remise/i);
  });

  it("🔴 offre modifiée en base depuis l'envoi (empreinte différente) : refus `offre_alteree`", async () => {
    mockPrisma.devis.findFirst.mockImplementation(
      async (args: { select: Record<string, boolean> }) =>
        args.select["statut"] === true
          ? { statut: "envoye" }
          : { numero: NUMERO, offre: OFFRE, offreSha256: "0".repeat(64) },
    );
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "offre_alteree" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 jeton invalide : refus avant toute lecture du devis", async () => {
    mockVerif.mockResolvedValue({ ok: false, raison: "inconnu" });
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "lien_invalide" });
    expect(mockSigner).not.toHaveBeenCalled();
    expect(mockPrisma.devis.findFirst).not.toHaveBeenCalled();
  });

  it("devis expiré (statut `expire`) : refusé par l'objection métier", async () => {
    mockPrisma.devis.findFirst.mockImplementation(
      async (args: { select: Record<string, boolean> }) =>
        args.select["statut"] === true
          ? { statut: "expire" }
          : { numero: NUMERO, offre: OFFRE, offreSha256: OFFRE_SHA },
    );
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("la case CGV reste obligatoire et distincte du choix", async () => {
    const res = await signerPieceParJetonAction(entree({ cgvAcceptees: undefined }));
    expect(res).toMatchObject({ ok: false, raison: "cgv_non_acceptees" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("devis SANS offre : un `choix` reçu est ignoré, signature classique inchangée", async () => {
    mockPrisma.devis.findFirst.mockImplementation(
      async (args: { select: Record<string, boolean> }) =>
        args.select["statut"] === true
          ? { statut: "envoye" }
          : { numero: NUMERO, offre: null, offreSha256: null },
    );
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: true });
    const arg = mockSigner.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg["choixOffre"]).toBeUndefined();
    expect(arg["cgvAccepteeAt"]).toBeUndefined();
    expect(arg["cgvVersion"]).toBe(CGV_VERSION);
  });
});
