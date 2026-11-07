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
    documentSignature: { count: vi.fn() },
  },
}));
const code = vi.hoisted(() => ({ verifierCodeSignature: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/code-signature", () => code);
const horodatage = vi.hoisted(() => ({ horodaterSignature: vi.fn(async () => "en_attente") }));
vi.mock("@/server/qualiopi/documents/signature/horodatage-signature", () => horodatage);
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
  documentSignature: { count: Mock };
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
    // Signature renforcée (lot 4 bis) : déclaration saisie + code reçu par e-mail.
    declaration: { nom: "Camille Durand", fonction: "Gérante", pouvoirEngager: true },
    code: "123456",
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
  code.verifierCodeSignature.mockResolvedValue({ ok: true });
  mockPrisma.documentSignature.count.mockResolvedValue(0);
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

describe("devis à formules — signature RENFORCÉE : déclaration et code (lot 4 bis)", () => {
  it("transmet au service la déclaration, l'instant SERVEUR du pouvoir et le consentement « avec code »", async () => {
    const avant = Date.now();
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: true });
    const arg = mockSigner.mock.calls[0]?.[0] as Record<string, unknown>;
    const r = arg["renforcee"] as {
      declarationNom: string;
      declarationFonction: string;
      pouvoirDeclareAt: Date;
    };
    expect(r.declarationNom).toBe("Camille Durand");
    expect(r.declarationFonction).toBe("Gérante");
    expect(r.pouvoirDeclareAt.getTime()).toBeGreaterThanOrEqual(avant);
    expect(arg["consentementVersion"]).toBe("doc-consent-code-v1");
    // Le code est vérifié avec le blocage de 15 minutes.
    expect(code.verifierCodeSignature).toHaveBeenCalledWith(
      expect.objectContaining({
        documentGenereId: DOC,
        partie: "client",
        code: "123456",
        blocageMs: 15 * 60 * 1000,
      }),
    );
  });

  it("tente l'horodatage aussitôt après la signature, sans l'attendre", async () => {
    await signerPieceParJetonAction(entree());
    expect(horodatage.horodaterSignature).toHaveBeenCalledWith("sig-1");
  });

  it("🔴 un horodatage qui échoue ne défait pas la signature", async () => {
    horodatage.horodaterSignature.mockRejectedValueOnce(new Error("TSA en panne"));
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: true });
  });

  it("🔴 sans code : `code_requis`, rien n'est signé", async () => {
    const res = await signerPieceParJetonAction(entree({ code: undefined }));
    expect(res).toMatchObject({ ok: false, raison: "code_requis" });
    expect(code.verifierCodeSignature).not.toHaveBeenCalled();
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 code faux, expiré ou rejoué : `code_refuse` (même message), rien n'est signé", async () => {
    code.verifierCodeSignature.mockResolvedValue({
      ok: false,
      message: "Ce code n'est pas valide.",
    });
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({
      ok: false,
      raison: "code_refuse",
      message: "Ce code n'est pas valide.",
    });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 trop d'essais : `code_bloque`, rien n'est signé", async () => {
    code.verifierCodeSignature.mockResolvedValue({
      ok: false,
      message: "Trop d'essais.",
      bloque: true,
    });
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "code_bloque" });
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("un code mal formé est refusé avant tout (schéma) : aucun essai consommé", async () => {
    for (const mauvais of ["12345", "1234567", "abcdef", "12 456"]) {
      const res = await signerPieceParJetonAction(entree({ code: mauvais }));
      expect(res).toMatchObject({ ok: false, raison: "code_refuse" });
    }
    expect(code.verifierCodeSignature).not.toHaveBeenCalled();
  });

  it("🔴 sans déclaration : `declaration_requise`, le code n'est PAS consommé", async () => {
    const res = await signerPieceParJetonAction(entree({ declaration: undefined }));
    expect(res).toMatchObject({ ok: false, raison: "declaration_requise" });
    expect(code.verifierCodeSignature).not.toHaveBeenCalled();
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 case du pouvoir non cochée : refusée, le code n'est pas consommé", async () => {
    for (const pouvoirEngager of [false, "true", 1, undefined]) {
      const res = await signerPieceParJetonAction(
        entree({ declaration: { nom: "Camille Durand", fonction: "Gérante", pouvoirEngager } }),
      );
      expect(res).toMatchObject({ ok: false });
      expect((res as { raison: string }).raison).toMatch(
        /pouvoir_non_declare|requete_invalide|declaration_requise/,
      );
    }
    expect(code.verifierCodeSignature).not.toHaveBeenCalled();
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 nom ou fonction vides : refusés, le code n'est pas consommé", async () => {
    for (const declaration of [
      { nom: "", fonction: "Gérante", pouvoirEngager: true },
      { nom: "Camille Durand", fonction: "  ", pouvoirEngager: true },
      { nom: "Camille\nDurand", fonction: "Gérante", pouvoirEngager: true },
    ]) {
      const res = await signerPieceParJetonAction(entree({ declaration }));
      expect(res).toMatchObject({ ok: false });
    }
    expect(code.verifierCodeSignature).not.toHaveBeenCalled();
  });

  it("🔴 un choix refusé ne consomme pas le code", async () => {
    const res = await signerPieceParJetonAction(
      entree({
        choix: {
          formule: "abonnement",
          automatisationsRetenues: [],
          maintenanceRetenue: null,
          periodiciteMois: 99,
        },
      }),
    );
    expect(res).toMatchObject({ ok: false, raison: "periodicite_hors_offre" });
    expect(code.verifierCodeSignature).not.toHaveBeenCalled();
  });

  it("deux onglets / double clic APRÈS signature : `deja_signe`, le code n'est pas consommé pour rien", async () => {
    mockPrisma.documentSignature.count.mockResolvedValue(1);
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "deja_signe" });
    expect(code.verifierCodeSignature).not.toHaveBeenCalled();
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("double clic simultané : un seul code passe, la seconde requête est refusée sans signer", async () => {
    code.verifierCodeSignature
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, message: "Ce code n'est pas valide." });
    const [a, b] = await Promise.all([
      signerPieceParJetonAction(entree()),
      signerPieceParJetonAction(entree()),
    ]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(mockSigner).toHaveBeenCalledTimes(1);
  });

  it("le service refuse (déjà signé entre-temps) : le refus remonte tel quel", async () => {
    mockSigner.mockResolvedValue({ ok: false, raison: "deja_signe", message: "déjà" });
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "deja_signe" });
    expect(horodatage.horodaterSignature).not.toHaveBeenCalled();
  });

  it("🔴 lien expiré ou révoqué : refus avant toute lecture, le code n'est pas consommé", async () => {
    mockVerif.mockResolvedValue({ ok: false, raison: "expire" });
    expect(await signerPieceParJetonAction(entree())).toMatchObject({
      ok: false,
      raison: "lien_expire",
    });
    mockVerif.mockResolvedValue({ ok: false, raison: "revoque" });
    expect(await signerPieceParJetonAction(entree())).toMatchObject({
      ok: false,
      raison: "lien_revoque",
    });
    expect(code.verifierCodeSignature).not.toHaveBeenCalled();
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("🔴 devis refusé (ou retiré, remplacé) : refus, le code n'est pas consommé", async () => {
    mockPrisma.devis.findFirst.mockImplementation(
      async (args: { select: Record<string, boolean> }) =>
        args.select["statut"] === true
          ? { statut: "refuse" }
          : { numero: NUMERO, offre: OFFRE, offreSha256: OFFRE_SHA },
    );
    const res = await signerPieceParJetonAction(entree());
    expect(res).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    expect(code.verifierCodeSignature).not.toHaveBeenCalled();
    expect(mockSigner).not.toHaveBeenCalled();
  });

  it("un devis SANS offre ne demande ni déclaration ni code (palier inchangé)", async () => {
    mockPrisma.devis.findFirst.mockImplementation(
      async (args: { select: Record<string, boolean> }) =>
        args.select["statut"] === true
          ? { statut: "envoye" }
          : { numero: NUMERO, offre: null, offreSha256: null },
    );
    const res = await signerPieceParJetonAction(
      entree({ declaration: undefined, code: undefined, choix: undefined }),
    );
    expect(res).toMatchObject({ ok: true });
    const arg = mockSigner.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg["renforcee"]).toBeUndefined();
    expect(arg["consentementVersion"]).toBeUndefined();
    expect(code.verifierCodeSignature).not.toHaveBeenCalled();
  });
});
