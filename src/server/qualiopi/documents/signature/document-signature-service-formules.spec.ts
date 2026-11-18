/**
 * Tests — signature d'un devis À FORMULES (lot 4) par `signerDocument`.
 *
 * Le service est générique : il reçoit un choix DÉJÀ validé par l'action, mais il revérifie
 * contre le devis lu en base (numéro, empreinte de l'offre, validité). Il écrit le sceau V4.
 * Un devis SANS offre reste scellé en V3, octet pour octet (garde de non-régression).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: vi.fn(), update: vi.fn() },
    documentSignature: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    documentSignatureToken: { findUnique: vi.fn() },
    documentSignatureCode: { findFirst: vi.fn() },
    documentSignatureHorodatage: { create: vi.fn() },
    trainer: { findUnique: vi.fn() },
    adminUser: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/server/qualiopi/emargement/storage", () => ({
  storeSignatureImage: vi.fn(),
  supprimerImageSignature: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { storeSignatureImage } from "@/server/qualiopi/emargement/storage";
import { Prisma } from "../../../../../prisma/generated/client";
import { empreinteTexteCgv } from "@/content/cgv-empreinte";
import { verifierChaine } from "@/server/qualiopi/emargement/hash";
import { choixCanonique, sha256Choix, sha256Offre } from "@/server/qualiopi/devis/offre-calculs";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { signerDocument } from "./document-signature-service";
import { maillonDocumentDepuisLigne, type LigneDocumentSignature } from "./document-signature-hash";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  documentGenere: { findUnique: Mock; update: Mock };
  documentSignature: { findFirst: Mock; findMany: Mock; create: Mock; count: Mock };
  documentSignatureToken: { findUnique: Mock };
  documentSignatureCode: { findFirst: Mock };
  documentSignatureHorodatage: { create: Mock };
  adminUser: { findUnique: Mock };
  $transaction: Mock;
};
const mockStore = storeSignatureImage as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const TOKEN = "55555555-5555-4555-8555-555555555555";
const NUMERO_PIECE = "AXI-DEV-2026-001";
const MAINTENANT = new Date("2026-11-10T10:00:00.123Z");
const RECU_LE = new Date("2026-11-10T09:59:58.000Z");
const CGV = "2026-10-04";
const POUVOIR_LE = new Date("2026-11-10T09:59:58.500Z");
/** Code accepté une minute avant la signature. */
const CODE_UTILISE_LE = new Date("2026-11-10T09:59:00.000Z");

const OFFRE = offreFictive();
const OFFRE_SHA = sha256Offre(OFFRE);
const CHOIX = choixCanonique({
  devisNumero: NUMERO_PIECE,
  offreSha256: OFFRE_SHA,
  formule: "abonnement",
  automatisationsRetenues: [],
  maintenanceRetenue: false,
  periodiciteMois: 1,
});

function piece(devis: Record<string, unknown> | null) {
  return {
    id: DOC,
    numero: NUMERO_PIECE,
    type: "devis",
    hashSha256: "c".repeat(64),
    metadata: {},
    sessionId: null,
    trainerId: null,
    annuleeAt: null,
    signatures: [],
    session: null,
    devisPortes: devis === null ? [] : [devis],
  };
}
const DEVIS_FORMULES = {
  numero: NUMERO_PIECE,
  offre: OFFRE,
  offreSha256: OFFRE_SHA,
  dateValidite: new Date("2026-11-20T00:00:00.000Z"),
};

const PORTEUR_JETON = {
  type: "signataire_jeton" as const,
  tokenId: TOKEN,
  partie: "client" as const,
};

function entreeClient(over: Record<string, unknown> = {}) {
  return {
    documentGenereId: DOC,
    porteur: PORTEUR_JETON,
    methode: "trace" as const,
    partiesRequises: ["client", "axionia"] as const,
    imageDataUrl: "data:image/png;base64,AAAA",
    maintenant: MAINTENANT,
    cgvVersion: CGV,
    choixOffre: { choix: CHOIX, sha256: sha256Choix(CHOIX) },
    cgvAccepteeAt: RECU_LE,
    // Signature renforcée : déclaration saisie + code reçu par e-mail (lot 4 bis).
    consentementVersion: "doc-consent-code-v1" as const,
    renforcee: {
      declarationNom: "Camille  Durand",
      declarationFonction: "Gérante",
      pouvoirDeclareAt: POUVOIR_LE,
    },
    ipHash: "i".repeat(64),
    userAgentSha256: "u".repeat(64),
    ...over,
  };
}

function donnees(): Record<string, unknown> {
  return mockPrisma.documentSignature.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
}
function attendRefus(res: unknown, raison: string) {
  expect(res).toStrictEqual({ ok: false, raison, message: expect.any(String) });
  expect(mockPrisma.documentSignature.create).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(DEVIS_FORMULES));
  mockPrisma.documentGenere.update.mockResolvedValue({ id: DOC });
  mockPrisma.documentSignature.findFirst.mockResolvedValue(null);
  mockPrisma.documentSignature.findMany.mockResolvedValue([{ partie: "client" }]);
  mockPrisma.documentSignature.count.mockResolvedValue(0);
  mockPrisma.documentSignature.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: args.data["id"],
      selfHash: args.data["selfHash"],
    }),
  );
  mockPrisma.documentSignatureToken.findUnique.mockResolvedValue({
    documentGenereId: DOC,
    partie: "client",
    signataireNom: "Camille Durand",
    signataireEmail: "camille@client.test",
    signataireQualite: "Gérante",
    expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    revokedAt: null,
  });
  mockPrisma.documentSignatureCode.findFirst.mockResolvedValue({
    id: "code-1",
    utiliseAt: CODE_UTILISE_LE,
  });
  mockPrisma.documentSignatureHorodatage.create.mockResolvedValue({ id: "h1" });
  mockPrisma.adminUser.findUnique.mockResolvedValue({
    name: "Williams Jullin",
    email: "w@axion.test",
    status: "active",
    role: "super_admin",
  });
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(mockPrisma),
  );
  mockStore.mockResolvedValue({
    key: "emargement/2026/signatures/x.png",
    sha256: "a".repeat(64),
    mimeType: "image/png",
    sizeBytes: 10,
  });
});

describe("devis à formules — signature du client (sceau V4)", () => {
  it("écrit une ligne V4 : choix, empreinte du texte des CGV, case cochée, lien, IP et navigateur", async () => {
    const res = await signerDocument(entreeClient());
    expect(res).toMatchObject({ ok: true });
    const d = donnees();
    expect(d["hashVersion"]).toBe(4);
    expect(d["choixOffre"]).toEqual(CHOIX);
    expect(d["choixOffreSha256"]).toBe(sha256Choix(CHOIX));
    // Valeur SERVEUR : l'empreinte vient du texte en vigueur, jamais de l'appelant.
    expect(d["cgvTexteSha256"]).toBe(empreinteTexteCgv());
    expect(d["cgvVersion"]).toBe(CGV);
    expect(d["cgvAccepteeAt"]).toEqual(RECU_LE);
    expect((d["cgvAccepteeAt"] as Date).getTime()).toBeLessThan((d["signeAt"] as Date).getTime());
    expect(d["jetonId"]).toBe(TOKEN);
    expect(d["cgvPdfSha256"] ?? null).toBeNull();
    expect(d["cgvTraceSha256"] ?? null).toBeNull();
    // IP et navigateur : enregistrés avec la preuve, hors sceau (doctrine RGPD).
    expect(d["ipHash"]).toBe("i".repeat(64));
    expect(d["userAgentSha256"]).toBe("u".repeat(64));
  });

  it("🔴 la ligne écrite se vérifie : sceau V4 recalculable et stable", async () => {
    await signerDocument(entreeClient());
    const d = donnees();
    const ligne = {
      id: d["id"],
      documentGenereId: DOC,
      provider: "interne",
      providerSubmissionId: null,
      partie: "client",
      signataireNom: d["signataireNom"],
      signataireEmail: d["signataireEmail"],
      signataireQualite: d["signataireQualite"],
      documentHashSha256: "c".repeat(64),
      methode: "trace",
      signatureSha256: d["signatureSha256"],
      mentionVersion: d["mentionVersion"],
      consentementVersion: d["consentementVersion"],
      signeAt: d["signeAt"],
      prevHash: null,
      selfHash: d["selfHash"],
      hashVersion: 4,
      facteurVerification: d["facteurVerification"],
      declarationNom: d["declarationNom"] ?? null,
      declarationFonction: d["declarationFonction"] ?? null,
      pouvoirDeclareAt: d["pouvoirDeclareAt"] ?? null,
      codeVerifieAt: d["codeVerifieAt"] ?? null,
      cgvVersion: d["cgvVersion"],
      choixOffre: d["choixOffre"],
      choixOffreSha256: d["choixOffreSha256"],
      cgvTexteSha256: d["cgvTexteSha256"],
      cgvPdfSha256: null,
      cgvAccepteeAt: d["cgvAccepteeAt"],
      cgvTraceSha256: null,
      jetonId: d["jetonId"],
    } as unknown as LigneDocumentSignature;
    const piece = { documentNumero: NUMERO_PIECE, documentType: "devis" };
    expect(verifierChaine([maillonDocumentDepuisLigne(ligne, piece)]).valide).toBe(true);
    // Modifier le choix en base : la preuve le dit.
    const altere = { ...ligne, choixOffre: { ...CHOIX, formule: "achat" } };
    expect(verifierChaine([maillonDocumentDepuisLigne(altere, piece)]).valide).toBe(false);
  });

  it("refuse la signature sans choix : `choix_requis`", async () => {
    attendRefus(await signerDocument(entreeClient({ choixOffre: undefined })), "choix_requis");
  });

  it("refuse la signature sans instant de case cochée : `cgv_non_acceptees`", async () => {
    attendRefus(
      await signerDocument(entreeClient({ cgvAccepteeAt: undefined })),
      "cgv_non_acceptees",
    );
  });

  it("refuse une signature du client par un canal sans choix (papier) : `choix_requis`", async () => {
    attendRefus(
      await signerDocument(
        entreeClient({
          porteur: {
            type: "reversement_papier",
            adminId: "a1",
            provider: "manual_upload",
            partie: "client",
            signataire: { nom: "Camille Durand" },
          },
          choixOffre: undefined,
        }),
      ),
      "choix_requis",
    );
  });

  it("🔴 refuse un choix que les règles de l'offre n'auraient pas produit (maintenance obligatoire décochée)", async () => {
    const offre = offreFictive();
    offre.achat!.maintenance.regle = "obligatoire";
    const sha = sha256Offre(offre);
    mockPrisma.documentGenere.findUnique.mockResolvedValue(
      piece({ ...DEVIS_FORMULES, offre, offreSha256: sha }),
    );
    const faux = choixCanonique({
      devisNumero: NUMERO_PIECE,
      offreSha256: sha,
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: false,
      periodiciteMois: null,
    });
    attendRefus(
      await signerDocument(
        entreeClient({ choixOffre: { choix: faux, sha256: sha256Choix(faux) } }),
      ),
      "choix_incoherent",
    );
  });

  it("🔴 refuse une durée absente de l'offre, même bien formée et bien hachée", async () => {
    const faux = choixCanonique({ ...CHOIX, periodiciteMois: 6 });
    attendRefus(
      await signerDocument(
        entreeClient({ choixOffre: { choix: faux, sha256: sha256Choix(faux) } }),
      ),
      "choix_incoherent",
    );
  });

  it("🔴 refuse une liste d'automatisations non canonique (liste brute ≠ liste facturée)", async () => {
    const brut = { ...CHOIX, automatisationsRetenues: ["auto1", "auto1"] };
    attendRefus(
      await signerDocument(
        entreeClient({ choixOffre: { choix: brut, sha256: sha256Choix(brut) } }),
      ),
      "choix_incoherent",
    );
  });

  it("🔴 deux devis portent la même pièce (dont un à formules) : ambiguïté refusée, rien n'est scellé", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      ...piece(DEVIS_FORMULES),
      devisPortes: [DEVIS_FORMULES, { ...DEVIS_FORMULES, numero: "AXI-DEV-2026-998" }],
    });
    attendRefus(await signerDocument(entreeClient()), "choix_incoherent");
  });

  it("le devis lié est lu dans un ordre déterministe (createdAt, id) et sur deux lignes au plus", async () => {
    await signerDocument(entreeClient());
    const arg = mockPrisma.documentGenere.findUnique.mock.calls[0]?.[0] as {
      select: { devisPortes: { orderBy: unknown; take: number } };
    };
    expect(arg.select.devisPortes.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
    expect(arg.select.devisPortes.take).toBe(2);
  });

  it("🔴 refuse un choix d'un AUTRE devis (numéro différent)", async () => {
    const autre = choixCanonique({ ...CHOIX, devisNumero: "AXI-DEV-2026-999" });
    attendRefus(
      await signerDocument(
        entreeClient({ choixOffre: { choix: autre, sha256: sha256Choix(autre) } }),
      ),
      "choix_incoherent",
    );
  });

  it("🔴 refuse un choix scellé sur une AUTRE version de l'offre (empreinte différente)", async () => {
    const autre = choixCanonique({ ...CHOIX, offreSha256: "0".repeat(64) });
    attendRefus(
      await signerDocument(
        entreeClient({ choixOffre: { choix: autre, sha256: sha256Choix(autre) } }),
      ),
      "choix_incoherent",
    );
  });

  it("🔴 refuse une empreinte de choix qui n'est pas celle du choix fourni", async () => {
    attendRefus(
      await signerDocument(entreeClient({ choixOffre: { choix: CHOIX, sha256: "0".repeat(64) } })),
      "choix_incoherent",
    );
  });

  it("🔴 refuse un devis dont l'offre en base n'a plus l'empreinte figée à l'envoi", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(
      piece({ ...DEVIS_FORMULES, offreSha256: "0".repeat(64) }),
    );
    attendRefus(await signerDocument(entreeClient()), "choix_incoherent");
  });

  it("🔴 refuse de signer un devis EXPIRÉ (date de validité passée), même si le statut n'a pas bougé", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(
      piece({ ...DEVIS_FORMULES, dateValidite: new Date("2026-11-10T09:00:00.000Z") }),
    );
    attendRefus(await signerDocument(entreeClient()), "devis_expire");
  });

  it("refuse à l'instant exact de l'échéance (borne exclue)", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(
      piece({ ...DEVIS_FORMULES, dateValidite: MAINTENANT }),
    );
    attendRefus(await signerDocument(entreeClient()), "devis_expire");
  });

  it("🔴 signature rejouée : la ligne existe déjà → `deja_signe`, rien d'écrit", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      ...piece(DEVIS_FORMULES),
      signatures: [{ id: "deja" }],
    });
    attendRefus(await signerDocument(entreeClient()), "deja_signe");
  });

  it("🔴 deux signatures simultanées : la seconde perd sur l'index unique → `deja_signe`", async () => {
    const conflit = new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
    mockPrisma.documentSignature.create.mockRejectedValueOnce(conflit);
    mockPrisma.documentSignature.count.mockResolvedValue(1);
    const res = await signerDocument(entreeClient());
    expect(res).toMatchObject({ ok: false, raison: "deja_signe" });
    // Une seule tentative d'écriture, et l'image orpheline est nettoyée.
    expect(mockPrisma.documentSignature.create).toHaveBeenCalledTimes(1);
  });

  it("🔴 course sur la chaîne (autre partie) : reprise, puis une seule ligne V4 écrite", async () => {
    const conflit = new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
    mockPrisma.documentSignature.create.mockRejectedValueOnce(conflit);
    mockPrisma.documentSignature.count.mockResolvedValue(0);
    const res = await signerDocument(entreeClient());
    expect(res).toMatchObject({ ok: true });
    expect(mockPrisma.documentSignature.create).toHaveBeenCalledTimes(2);
    const d2 = mockPrisma.documentSignature.create.mock.calls[1]?.[0]?.data as Record<
      string,
      unknown
    >;
    expect(d2["hashVersion"]).toBe(4);
    expect(d2["choixOffreSha256"]).toBe(sha256Choix(CHOIX));
  });
});

describe("devis à formules — contresignature d'Axion-IA (art. 6.2)", () => {
  const PORTEUR_ORGANISME = {
    type: "organisme_authentifie" as const,
    adminId: "a1",
    partie: "axionia" as const,
  };

  function entreeAxionia(over: Record<string, unknown> = {}) {
    return {
      documentGenereId: DOC,
      porteur: PORTEUR_ORGANISME,
      methode: "trace" as const,
      partiesRequises: ["client", "axionia"] as const,
      imageDataUrl: "data:image/png;base64,AAAA",
      maintenant: MAINTENANT,
      ...over,
    };
  }

  beforeEach(() => {
    mockPrisma.documentSignature.findMany.mockResolvedValue([
      { partie: "client" },
      { partie: "axionia" },
    ]);
  });

  it("recopie le MÊME choix que celui du client, en V4, sans CGV ni lien propres", async () => {
    // 1er findFirst : ligne client (choix) ; 2e : précédente (chaîne).
    mockPrisma.documentSignature.findFirst.mockImplementation(
      async (args: { where: { partie?: string } }) =>
        args.where.partie === "client"
          ? { choixOffre: CHOIX, choixOffreSha256: sha256Choix(CHOIX) }
          : { selfHash: "b".repeat(64) },
    );
    const res = await signerDocument(entreeAxionia());
    expect(res).toMatchObject({ ok: true });
    const d = donnees();
    expect(d["hashVersion"]).toBe(4);
    expect(d["choixOffre"]).toEqual(CHOIX);
    expect(d["choixOffreSha256"]).toBe(sha256Choix(CHOIX));
    expect(d["cgvTexteSha256"] ?? null).toBeNull();
    expect(d["cgvAccepteeAt"] ?? null).toBeNull();
    expect(d["jetonId"] ?? null).toBeNull();
    expect(d["cgvVersion"] ?? null).toBeNull();
  });

  it("🔴 refuse de contresigner si la signature du client ne porte aucun choix", async () => {
    mockPrisma.documentSignature.findFirst.mockResolvedValue(null);
    attendRefus(await signerDocument(entreeAxionia()), "choix_requis");
  });
});

describe("devis SANS offre — inchangé (V3, octet pour octet)", () => {
  it("signature client d'un devis classique : sceau V3, aucune colonne V4", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(null));
    const res = await signerDocument(
      entreeClient({ choixOffre: undefined, cgvAccepteeAt: undefined }),
    );
    expect(res).toMatchObject({ ok: true });
    const d = donnees();
    expect(d["hashVersion"]).toBe(3);
    for (const cle of [
      "choixOffre",
      "choixOffreSha256",
      "cgvTexteSha256",
      "cgvAccepteeAt",
      "jetonId",
      "cgvPdfSha256",
      "cgvTraceSha256",
    ]) {
      expect(d[cle] ?? null).toBeNull();
    }
    expect(d["cgvVersion"]).toBe(CGV);
  });

  it("une offre NULL dans un devis lié : même chose", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(
      piece({ ...DEVIS_FORMULES, offre: null, offreSha256: null }),
    );
    await signerDocument(entreeClient({ choixOffre: undefined, cgvAccepteeAt: undefined }));
    expect(donnees()["hashVersion"]).toBe(3);
  });

  it("un choix fourni pour un devis sans offre est refusé (`choix_incoherent`)", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(null));
    attendRefus(await signerDocument(entreeClient()), "choix_incoherent");
  });
});

describe("devis à formules — signature RENFORCÉE (lot 4 bis)", () => {
  it("scelle la déclaration normalisée, le pouvoir et le code vérifié ; facteur « code_email »", async () => {
    const res = await signerDocument(entreeClient());
    expect(res).toMatchObject({ ok: true });
    const d = donnees();
    expect(d["declarationNom"]).toBe("Camille Durand"); // espaces normalisés
    expect(d["declarationFonction"]).toBe("Gérante");
    expect(d["pouvoirDeclareAt"]).toEqual(POUVOIR_LE);
    // Valeur SERVEUR relue en base (le code consommé), jamais une heure venue de l'appelant.
    expect(d["codeVerifieAt"]).toEqual(CODE_UTILISE_LE);
    expect(d["facteurVerification"]).toBe("code_email");
    expect(d["consentementVersion"]).toBe("doc-consent-code-v1");
    expect(d["hashVersion"]).toBe(4);
  });

  it("🔴 la ligne renforcée se vérifie ; modifier la déclaration, la fonction ou le code la casse", async () => {
    await signerDocument(entreeClient());
    const d = donnees();
    const ligne = {
      id: d["id"],
      documentGenereId: DOC,
      provider: "interne",
      providerSubmissionId: null,
      partie: "client",
      signataireNom: d["signataireNom"],
      signataireEmail: d["signataireEmail"],
      signataireQualite: d["signataireQualite"],
      documentHashSha256: "c".repeat(64),
      methode: "trace",
      signatureSha256: d["signatureSha256"],
      mentionVersion: d["mentionVersion"],
      consentementVersion: d["consentementVersion"],
      signeAt: d["signeAt"],
      prevHash: null,
      selfHash: d["selfHash"],
      hashVersion: 4,
      facteurVerification: d["facteurVerification"],
      declarationNom: d["declarationNom"],
      declarationFonction: d["declarationFonction"],
      pouvoirDeclareAt: d["pouvoirDeclareAt"],
      codeVerifieAt: d["codeVerifieAt"],
      cgvVersion: d["cgvVersion"],
      choixOffre: d["choixOffre"],
      choixOffreSha256: d["choixOffreSha256"],
      cgvTexteSha256: d["cgvTexteSha256"],
      cgvPdfSha256: null,
      cgvAccepteeAt: d["cgvAccepteeAt"],
      cgvTraceSha256: null,
      jetonId: d["jetonId"],
    } as unknown as LigneDocumentSignature;
    const p = { documentNumero: NUMERO_PIECE, documentType: "devis" };
    expect(verifierChaine([maillonDocumentDepuisLigne(ligne, p)]).valide).toBe(true);
    for (const mod of [
      { declarationNom: "Quelqu'un d'autre" },
      { declarationFonction: "Président" },
      { codeVerifieAt: new Date("2026-11-10T09:58:00.000Z") },
      { facteurVerification: null },
    ]) {
      expect(verifierChaine([maillonDocumentDepuisLigne({ ...ligne, ...mod }, p)]).valide).toBe(
        false,
      );
    }
  });

  it("le texte exact accepté est scellé : empreinte des CGV, du choix (donc de l'offre) et du devis (PDF)", async () => {
    await signerDocument(entreeClient());
    const d = donnees();
    expect(d["cgvTexteSha256"]).toBe(empreinteTexteCgv());
    expect(d["choixOffreSha256"]).toBe(sha256Choix(CHOIX));
    expect(d["documentHashSha256"]).toBe("c".repeat(64));
  });

  it("pose la ligne d'horodatage dans la transaction, sur l'empreinte du sceau", async () => {
    await signerDocument(entreeClient());
    expect(mockPrisma.documentSignatureHorodatage.create).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.documentSignatureHorodatage.create.mock.calls[0]![0] as {
      data: { signatureId: string; empreinteSha256: string; prochainEssaiAt: Date };
    };
    expect(arg.data.signatureId).toBe(donnees()["id"]);
    expect(arg.data.empreinteSha256).toBe(donnees()["selfHash"]);
    expect(arg.data.prochainEssaiAt).toEqual(MAINTENANT);
  });

  it("🔴 sans déclaration : `declaration_requise`, rien n'est écrit", async () => {
    attendRefus(
      await signerDocument(entreeClient({ renforcee: undefined })),
      "declaration_requise",
    );
    expect(mockPrisma.documentSignatureHorodatage.create).not.toHaveBeenCalled();
  });

  it("🔴 nom, fonction illisibles ou 2 caractères manquants : `declaration_requise`", async () => {
    for (const renforcee of [
      { declarationNom: "", declarationFonction: "Gérante", pouvoirDeclareAt: POUVOIR_LE },
      { declarationNom: "Camille Durand", declarationFonction: " ", pouvoirDeclareAt: POUVOIR_LE },
      { declarationNom: "C", declarationFonction: "Gérante", pouvoirDeclareAt: POUVOIR_LE },
      {
        declarationNom: "Camille\nDurand",
        declarationFonction: "Gérante",
        pouvoirDeclareAt: POUVOIR_LE,
      },
      {
        declarationNom: "x".repeat(201),
        declarationFonction: "Gérante",
        pouvoirDeclareAt: POUVOIR_LE,
      },
    ]) {
      vi.clearAllMocks();
      beforeEachMocks();
      attendRefus(await signerDocument(entreeClient({ renforcee })), "declaration_requise");
    }
  });

  it("🔴 un pouvoir déclaré APRÈS la signature est refusé (horloge du navigateur ou antidate)", async () => {
    attendRefus(
      await signerDocument(
        entreeClient({
          renforcee: {
            declarationNom: "Camille Durand",
            declarationFonction: "Gérante",
            pouvoirDeclareAt: new Date(MAINTENANT.getTime() + 1000),
          },
        }),
      ),
      "declaration_requise",
    );
  });

  it("🔴 sans code consommé : `code_requis`", async () => {
    mockPrisma.documentSignatureCode.findFirst.mockResolvedValue(null);
    attendRefus(await signerDocument(entreeClient()), "code_requis");
  });

  it("🔴 un code consommé il y a plus de 10 minutes ne signe plus : `code_requis`", async () => {
    mockPrisma.documentSignatureCode.findFirst.mockResolvedValue({
      id: "code-1",
      utiliseAt: new Date(MAINTENANT.getTime() - 10 * 60 * 1000 - 1),
    });
    attendRefus(await signerDocument(entreeClient()), "code_requis");
  });

  it("🔴 défense en profondeur : le code est relu pour le LIEN en cours (jetonId)", async () => {
    mockPrisma.documentSignatureCode.findFirst.mockResolvedValue(null);
    attendRefus(await signerDocument(entreeClient()), "code_requis");
    expect(mockPrisma.documentSignatureCode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ jetonId: TOKEN, utiliseAt: { not: null } }),
      }),
    );
  });

  it("devis expiré : refusé même avec un code valide", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(
      piece({ ...DEVIS_FORMULES, dateValidite: new Date("2026-11-10T10:00:00.000Z") }),
    );
    attendRefus(await signerDocument(entreeClient()), "devis_expire");
  });

  it("la contresignature d'Axion-IA est scellée en V4 sans déclaration, et horodatée aussi", async () => {
    mockPrisma.documentSignature.findMany.mockResolvedValue([
      { partie: "client" },
      { partie: "axionia" },
    ]);
    mockPrisma.documentSignature.findFirst.mockImplementation(
      async (args: { where: { partie?: string } }) =>
        args.where.partie === "client"
          ? { choixOffre: CHOIX, choixOffreSha256: sha256Choix(CHOIX) }
          : { selfHash: "b".repeat(64) },
    );
    const res = await signerDocument({
      documentGenereId: DOC,
      porteur: { type: "organisme_authentifie", adminId: "a1", partie: "axionia" },
      methode: "trace",
      partiesRequises: ["client", "axionia"],
      imageDataUrl: "data:image/png;base64,AAAA",
      maintenant: MAINTENANT,
    });
    expect(res).toMatchObject({ ok: true });
    const d = donnees();
    expect(d["hashVersion"]).toBe(4);
    expect(d["declarationNom"] ?? null).toBeNull();
    expect(d["codeVerifieAt"] ?? null).toBeNull();
    expect(mockPrisma.documentSignatureHorodatage.create).toHaveBeenCalledTimes(1);
  });

  it("un devis SANS offre reste en V3 : ni déclaration ni horodatage", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(null));
    const res = await signerDocument(
      entreeClient({ choixOffre: undefined, renforcee: undefined, consentementVersion: undefined }),
    );
    expect(res).toMatchObject({ ok: true });
    expect(donnees()["hashVersion"]).toBe(3);
    expect(donnees()["declarationNom"]).toBeUndefined();
    expect(mockPrisma.documentSignatureHorodatage.create).not.toHaveBeenCalled();
  });
});

/** Rejoue les valeurs par défaut des mocks (après un `clearAllMocks` en cours de test). */
function beforeEachMocks(): void {
  mockPrisma.documentGenere.findUnique.mockResolvedValue(piece(DEVIS_FORMULES));
  mockPrisma.documentGenere.update.mockResolvedValue({ id: DOC });
  mockPrisma.documentSignature.findFirst.mockResolvedValue(null);
  mockPrisma.documentSignature.findMany.mockResolvedValue([{ partie: "client" }]);
  mockPrisma.documentSignature.count.mockResolvedValue(0);
  mockPrisma.documentSignature.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: args.data["id"],
      selfHash: args.data["selfHash"],
    }),
  );
  mockPrisma.documentSignatureToken.findUnique.mockResolvedValue({
    documentGenereId: DOC,
    partie: "client",
    signataireNom: "Camille Durand",
    signataireEmail: "camille@client.test",
    signataireQualite: "Gérante",
    expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    revokedAt: null,
  });
  mockPrisma.documentSignatureCode.findFirst.mockResolvedValue({
    id: "code-1",
    utiliseAt: CODE_UTILISE_LE,
  });
  mockPrisma.documentSignatureHorodatage.create.mockResolvedValue({ id: "h1" });
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(mockPrisma),
  );
  mockStore.mockResolvedValue({
    key: "emargement/2026/signatures/x.png",
    sha256: "a".repeat(64),
    mimeType: "image/png",
    sizeBytes: 10,
  });
}
