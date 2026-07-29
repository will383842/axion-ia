/**
 * Tests — document-signature-service.ts
 *
 * C'est le seul endroit du dépôt qui écrit une ligne `document_signatures`.
 * Cinq familles d'invariants, et les violer ne se voit pas en revue de diff :
 *
 *  1. **Autorisation avant tout.** Un formateur qui n'anime pas la session ne
 *     signe pas sa convention — et il ne doit pas non plus apprendre, par le
 *     message de refus, si une autre partie a déjà signé.
 *  2. **Aucune écriture sur un refus.** Ni objet R2, ni ligne.
 *  3. **L'identité vient du serveur** sur le canal maison, jamais de l'entrée.
 *  4. **Rien ne se signe sur une pièce qui n'a pas de valeur** : ni un SPÉCIMEN,
 *     ni une pièce sans empreinte.
 *  5. **Le statut dérivé ne ment pas** — `signee` seulement quand toutes les
 *     parties requises ont signé, et il retombe à la révocation.
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
import { storeSignatureImage, supprimerImageSignature } from "@/server/qualiopi/emargement/storage";
import {
  signerDocument,
  revoquerSignatureDocument,
  type PorteurSignatureDocument,
} from "./document-signature-service";
import { verifierChaine } from "@/server/qualiopi/emargement/hash";
import {
  maillonDocumentDepuisLigne,
  HASH_VERSION_DOCUMENT,
  type LigneDocumentSignature,
} from "./document-signature-hash";
import { MENTION_VERSION_DOCUMENT, CONSENTEMENT_VERSION_DOCUMENT } from "./mentions-document";
import { Prisma } from "../../../../../prisma/generated/client";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  documentGenere: { findUnique: Mock; update: Mock };
  documentSignature: {
    findFirst: Mock;
    findMany: Mock;
    findUnique: Mock;
    create: Mock;
    count: Mock;
    update: Mock;
  };
  trainer: { findUnique: Mock };
  adminUser: { findUnique: Mock };
  $transaction: Mock;
};
const mockStore = storeSignatureImage as unknown as Mock;
const mockSupprimerImage = supprimerImageSignature as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const TRAINER = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const SESSION = "44444444-4444-4444-8444-444444444444";
const IMAGE = "data:image/png;base64,AAAA";
const MAINTENANT = new Date("2026-06-10T10:15:30.123Z");

const PORTEUR_FORMATEUR: PorteurSignatureDocument = {
  type: "formateur_authentifie",
  trainerId: TRAINER,
  partie: "formateur",
};

function piece(over: Record<string, unknown> = {}) {
  return {
    id: DOC,
    numero: "AXI-CONV-2026-0042",
    type: "convention",
    hashSha256: "c".repeat(64),
    metadata: {},
    sessionId: SESSION,
    coachingSessionId: null,
    signatures: [] as Array<{ id: string }>,
    coachingSession: null as { trainerId: string } | null,
    session: { sessionFormateurs: [{ trainerId: TRAINER }] },
    ...over,
  };
}

function entree(over: Record<string, unknown> = {}) {
  return {
    documentGenereId: DOC,
    porteur: PORTEUR_FORMATEUR,
    methode: "trace" as const,
    partiesRequises: ["formateur", "axionia"] as const,
    imageDataUrl: IMAGE,
    maintenant: MAINTENANT,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // ⚠️ `clearAllMocks` efface les appels, PAS les valeurs de retour : on les
  // repose explicitement à chaque test.
  mockPrisma.documentGenere.findUnique.mockResolvedValue(piece());
  mockPrisma.documentGenere.update.mockResolvedValue({ id: DOC });
  mockPrisma.documentSignature.findFirst.mockResolvedValue(null);
  mockPrisma.documentSignature.findMany.mockResolvedValue([{ partie: "formateur" }]);
  mockPrisma.documentSignature.count.mockResolvedValue(0);
  mockPrisma.documentSignature.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: args.data["id"],
      selfHash: args.data["selfHash"],
    }),
  );
  mockPrisma.trainer.findUnique.mockResolvedValue({
    nom: "Jullin",
    prenom: "Williams",
    email: "w@axion.test",
  });
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
    sizeBytes: 1234,
  });
  mockSupprimerImage.mockResolvedValue(undefined);
});

/** Données réellement passées à `create`, pour inspecter ce qui a été scellé. */
function donneesCreees(): Record<string, unknown> {
  return mockPrisma.documentSignature.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
}

function attendRefus(res: unknown, raison: string) {
  expect(res).toStrictEqual({ ok: false, raison, message: expect.any(String) });
  expect(mockStore).not.toHaveBeenCalled();
  expect(mockPrisma.documentSignature.create).not.toHaveBeenCalled();
}

describe("🔴 autorisation du porteur", () => {
  it("refuse un formateur qui n'anime PAS la session", async () => {
    attendRefus(
      await signerDocument(
        entree({
          porteur: {
            type: "formateur_authentifie",
            trainerId: "99999999-9999-4999-8999-999999999999",
            partie: "formateur",
          },
        }),
      ),
      "porteur_non_autorise",
    );
  });

  it("accepte le formateur du parcours AFEST rattaché à la pièce", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(
      piece({ sessionId: null, session: null, coachingSession: { trainerId: TRAINER } }),
    );
    const res = await signerDocument(entree());
    expect(res).toMatchObject({ ok: true });
  });

  it("🔴 le refus d'autorisation passe AVANT `deja_signe` — sinon il fuite l'état", async () => {
    // Un appelant non autorisé qui devine un identifiant de pièce ne doit pas
    // apprendre si une autre partie a déjà signé.
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece({ signatures: [{ id: "deja" }] }));
    attendRefus(
      await signerDocument(
        entree({
          porteur: {
            type: "formateur_authentifie",
            trainerId: "99999999-9999-4999-8999-999999999999",
            partie: "formateur",
          },
        }),
      ),
      "porteur_non_autorise",
    );
  });

  it("un membre de l'organisme est autorisé sur toute pièce", async () => {
    const res = await signerDocument(
      entree({ porteur: { type: "organisme_authentifie", adminId: ADMIN, partie: "axionia" } }),
    );
    expect(res).toMatchObject({ ok: true });
  });

  it("🔴 un formateur ne peut PAS signer au titre du CLIENT", async () => {
    // Le porteur est autorisé sur la pièce, et sans ce recoupement rien ne
    // vérifiait le TITRE auquel il signe : l'identité scellée aurait été la
    // sienne, mais la ligne aurait dit « le client a accepté ».
    attendRefus(
      await signerDocument(
        entree({
          partiesRequises: ["client", "axionia"],
          porteur: { type: "formateur_authentifie", trainerId: TRAINER, partie: "client" },
        }),
      ),
      "porteur_non_autorise",
    );
  });

  it("🔴 un membre de l'organisme ne peut PAS signer au titre du FINANCEUR", async () => {
    attendRefus(
      await signerDocument(
        entree({
          partiesRequises: ["financeur", "axionia"],
          porteur: { type: "organisme_authentifie", adminId: ADMIN, partie: "financeur" },
        }),
      ),
      "porteur_non_autorise",
    );
  });

  it("le canal papier, lui, peut verser n'importe quelle partie — l'organisme en répond", async () => {
    const res = await signerDocument(
      entree({
        methode: "papier_scanne",
        partiesRequises: ["client", "axionia"],
        porteur: {
          type: "reversement_papier",
          adminId: ADMIN,
          provider: "physical_signed",
          partie: "client",
          signataire: { nom: "Camille Durand" },
        },
      }),
    );
    expect(res).toMatchObject({ ok: true });
    // ⚠️ Et il est ENREGISTRÉ : sans cela le reversement serait anonyme.
    expect(donneesCreees()["recueilliParAdminId"]).toBe(ADMIN);
  });

  it("🔴 refuse un reversement papier par un compte NON habilité", async () => {
    // Sans ce contrôle, `adminId` serait un paramètre décoratif — un contrôle
    // qu'on croit exercer et qui n'existe pas.
    mockPrisma.adminUser.findUnique.mockResolvedValue({
      name: "Lecteur",
      email: "l@axion.test",
      status: "active",
      role: "reader",
    });
    attendRefus(
      await signerDocument(
        entree({
          methode: "papier_scanne",
          porteur: {
            type: "reversement_papier",
            adminId: ADMIN,
            provider: "physical_signed",
            partie: "formateur",
            signataire: { nom: "Camille Durand" },
          },
        }),
      ),
      "porteur_non_autorise",
    );
  });
});

describe("🔴 gardes sur la pièce", () => {
  it("refuse de signer un SPÉCIMEN", async () => {
    // Une pièce qui affirme elle-même n'avoir aucune valeur juridique ne peut pas
    // porter une preuve d'engagement : c'est la contradiction qu'un contrôle relève.
    mockPrisma.documentGenere.findUnique.mockResolvedValue(
      piece({ metadata: { specimen: true, champsManquants: ["siret"] } }),
    );
    attendRefus(await signerDocument(entree()), "piece_specimen");
  });

  it("ne se laisse pas berner par un `metadata` qui n'est pas un objet", async () => {
    // Colonne `Json` : le type n'est PAS garanti côté application.
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece({ metadata: ["specimen"] }));
    expect(await signerDocument(entree())).toMatchObject({ ok: true });
  });

  it("refuse une pièce sans empreinte", async () => {
    // `documentHashSha256` est scellé dans le tuple : sans empreinte, la
    // signature ne porterait sur rien de vérifiable.
    mockPrisma.documentGenere.findUnique.mockResolvedValue(piece({ hashSha256: "  " }));
    attendRefus(await signerDocument(entree()), "piece_non_scellee");
  });
});

describe("🔴 cohérences de forme", () => {
  it("refuse une liste de parties requises vide", async () => {
    attendRefus(await signerDocument(entree({ partiesRequises: [] })), "parties_requises_absentes");
  });

  it("refuse une partie qui n'a rien à faire sur cette pièce", async () => {
    attendRefus(
      await signerDocument(entree({ partiesRequises: ["client", "axionia"] })),
      "partie_non_attendue",
    );
  });

  it("refuse un tracé annoncé sans image", async () => {
    attendRefus(await signerDocument(entree({ imageDataUrl: undefined })), "image_requise");
  });

  it("refuse un `papier_scanne` sans scan", async () => {
    // « signé sur papier, jamais photographié » n'est PAS enregistrable : une
    // ligne sans image, sans certificat de tiers et sans confirmation nominative
    // n'est adossée à rien.
    attendRefus(
      await signerDocument(entree({ methode: "papier_scanne", imageDataUrl: undefined })),
      "image_requise",
    );
  });

  it("refuse une confirmation accessible ACCOMPAGNÉE d'une image", async () => {
    attendRefus(
      await signerDocument(entree({ methode: "confirmation_accessible" })),
      "image_interdite",
    );
  });

  it("accepte une confirmation accessible sans image, et ne stocke rien", async () => {
    const res = await signerDocument(
      entree({ methode: "confirmation_accessible", imageDataUrl: undefined }),
    );
    expect(res).toMatchObject({ ok: true });
    expect(mockStore).not.toHaveBeenCalled();
    expect(donneesCreees()["signatureSha256"]).toBeNull();
    expect(donneesCreees()["signatureKey"]).toBeNull();
  });

  it("🔴 une ligne maison ne porte JAMAIS d'identifiant de submission", async () => {
    await signerDocument(entree());
    expect(donneesCreees()["provider"]).toBe("interne");
    expect(donneesCreees()["providerSubmissionId"]).toBeNull();
  });

  it("refuse un canal fournisseur dont l'identifiant de submission est vide", async () => {
    attendRefus(
      await signerDocument(
        entree({
          porteur: {
            type: "fournisseur",
            provider: "docuseal",
            submissionId: "   ",
            partie: "formateur",
            signataire: { nom: "Camille Durand" },
          },
        }),
      ),
      "submission_incoherente",
    );
  });
});

describe("🔴 l'identité vient du serveur sur le canal maison", () => {
  it("scelle le nom lu de la base, pas celui de l'entrée", async () => {
    await signerDocument(entree());
    expect(donneesCreees()["signataireNom"]).toBe("Williams Jullin");
    expect(donneesCreees()["signataireEmail"]).toBe("w@axion.test");
  });

  it("refuse plutôt que de sceller un repli littéral quand le nom manque", async () => {
    // Sceller « Le formateur » produirait une signature juridiquement anonyme —
    // exactement le défaut retiré côté AFEST.
    mockPrisma.trainer.findUnique.mockResolvedValue({ nom: "  ", prenom: " ", email: null });
    attendRefus(await signerDocument(entree()), "identite_non_resolvable");
  });

  it("🔴 un compte d'organisme SUSPENDU ne signe pas", async () => {
    // Sa suspension est précisément la révocation de son pouvoir d'engager.
    mockPrisma.adminUser.findUnique.mockResolvedValue({
      name: "Ancien Salarié",
      email: "x@axion.test",
      status: "suspended",
      role: "admin",
    });
    attendRefus(
      await signerDocument(
        entree({ porteur: { type: "organisme_authentifie", adminId: ADMIN, partie: "axionia" } }),
      ),
      "identite_non_resolvable",
    );
  });

  it("🔴 un compte `editor` n'engage PAS l'organisme", async () => {
    // Il n'a jamais reçu le pouvoir de conclure : lui laisser écrire une ligne
    // `axionia` fabriquerait un engagement par une personne non habilitée.
    mockPrisma.adminUser.findUnique.mockResolvedValue({
      name: "Éditrice",
      email: "e@axion.test",
      status: "active",
      role: "editor",
    });
    attendRefus(
      await signerDocument(
        entree({ porteur: { type: "organisme_authentifie", adminId: ADMIN, partie: "axionia" } }),
      ),
      "identite_non_resolvable",
    );
  });

  it("le canal papier accepte une identité fournie — plafond probant assumé", async () => {
    const res = await signerDocument(
      entree({
        methode: "papier_scanne",
        porteur: {
          type: "reversement_papier",
          adminId: ADMIN,
          provider: "physical_signed",
          partie: "formateur",
          signataire: { nom: "Camille Durand", qualite: "Gérante" },
        },
      }),
    );
    expect(res).toMatchObject({ ok: true });
    expect(donneesCreees()["signataireNom"]).toBe("Camille Durand");
    expect(donneesCreees()["provider"]).toBe("physical_signed");
    expect(mockPrisma.trainer.findUnique).not.toHaveBeenCalled();
  });
});

describe("🔴 ce qui est réellement écrit", () => {
  it("scelle l'empreinte de la pièce, ses versions, et un `selfHash` recalculable", async () => {
    const res = await signerDocument(entree());
    expect(res).toMatchObject({ ok: true });

    const d = donneesCreees();
    expect(d["documentHashSha256"]).toBe("c".repeat(64));
    expect(d["mentionVersion"]).toBe(MENTION_VERSION_DOCUMENT);
    expect(d["consentementVersion"]).toBe(CONSENTEMENT_VERSION_DOCUMENT);
    expect(d["hashVersion"]).toBe(HASH_VERSION_DOCUMENT);
    expect(d["prevHash"]).toBeNull();

    // L'empreinte écrite doit être recalculable depuis la ligne — sinon la chaîne
    // est décorative dès la première signature.
    const ligne: LigneDocumentSignature = {
      id: d["id"] as string,
      documentGenereId: DOC,
      provider: "interne",
      providerSubmissionId: null,
      partie: "formateur",
      signataireNom: d["signataireNom"] as string,
      signataireEmail: d["signataireEmail"] as string,
      signataireQualite: d["signataireQualite"] as string | null,
      documentHashSha256: "c".repeat(64),
      methode: "trace",
      signatureSha256: d["signatureSha256"] as string,
      mentionVersion: MENTION_VERSION_DOCUMENT,
      consentementVersion: CONSENTEMENT_VERSION_DOCUMENT,
      signeAt: MAINTENANT,
      prevHash: null,
      selfHash: d["selfHash"] as string,
      hashVersion: HASH_VERSION_DOCUMENT,
    };
    const rapport = verifierChaine([
      maillonDocumentDepuisLigne(ligne, {
        documentNumero: "AXI-CONV-2026-0042",
        documentType: "convention",
      }),
    ]);
    expect(rapport).toStrictEqual({ valide: true, anomalies: [], nbVerifies: 1 });
  });

  it("🔴 relit le `prevHash` DANS la transaction, trié sur `createdAt` puis `id`", async () => {
    // Trier sur `signeAt` ferait apparaître comme rompue une chaîne intacte : ce
    // champ est figé avant l'écriture de l'image sur R2, et peut venir d'un tiers.
    mockPrisma.documentSignature.findFirst.mockResolvedValue({ selfHash: "e".repeat(64) });
    await signerDocument(entree());
    const arg = mockPrisma.documentSignature.findFirst.mock.calls[0]?.[0] as {
      orderBy: unknown;
      where: Record<string, unknown>;
    };
    expect(arg.orderBy).toStrictEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(arg.where["revokedAt"]).toBeNull();
    expect(donneesCreees()["prevHash"]).toBe("e".repeat(64));
  });

  it("l'échéance de purge est posée à 5 ans de la signature", async () => {
    await signerDocument(entree());
    expect((donneesCreees()["suppressionPrevueAt"] as Date).getUTCFullYear()).toBe(2031);
  });
});

describe("🔴 statut dérivé", () => {
  it("reste `partielle` tant qu'une partie requise manque", async () => {
    mockPrisma.documentSignature.findMany.mockResolvedValue([{ partie: "formateur" }]);
    const res = await signerDocument(entree());
    expect(res).toMatchObject({ ok: true, statutSignature: "partielle" });
    expect(mockPrisma.documentGenere.update.mock.calls[0]?.[0]).toMatchObject({
      data: { statutSignature: "partielle" },
    });
  });

  it("passe à `signee` quand toutes les parties requises ont signé", async () => {
    mockPrisma.documentSignature.findMany.mockResolvedValue([
      { partie: "formateur" },
      { partie: "axionia" },
    ]);
    const res = await signerDocument(entree());
    expect(res).toMatchObject({ ok: true, statutSignature: "signee" });
  });

  it("🔴 recompte DANS la transaction, pas depuis le contexte lu en amont", async () => {
    // Deux parties signant en parallèle laisseraient sinon la pièce à
    // `partielle` alors qu'elle est complète.
    await signerDocument(entree());
    const appels = mockPrisma.documentSignature.findMany.mock.calls;
    expect(appels).toHaveLength(1);
    expect((appels[0]?.[0] as { where: Record<string, unknown> }).where["revokedAt"]).toBeNull();
  });
});

describe("🔴 conflit de chaîne et nettoyage", () => {
  function p2002() {
    return new Prisma.PrismaClientKnownRequestError("conflit", {
      code: "P2002",
      clientVersion: "x",
    });
  }

  it("réessaie sur une course de chaîne, sans laisser d'image orpheline", async () => {
    mockPrisma.$transaction
      .mockRejectedValueOnce(p2002())
      .mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mockPrisma));
    mockPrisma.documentSignature.count.mockResolvedValue(0);

    const res = await signerDocument(entree());
    expect(res).toMatchObject({ ok: true });
    expect(mockSupprimerImage).not.toHaveBeenCalled();
  });

  it("🔴 interroge la BASE pour distinguer course et doublon — jamais `err.meta.target`", async () => {
    // La forme de `meta.target` pour un index unique PARTIEL créé en SQL brut
    // n'est garantie nulle part : un `undefined` ferait passer une signature déjà
    // posée pour une course.
    mockPrisma.$transaction.mockRejectedValue(p2002());
    mockPrisma.documentSignature.count.mockResolvedValue(1);

    const res = await signerDocument(entree());
    expect(res).toMatchObject({ ok: false, raison: "deja_signe" });
    expect(mockSupprimerImage).toHaveBeenCalledWith("emargement/2026/signatures/x.png");
  });

  it("nettoie l'image quand la transaction échoue pour une autre raison", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("base indisponible"));
    await expect(signerDocument(entree())).rejects.toThrow("base indisponible");
    expect(mockSupprimerImage).toHaveBeenCalledTimes(1);
  });
});

describe("🔴 révocation", () => {
  beforeEach(() => {
    mockPrisma.documentSignature.findUnique.mockResolvedValue({
      id: "sig-1",
      documentGenereId: DOC,
      selfHash: "a".repeat(64),
      revokedAt: null,
    });
    mockPrisma.documentSignature.count.mockResolvedValue(0);
    mockPrisma.documentSignature.update.mockResolvedValue({ id: "sig-1" });
  });

  it("refuse un motif vide — un motif absent ne dit rien à l'auditeur", async () => {
    const res = await revoquerSignatureDocument({
      parAdminId: ADMIN,
      signatureId: "sig-1",
      motif: "   ",
    });
    expect(res).toMatchObject({ ok: false, raison: "motif_requis" });
    expect(mockPrisma.documentSignature.update).not.toHaveBeenCalled();
  });

  it("🔴 REFUSE de révoquer un maillon non terminal", async () => {
    // Le retirer ferait pointer le `prevHash` de son successeur dans le vide :
    // `verifierChaine` rendrait `rupture_chainage`, c'est-à-dire « une ligne a
    // été supprimée après coup », sur une correction légitime.
    mockPrisma.documentSignature.count.mockResolvedValue(1);
    const res = await revoquerSignatureDocument({
      parAdminId: ADMIN,
      signatureId: "sig-1",
      motif: "erreur de partie",
    });
    expect(res).toMatchObject({ ok: false, raison: "revocation_maillon_interne_interdite" });
    expect(mockPrisma.documentSignature.update).not.toHaveBeenCalled();
  });

  it("révoque la queue de chaîne et fait retomber le statut de la pièce", async () => {
    mockPrisma.documentSignature.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const res = await revoquerSignatureDocument({
      parAdminId: ADMIN,
      signatureId: "sig-1",
      motif: "signée à tort",
    });
    expect(res).toStrictEqual({ ok: true });
    expect(mockPrisma.documentGenere.update.mock.calls[0]?.[0]).toMatchObject({
      data: { statutSignature: "partielle" },
    });
  });

  it("🔴 ne remet PAS `non_requise` quand il ne reste aucune signature", async () => {
    // La pièce EXIGE toujours d'être signée, elle ne l'est simplement plus.
    mockPrisma.documentSignature.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    await revoquerSignatureDocument({
      parAdminId: ADMIN,
      signatureId: "sig-1",
      motif: "signée à tort",
    });
    expect(mockPrisma.documentGenere.update.mock.calls[0]?.[0]).toMatchObject({
      data: { statutSignature: "en_attente" },
    });
  });

  it("refuse de re-révoquer", async () => {
    mockPrisma.documentSignature.findUnique.mockResolvedValue({
      id: "sig-1",
      documentGenereId: DOC,
      selfHash: "a".repeat(64),
      revokedAt: new Date(),
    });
    const res = await revoquerSignatureDocument({
      parAdminId: ADMIN,
      signatureId: "sig-1",
      motif: "doublon",
    });
    expect(res).toMatchObject({ ok: false, raison: "deja_revoquee" });
  });
});
