/**
 * Tests — portail-service.ts (T14 — AGENT A).
 *
 * Stratégie : mock @/lib/prisma + @/lib/pii-crypto.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    portailAcces: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    trainee: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn().mockResolvedValue({ enqueued: true }),
}));

vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: vi.fn((v: string | null) => (v === null ? null : `decrypted:${v}`)),
}));

// `signedDocumentPdfUrl` a remplacé l'assemblage manuel `isR2Configured()` +
// clé + `getSignedUrlR2()` : la clé n'est plus recopiée ici, elle a une source
// unique (`documentPdfKey`) testée dans `src/lib/r2-document-key.spec.ts`. Ce
// qui reste à vérifier ici, et qui compte, c'est que le portail sert bien une
// URL FRAÎCHE et jamais la valeur figée en base.
vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: vi.fn().mockReturnValue(false),
  getSignedUrlR2: vi.fn().mockResolvedValue("https://r2.example.com/signed-fresh.pdf"),
  signedDocumentPdfUrl: vi.fn().mockResolvedValue(null),
  // ⚠️ La constante doit figurer dans la fabrique du mock : un export manquant
  // laisse la liaison à `undefined`, et le service signait alors pour une durée
  // indéfinie sans que rien ne le signale.
  TTL_LECTURE_NOMINATIVE_S: 15 * 60,
}));

import { prisma } from "@/lib/prisma";
import { isR2Configured, getSignedUrlR2, signedDocumentPdfUrl } from "@/lib/r2-storage";
import { enqueueEmail } from "@/server/queue/queues";
import {
  creerAcces,
  verifierToken,
  revoquerAcces,
  getEspaceStagiaire,
  demanderAccesParEmail,
} from "./portail-service";

const mockPrisma = prisma as unknown as {
  portailAcces: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  trainee: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const mockIsR2Configured = isR2Configured as ReturnType<typeof vi.fn>;
const mockGetSignedUrlR2 = getSignedUrlR2 as ReturnType<typeof vi.fn>;
const mockSignedDocumentPdfUrl = signedDocumentPdfUrl as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// creerAcces
// ─────────────────────────────────────────────────────────────────────────────

describe("creerAcces", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cree un acces et retourne id, token (64 chars hex), expiresAt", async () => {
    const fakeExpires = new Date(Date.now() + 90 * 86400 * 1000);
    mockPrisma.portailAcces.create.mockResolvedValue({
      id: "acces-uuid-1",
      token: "a".repeat(64),
      expiresAt: fakeExpires,
    });

    const result = await creerAcces("trainee-1");

    expect(result.id).toBe("acces-uuid-1");
    expect(result.token).toHaveLength(64);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(mockPrisma.portailAcces.create).toHaveBeenCalledOnce();
  });

  it("transmet traineeId et expiresAt calcule a Prisma", async () => {
    const fakeExpires = new Date();
    mockPrisma.portailAcces.create.mockResolvedValue({
      id: "acces-2",
      token: "b".repeat(64),
      expiresAt: fakeExpires,
    });

    const before = Date.now();
    await creerAcces("trainee-2", 30);
    const after = Date.now();

    const callArg = mockPrisma.portailAcces.create.mock.calls[0]![0] as {
      data: { traineeId: string; expiresAt: Date };
    };
    expect(callArg.data.traineeId).toBe("trainee-2");
    const expiresMs = callArg.data.expiresAt.getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + 30 * 86400 * 1000 - 2000);
    expect(expiresMs).toBeLessThanOrEqual(after + 30 * 86400 * 1000 + 2000);
  });

  it("leve si DATABASE_URL contient stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(creerAcces("any")).rejects.toThrow("stub DB");
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

describe("🔴 D4-4-A — le jeton du portail n'est JAMAIS stocké en clair", () => {
  beforeEach(() => vi.clearAllMocks());

  function sha256Hex(v: string): string {
    return createHash("sha256").update(v, "utf8").digest("hex");
  }

  it("écrit un HASH en base, jamais le clair", async () => {
    // Ce jeton EST le mot de passe du portail : il ouvre l'espace stagiaire —
    // besoins d'adaptation, données de santé, pièces nominatives — et il vit
    // 90 jours. Le stocker en clair fait d'une lecture de `portail_acces`
    // (dump, sauvegarde, accès en lecture, injection SQL) une liste de
    // sésames directement utilisables, pour tous les stagiaires à la fois.
    //
    // Les trois autres canaux de jeton du dépôt stockent déjà un SHA-256
    // (`DocumentSignatureToken.tokenHash`, `EmargementToken`). Celui-ci était
    // l'exception, et c'est le seul qui vaut une SESSION persistante.
    mockPrisma.portailAcces.create.mockResolvedValue({
      id: "acces-h1",
      expiresAt: new Date(),
    });

    const { token } = await creerAcces("trainee-h");
    const data = mockPrisma.portailAcces.create.mock.calls[0]![0].data as Record<string, unknown>;

    expect(JSON.stringify(data)).not.toContain(token);
    expect(data["tokenHash"]).toBe(sha256Hex(token));
    expect(data["token"]).toBeUndefined();
  });

  it("rend le CLAIR à l'appelant — sinon le lien envoyé serait inutilisable", async () => {
    // Témoin SYMÉTRIQUE, et le seul qui distingue le correctif de la panne.
    // Hacher partout, retour compris, passerait le test précédent et enverrait
    // à chaque stagiaire un lien portant un hash : 404 silencieux à l'ouverture,
    // sans que rien ne le signale côté organisme.
    mockPrisma.portailAcces.create.mockResolvedValue({
      id: "acces-h2",
      expiresAt: new Date(),
    });

    const { token } = await creerAcces("trainee-h2");

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const data = mockPrisma.portailAcces.create.mock.calls[0]![0].data as Record<string, unknown>;
    expect(token).not.toBe(data["tokenHash"]);
  });

  it("verifierToken cherche par HASH — le clair ne sert plus de clé", async () => {
    mockPrisma.portailAcces.findUnique.mockResolvedValue(null);
    const clair = "d".repeat(64);

    await verifierToken(clair);

    expect(mockPrisma.portailAcces.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: sha256Hex(clair) } }),
    );
  });

  it("le schéma Prisma ne déclare AUCUNE colonne de jeton en clair", () => {
    // Garde de STRUCTURE : le correctif applicatif ne vaut rien si la colonne
    // survit. Elle porterait les jetons de tous les accès émis avant la
    // migration — c'est-à-dire exactement ceux qui sont encore valables.
    const schema = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const debut = schema.indexOf("model PortailAcces {");
    expect(debut).toBeGreaterThan(-1);
    const modele = schema.slice(debut, schema.indexOf("\n}", debut));
    expect(modele).not.toBe("");
    expect(modele).toMatch(/tokenHash\s+String\s+@unique/);
    expect(modele).not.toMatch(/^\s*token\s+String/m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifierToken
// ─────────────────────────────────────────────────────────────────────────────

describe("verifierToken", () => {
  beforeEach(() => vi.clearAllMocks());

  const validToken = "c".repeat(64);
  const validAcces = {
    id: "acces-v1",
    traineeId: "trainee-v1",
    token: validToken,
    expiresAt: new Date(Date.now() + 86400 * 1000),
    revoked: false,
  };

  it("retourne traineeId pour un token valide non-revoque non-expire", async () => {
    mockPrisma.portailAcces.findUnique.mockResolvedValue(validAcces);
    mockPrisma.portailAcces.update.mockResolvedValue({});

    const result = await verifierToken(validToken);

    expect(result).toEqual({ traineeId: "trainee-v1" });
  });

  it("retourne null si token inconnu (findUnique=null)", async () => {
    mockPrisma.portailAcces.findUnique.mockResolvedValue(null);

    const result = await verifierToken("tok-inconnu".padEnd(64, "0"));

    expect(result).toBeNull();
    expect(mockPrisma.portailAcces.update).not.toHaveBeenCalled();
  });

  it("retourne null si revoked=true", async () => {
    mockPrisma.portailAcces.findUnique.mockResolvedValue({ ...validAcces, revoked: true });

    const result = await verifierToken(validToken);

    expect(result).toBeNull();
  });

  it("retourne null si expiresAt est dans le passe", async () => {
    mockPrisma.portailAcces.findUnique.mockResolvedValue({
      ...validAcces,
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await verifierToken(validToken);

    expect(result).toBeNull();
  });

  it("met a jour lastUsedAt sur verification reussie", async () => {
    mockPrisma.portailAcces.findUnique.mockResolvedValue(validAcces);
    mockPrisma.portailAcces.update.mockResolvedValue({});

    await verifierToken(validToken);
    await Promise.resolve();

    expect(mockPrisma.portailAcces.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "acces-v1" },
        data: expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      }),
    );
  });

  it("retourne null en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await verifierToken("any".padEnd(64, "0"));
      expect(result).toBeNull();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// revoquerAcces
// ─────────────────────────────────────────────────────────────────────────────

describe("revoquerAcces", () => {
  beforeEach(() => vi.clearAllMocks());

  it("appelle prisma.portailAcces.update avec revoked=true", async () => {
    mockPrisma.portailAcces.update.mockResolvedValue({});

    await revoquerAcces("acces-r1");

    expect(mockPrisma.portailAcces.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "acces-r1" },
        data: { revoked: true },
      }),
    );
  });

  it("leve si stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(revoquerAcces("any")).rejects.toThrow("stub DB");
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getEspaceStagiaire
// ─────────────────────────────────────────────────────────────────────────────

describe("getEspaceStagiaire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsR2Configured.mockReturnValue(false);
    mockGetSignedUrlR2.mockResolvedValue("https://r2.example.com/signed-fresh.pdf");
  });

  const fakeTrainee = {
    prenom: "Alice",
    nom: "Dupont",
    situationHandicap: true,
    handicapDetailsChiffre: "enc:v1:aabbcc:ddeeff:112233",
    enrollments: [
      {
        statut: "confirmee",
        createdAt: new Date("2026-01-01"),
        session: {
          titreSession: "Formation IA",
          dateDebut: new Date("2026-02-01"),
          dateFin: new Date("2026-02-02"),
        },
        attestationDocument: {
          type: "attestation",
          numero: "AXI-ATT-2026-001",
          pdfUrl: "https://example.com/att.pdf",
          qrToken: "qr-token-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          createdAt: new Date("2026-02-02T10:00:00Z"),
        },
        questionnaires: [
          {
            type: "satisfaction_chaud",
            token: "quest-tok-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            reponduAt: null,
          },
        ],
      },
    ],
  };

  it("retourne l'espace stagiaire avec formations, attestations, questionnaires", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    const espace = await getEspaceStagiaire("trainee-g1");

    expect(espace.trainee).toEqual({ prenom: "Alice", nom: "Dupont" });
    expect(espace.formations).toHaveLength(1);
    expect(espace.formations[0]!.titre).toBe("Formation IA");
    expect(espace.attestations).toHaveLength(1);
    expect(espace.attestations[0]!.numero).toBe("AXI-ATT-2026-001");
    expect(espace.questionnaires).toHaveLength(1);
  });

  it("dechiffre le detail handicap via decryptPii", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    const espace = await getEspaceStagiaire("trainee-g2");

    expect(espace.situationHandicap.declaree).toBe(true);
    expect(espace.situationHandicap.details).toBe("decrypted:enc:v1:aabbcc:ddeeff:112233");
  });

  it("retourne details=null si handicapDetailsChiffre est null", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue({
      ...fakeTrainee,
      situationHandicap: false,
      handicapDetailsChiffre: null,
    });

    const espace = await getEspaceStagiaire("trainee-g3");

    expect(espace.situationHandicap.declaree).toBe(false);
    expect(espace.situationHandicap.details).toBeNull();
  });

  it("leve si le stagiaire est introuvable", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue(null);

    await expect(getEspaceStagiaire("trainee-inconnu")).rejects.toThrow("introuvable");
  });

  it("retourne un espace vide en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const espace = await getEspaceStagiaire("any");
      expect(espace.formations).toEqual([]);
      expect(espace.attestations).toEqual([]);
      expect(espace.questionnaires).toEqual([]);
      expect(mockPrisma.trainee.findUnique).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  // ── S1 : URL signée régénérée à CHAQUE lecture ────────────────────────────

  it("S1 : régénère une URL signée fraîche si R2 configuré", async () => {
    mockSignedDocumentPdfUrl.mockResolvedValue("https://r2.example.com/signed-fresh.pdf");
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    const espace = await getEspaceStagiaire("trainee-s1");

    expect(mockSignedDocumentPdfUrl).toHaveBeenCalledOnce();
    expect(espace.attestations[0]!.pdfUrl).toBe("https://r2.example.com/signed-fresh.pdf");
  });

  // Le document est passé ENTIER : c'est lui qui porte les trois champs dont la
  // clé est faite. Les recopier ici reviendrait à réintroduire la huitième
  // version maison de la clé — celle dont la divergence a cassé la lecture
  // avant signature. La clé elle-même est vérifiée sur `documentPdfKey`.
  it("S1 : passe au signeur le type, le numéro et la date de la pièce", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue({
      ...fakeTrainee,
      enrollments: [
        {
          ...fakeTrainee.enrollments[0],
          attestationDocument: {
            type: "attestation_partielle",
            numero: "AXI-ATT-2025-042",
            pdfUrl: "https://example.com/old.pdf",
            qrToken: null,
            createdAt: new Date("2025-11-15T09:00:00Z"),
          },
        },
      ],
    });

    await getEspaceStagiaire("trainee-s1b");

    expect(mockSignedDocumentPdfUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "attestation_partielle",
        numero: "AXI-ATT-2025-042",
        createdAt: new Date("2025-11-15T09:00:00Z"),
      }),
      15 * 60,
    );
  });

  it("🔴 ne signe PAS une pièce nominative pour la journée", async () => {
    // 🔴 2026-08-19 (`D4-4-C`). Ce test-ci exigeait `86400` — il ENTÉRINAIT le
    // défaut : la garde figeait la mauvaise valeur, et corriger le service
    // faisait rougir la suite. Une garde qui rend le correctif douloureux
    // finit par être « ajustée » plutôt que relue.
    //
    // Une URL pré-signée ne traverse aucune session : qui la détient lit la
    // pièce. Vingt-quatre heures de droit de lecture ANONYME sur un document
    // nominatif, pour un lien cliqué dans la minute qui suit son affichage.
    //
    // Le seuil est posé LARGE (une heure) exprès : il n'impose pas une valeur,
    // il interdit de dériver vers la journée sans que personne ne le voie.
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    await getEspaceStagiaire("trainee-s1c");

    const durees = mockSignedDocumentPdfUrl.mock.calls.map((appel) => appel[1] as number);
    expect(durees.length).toBeGreaterThan(0);
    for (const duree of durees) {
      expect(duree).toBeLessThanOrEqual(3600);
    }
  });

  it("S1 : fallback vers pdfUrl DB si R2 non configuré", async () => {
    // `signedDocumentPdfUrl` renvoie null quand R2 n'est pas configuré.
    mockSignedDocumentPdfUrl.mockResolvedValue(null);
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    const espace = await getEspaceStagiaire("trainee-s1c");

    expect(espace.attestations[0]!.pdfUrl).toBe("https://example.com/att.pdf");
  });

  it("S1 : fallback fail-soft vers pdfUrl DB si la signature lève", async () => {
    mockSignedDocumentPdfUrl.mockRejectedValue(new Error("R2 network error"));
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    const espace = await getEspaceStagiaire("trainee-s1d");

    // Ne doit pas lever — retourne la pdfUrl DB (fallback)
    expect(espace.attestations[0]!.pdfUrl).toBe("https://example.com/att.pdf");
  });

  it("S1 : retourne pdfUrl=null si pdfUrl DB null et R2 non configuré", async () => {
    mockSignedDocumentPdfUrl.mockResolvedValue(null);
    mockPrisma.trainee.findUnique.mockResolvedValue({
      ...fakeTrainee,
      enrollments: [
        {
          ...fakeTrainee.enrollments[0],
          attestationDocument: {
            ...fakeTrainee.enrollments[0]!.attestationDocument,
            pdfUrl: null,
          },
        },
      ],
    });

    const espace = await getEspaceStagiaire("trainee-s1e");

    expect(espace.attestations[0]!.pdfUrl).toBeNull();
  });

  // ── Cloisonnement : une pièce NOMINATIVE n'appartient qu'à son destinataire ──
  //
  // 🔴 En inter-entreprises les inscrits sont des concurrents (même doctrine que
  // `emargement/portail-queries.ts`). La convocation porte le nom et l'employeur
  // d'UNE personne ; sa `pdfUrl` est re-signée à chaque lecture, donc ce qui
  // s'affiche se télécharge réellement.
  //
  // ⚠️ Ces tests laissent le MOCK rejouer le `where` que le service passe à
  // Prisma, au lieu de lui servir une liste déjà triée. C'est le seul montage qui
  // prouve quelque chose : le cloisonnement se joue dans la REQUÊTE, et un
  // fixture filtré à la main rendrait vert un service qui ne filtre pas.

  interface ClauseDocuments {
    type?: { in: readonly string[] };
    traineeId?: string | null;
    OR?: readonly ClauseDocuments[];
  }

  interface LigneDocument {
    id: string;
    type: string;
    numero: string;
    pdfUrl: string | null;
    qrToken: string | null;
    createdAt: Date;
    /** Colonne réelle de `documents_generes` — nulle pour les pièces collectives. */
    traineeId: string | null;
  }

  function satisfaitClause(clause: ClauseDocuments, doc: LigneDocument): boolean {
    if (clause.OR !== undefined && !clause.OR.some((sous) => satisfaitClause(sous, doc))) {
      return false;
    }
    if (clause.type !== undefined && !clause.type.in.includes(doc.type)) return false;
    // `undefined` = pas de filtre côté Prisma ; `null` filtre sur la valeur NULL.
    if (clause.traineeId !== undefined && clause.traineeId !== doc.traineeId) return false;
    return true;
  }

  const PIECE_COLLECTIVE: LigneDocument = {
    id: "doc-programme",
    type: "programme",
    numero: "AXI-DOC-2026-900",
    pdfUrl: "https://example.com/programme.pdf",
    qrToken: null,
    createdAt: new Date("2026-01-05T09:00:00Z"),
    traineeId: null,
  };

  const CONVOCATION_MOI: LigneDocument = {
    id: "doc-convoc-moi",
    type: "convocation",
    numero: "AXI-DOC-2026-901",
    pdfUrl: "https://example.com/convoc-moi.pdf",
    qrToken: null,
    createdAt: new Date("2026-01-10T09:00:00Z"),
    traineeId: "trainee-MOI",
  };

  // Créée APRÈS la mienne : c'est donc elle que la déduplication
  // (session, type) retient, la plus récente l'emportant.
  const CONVOCATION_AUTRE: LigneDocument = {
    id: "doc-convoc-autre",
    type: "convocation",
    numero: "AXI-DOC-2026-902",
    pdfUrl: "https://example.com/convoc-autre.pdf",
    qrToken: null,
    createdAt: new Date("2026-01-20T09:00:00Z"),
    traineeId: "trainee-AUTRE",
  };

  // Convocation produite avant que `genererConvocationAction` ne renseigne
  // `refs.traineeId` (commit du 21/07/2026) : elle nomme quelqu'un sans dire qui.
  const CONVOCATION_HERITEE: LigneDocument = {
    id: "doc-convoc-heritee",
    type: "convocation",
    numero: "AXI-DOC-2026-903",
    pdfUrl: "https://example.com/convoc-heritee.pdf",
    qrToken: null,
    createdAt: new Date("2026-01-25T09:00:00Z"),
    traineeId: null,
  };

  function brancherPrismaFiltrant(documents: readonly LigneDocument[]): void {
    mockPrisma.trainee.findUnique.mockImplementation((args: unknown) => {
      const clause =
        (
          args as {
            select?: {
              enrollments?: {
                select?: { session?: { select?: { documents?: { where?: ClauseDocuments } } } };
              };
            };
          }
        ).select?.enrollments?.select?.session?.select?.documents?.where ?? {};

      return Promise.resolve({
        prenom: "Alice",
        nom: "Dupont",
        situationHandicap: false,
        handicapDetailsChiffre: null,
        enrollments: [
          {
            statut: "confirmee",
            createdAt: new Date("2026-01-01"),
            attestationDocument: null,
            questionnaires: [],
            session: {
              id: "session-inter-1",
              titreSession: "Formation IA — inter-entreprises",
              dateDebut: new Date("2026-02-01"),
              dateFin: new Date("2026-02-02"),
              statut: "planifiee",
              formation: { objectifsPedagogiques: [] },
              documents: documents.filter((doc) => satisfaitClause(clause, doc)),
            },
          },
        ],
      });
    });
  }

  it("cloisonnement : la convocation nominative d'un AUTRE inscrit n'entre pas dans l'espace", async () => {
    mockSignedDocumentPdfUrl.mockResolvedValue(null);
    brancherPrismaFiltrant([PIECE_COLLECTIVE, CONVOCATION_MOI, CONVOCATION_AUTRE]);

    const espace = await getEspaceStagiaire("trainee-MOI");
    const numeros = espace.pieces.map((p) => p.numero);

    expect(numeros).not.toContain(CONVOCATION_AUTRE.numero);
    expect(numeros).toContain(CONVOCATION_MOI.numero);
    // La correction ne doit pas emporter les pièces collectives au passage.
    expect(numeros).toContain(PIECE_COLLECTIVE.numero);
  });

  it("cloisonnement : une convocation héritée sans destinataire reste invisible", async () => {
    mockSignedDocumentPdfUrl.mockResolvedValue(null);
    brancherPrismaFiltrant([PIECE_COLLECTIVE, CONVOCATION_HERITEE]);

    const espace = await getEspaceStagiaire("trainee-MOI");
    const numeros = espace.pieces.map((p) => p.numero);

    expect(numeros).not.toContain(CONVOCATION_HERITEE.numero);
    expect(numeros).toContain(PIECE_COLLECTIVE.numero);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// demanderAccesParEmail (self-service)
// ─────────────────────────────────────────────────────────────────────────────

describe("demanderAccesParEmail", () => {
  const traineeFindFirst = () =>
    (prisma as unknown as { trainee: { findFirst: ReturnType<typeof vi.fn> } }).trainee.findFirst;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("silencieux (aucun envoi) si aucun stagiaire ne correspond — anti-énumération", async () => {
    traineeFindFirst().mockResolvedValue(null);

    await demanderAccesParEmail("inconnu@exemple.fr");

    expect(mockPrisma.portailAcces.create).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("crée un accès et envoie le lien si un stagiaire correspond", async () => {
    traineeFindFirst().mockResolvedValue({ id: "trainee-42", prenom: "Jean", nom: "Dupont" });
    mockPrisma.portailAcces.create.mockResolvedValue({
      id: "acc-1",
      token: "t".repeat(64),
      expiresAt: new Date(),
    });

    await demanderAccesParEmail("  Jean.Dupont@Exemple.FR  ");

    // email normalisé (trim + lowercase) pour la recherche
    expect(traineeFindFirst()).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: "jean.dupont@exemple.fr" }),
      }),
    );
    expect(mockPrisma.portailAcces.create).toHaveBeenCalledTimes(1);
    expect(enqueueEmail).toHaveBeenCalledWith(
      "qualiopi-portail-acces",
      "jean.dupont@exemple.fr",
      "fr",
      expect.objectContaining({
        stagiairePrenomNom: "Jean Dupont",
        lienPortail: expect.stringContaining("/portail/acces/"),
      }),
    );
  });
});
