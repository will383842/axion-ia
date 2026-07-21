/**
 * Tests — rgpd-service.ts (T14 — AGENT A).
 *
 * Strategie : mock @/lib/prisma + @/lib/pii-crypto.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainee: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    portailAcces: {
      updateMany: vi.fn(),
    },
    coachingSession: {
      updateMany: vi.fn(),
    },
    compteRenduSeance: {
      updateMany: vi.fn(),
    },
    rgpdDemande: {
      create: vi.fn(),
    },
    emargementToken: {
      updateMany: vi.fn(),
    },
    emargementSignature: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    // Forme tableau : exécute les opérations passées (update + updateMany).
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: vi.fn((v: string | null) => (v === null ? null : `decrypted:${v}`)),
}));

vi.mock("@/server/qualiopi/emargement/storage", () => ({
  supprimerImageSignature: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { exporterDonneesStagiaire, supprimerStagiaire, creerDemandeRgpd } from "./rgpd-service";
import { supprimerImageSignature } from "@/server/qualiopi/emargement/storage";
import { COLONNES_SCELLEES } from "@/server/qualiopi/emargement/reconstruction";

const mockPrisma = prisma as unknown as {
  trainee: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  portailAcces: {
    updateMany: ReturnType<typeof vi.fn>;
  };
  coachingSession: {
    updateMany: ReturnType<typeof vi.fn>;
  };
  compteRenduSeance: {
    updateMany: ReturnType<typeof vi.fn>;
  };
  rgpdDemande: {
    create: ReturnType<typeof vi.fn>;
  };
  emargementToken: { updateMany: ReturnType<typeof vi.fn> };
  emargementSignature: {
    updateMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// exporterDonneesStagiaire
// ─────────────────────────────────────────────────────────────────────────────

describe("exporterDonneesStagiaire", () => {
  beforeEach(() => vi.clearAllMocks());

  const fakeTrainee = {
    id: "t-1",
    nom: "Martin",
    prenom: "Jean",
    email: "jean@example.com",
    telephone: "0600000000",
    entreprise: "ACME",
    fonction: "DRH",
    situationHandicap: true,
    handicapDetailsChiffre: "enc:v1:aa:bb:cc",
    consentementFormation: true,
    consentementEmail: false,
    consentementVersion: "1.0",
    consentementAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    enrollments: [],
    documents: [],
    appreciations: [],
    rgpdDemandes: [],
  };

  it("retourne un objet exporteAt + stagiaire + donnees", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    const result = (await exporterDonneesStagiaire("t-1")) as Record<string, unknown>;

    expect(result["exporteAt"]).toBeDefined();
    const stagiaire = result["stagiaire"] as Record<string, unknown>;
    expect(stagiaire["nom"]).toBe("Martin");
    expect(stagiaire["email"]).toBe("jean@example.com");
  });

  it("dechiffre handicapDetailsChiffre via decryptPii", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue(fakeTrainee);

    const result = (await exporterDonneesStagiaire("t-1")) as Record<string, unknown>;

    const stagiaire = result["stagiaire"] as Record<string, unknown>;
    expect(stagiaire["handicapDetails"]).toBe("decrypted:enc:v1:aa:bb:cc");
  });

  it("retourne handicapDetails=null si champ null", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue({
      ...fakeTrainee,
      handicapDetailsChiffre: null,
    });

    const result = (await exporterDonneesStagiaire("t-1")) as Record<string, unknown>;

    const stagiaire = result["stagiaire"] as Record<string, unknown>;
    expect(stagiaire["handicapDetails"]).toBeNull();
  });

  it("retourne {} si stagiaire introuvable", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue(null);

    const result = await exporterDonneesStagiaire("t-inconnu");

    expect(result).toEqual({});
  });

  it("retourne {} en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await exporterDonneesStagiaire("any");
      expect(result).toEqual({});
      expect(mockPrisma.trainee.findUnique).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// supprimerStagiaire
// ─────────────────────────────────────────────────────────────────────────────

describe("supprimerStagiaire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ⚠️ `clearAllMocks` efface les appels, pas les valeurs de retour : sans ce
    // repositionnement, la purge des images d'émargement reçoit `undefined` au
    // lieu d'un tableau et fait échouer des tests sans rapport.
    mockPrisma.emargementSignature.findMany.mockResolvedValue([]);
  });

  it("appelle prisma.trainee.update avec les champs anonymises et deletedAt", async () => {
    mockPrisma.trainee.update.mockResolvedValue({});

    await supprimerStagiaire("t-del-1");

    const call = mockPrisma.trainee.update.mock.calls[0]![0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(call.where.id).toBe("t-del-1");
    expect(call.data["nom"]).toBe("[supprime]");
    expect(call.data["prenom"]).toBe("[supprime]");
    expect(call.data["email"]).toContain("anonymise.invalid");
    expect(call.data["telephone"]).toBeNull();
    expect(call.data["handicapDetailsChiffre"]).toBeNull();
    expect(call.data["deletedAt"]).toBeInstanceOf(Date);
  });

  it("email anonymise contient le traineeId pour garantir l'unicite", async () => {
    mockPrisma.trainee.update.mockResolvedValue({});

    await supprimerStagiaire("t-del-unique-id");

    const call = mockPrisma.trainee.update.mock.calls[0]![0] as {
      data: { email: string };
    };
    expect(call.data.email).toContain("t-del-unique-id");
  });

  it("ne fait PAS de DELETE physique (utilise update)", async () => {
    mockPrisma.trainee.update.mockResolvedValue({});

    await supprimerStagiaire("t-del-2");

    expect(mockPrisma.trainee.update).toHaveBeenCalledOnce();
  });

  it("revoque les acces portail actifs du stagiaire anonymise (RGPD)", async () => {
    mockPrisma.trainee.update.mockResolvedValue({});
    mockPrisma.portailAcces.updateMany.mockResolvedValue({ count: 2 });

    await supprimerStagiaire("t-del-rgpd");

    expect(mockPrisma.portailAcces.updateMany).toHaveBeenCalledOnce();
    const call = mockPrisma.portailAcces.updateMany.mock.calls[0]![0] as {
      where: { traineeId: string; revoked: boolean };
      data: { revoked: boolean };
    };
    expect(call.where.traineeId).toBe("t-del-rgpd");
    expect(call.where.revoked).toBe(false);
    expect(call.data.revoked).toBe(true);
  });

  it("anonymise les PII coaching (CoachingSession + notes confidentielles) — RGPD art.17", async () => {
    mockPrisma.trainee.update.mockResolvedValue({});

    await supprimerStagiaire("t-del-coach");

    // CoachingSession : bénéficiaire + tuteur PII → null.
    const csCall = mockPrisma.coachingSession.updateMany.mock.calls[0]![0] as {
      where: { traineeId: string };
      data: Record<string, unknown>;
    };
    expect(csCall.where.traineeId).toBe("t-del-coach");
    expect(csCall.data["beneficiaireNom"]).toBeNull();
    expect(csCall.data["beneficiaireEmail"]).toBeNull();
    expect(csCall.data["tuteurEntrepriseNom"]).toBeNull();
    expect(csCall.data["tuteurEntrepriseEmail"]).toBeNull();
    // CompteRenduSeance : notes confidentielles du coach → null.
    const crCall = mockPrisma.compteRenduSeance.updateMany.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(crCall.data["notesConfidentielles"]).toBeNull();
  });

  it("leve si stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(supprimerStagiaire("any")).rejects.toThrow("stub DB");
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// creerDemandeRgpd
// ─────────────────────────────────────────────────────────────────────────────

describe("creerDemandeRgpd", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cree une demande RGPD export avec statut demandee", async () => {
    const fakeDate = new Date("2026-06-06");
    mockPrisma.rgpdDemande.create.mockResolvedValue({
      id: "rgpd-1",
      type: "export",
      demandeAt: fakeDate,
    });

    const result = await creerDemandeRgpd("t-rgpd-1", "export");

    expect(result).toEqual({ id: "rgpd-1", type: "export", demandeAt: fakeDate });
    const call = mockPrisma.rgpdDemande.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data["statut"]).toBe("demandee");
    expect(call.data["traineeId"]).toBe("t-rgpd-1");
    expect(call.data["type"]).toBe("export");
  });

  it("cree une demande RGPD suppression", async () => {
    const fakeDate = new Date("2026-06-06");
    mockPrisma.rgpdDemande.create.mockResolvedValue({
      id: "rgpd-2",
      type: "suppression",
      demandeAt: fakeDate,
    });

    const result = await creerDemandeRgpd("t-rgpd-2", "suppression");

    expect(result.type).toBe("suppression");
  });

  it("demandeAt est une date recente", async () => {
    const before = Date.now();
    mockPrisma.rgpdDemande.create.mockImplementation(
      async (args: { data: { demandeAt: Date } }) => ({
        id: "rgpd-3",
        type: "export",
        demandeAt: args.data.demandeAt,
      }),
    );

    const result = await creerDemandeRgpd("t-rgpd-3", "export");
    const after = Date.now();

    expect(result.demandeAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.demandeAt.getTime()).toBeLessThanOrEqual(after + 100);
  });

  it("leve si stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(creerDemandeRgpd("any", "export")).rejects.toThrow("stub DB");
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Émargement — oublis O1 (export) et O2 (effacement + purge R2)
// ─────────────────────────────────────────────────────────────────────────────

const mockSupprimerImage = supprimerImageSignature as unknown as ReturnType<typeof vi.fn>;

describe("RGPD — signatures d'émargement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ⚠️ `clearAllMocks` efface les appels, pas les valeurs de retour.
    mockPrisma.emargementSignature.findMany.mockResolvedValue([]);
    mockPrisma.emargementSignature.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.emargementSignature.update.mockResolvedValue({});
    mockPrisma.emargementToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.trainee.update.mockResolvedValue({});
    mockPrisma.portailAcces.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.coachingSession.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.compteRenduSeance.updateMany.mockResolvedValue({ count: 0 });
    mockSupprimerImage.mockResolvedValue(undefined);
  });

  it("🔴 l'export REMONTE les signatures — l'`include` est une liste blanche", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue({
      id: "t1",
      nom: "Dupont",
      prenom: "Alice",
      email: "a@b.test",
      handicapDetailsChiffre: null,
      enrollments: [],
      documents: [],
      appreciations: [],
      rgpdDemandes: [],
      coachingSessions: [],
    });

    await exporterDonneesStagiaire("t1");

    const arg = mockPrisma.trainee.findUnique.mock.calls[0]![0] as {
      include: { enrollments: { include: Record<string, unknown> } };
    };
    expect(arg.include.enrollments.include["emargementSignatures"]).toBe(true);
    expect(arg.include.enrollments.include["emargementTokens"]).toBeDefined();
  });

  it("l'export ne remonte JAMAIS l'empreinte du jeton", async () => {
    mockPrisma.trainee.findUnique.mockResolvedValue({
      id: "t1",
      nom: "D",
      prenom: "A",
      email: "a@b.test",
      handicapDetailsChiffre: null,
      enrollments: [],
      documents: [],
      appreciations: [],
      rgpdDemandes: [],
      coachingSessions: [],
    });
    await exporterDonneesStagiaire("t1");

    const arg = mockPrisma.trainee.findUnique.mock.calls[0]![0] as {
      include: {
        enrollments: { include: { emargementTokens: { select: Record<string, unknown> } } };
      };
    };
    const select = arg.include.enrollments.include.emargementTokens.select;
    expect(select["tokenHash"]).toBeUndefined();
    expect(select["expiresAt"]).toBe(true);
  });

  it("🔴 l'effacement NE TOUCHE À AUCUNE colonne scellée — sinon la chaîne devient « falsifiée »", async () => {
    // ⚠️ Ce test assertait exactement le bug : il EXIGEAIT que `signataireEmail`,
    // `ipHash` et `userAgentSha256` soient mis à `null`. Les trois sont dans le
    // tuple haché. Après toute demande d'article 17, `verifierChaine` rendait
    // donc `empreinte_invalide` sur chaque signature du stagiaire — le verdict
    // « ces feuilles ont été modifiées après coup », dans un dossier de contrôle,
    // sur des pièces intactes.
    //
    // L'assertion porte sur la LISTE des colonnes scellées plutôt que sur trois
    // noms : le jour où le tuple en gagne une, ce test la protège sans qu'on ait
    // à y penser.
    await supprimerStagiaire("t1");

    const ecritures = [
      ...mockPrisma.emargementSignature.updateMany.mock.calls,
      // La purge des images écrit elle aussi sur la table : `signatureKey` et
      // `imagePurgeeAt` sont hors tuple, et doivent le rester.
      ...mockPrisma.emargementSignature.update.mock.calls,
    ].map((c) => (c[0] as { data: Record<string, unknown> }).data);
    const colonnesEcrites = ecritures.flatMap((d) => Object.keys(d));
    expect(colonnesEcrites.filter((c) => COLONNES_SCELLEES.includes(c as never))).toEqual([]);
  });

  it("l'effacement RÉVOQUE les jetons encore vivants", async () => {
    // Un lien valide survivant permettrait de signer au nom d'une personne
    // pourtant « supprimée ».
    await supprimerStagiaire("t1");
    const arg = mockPrisma.emargementToken.updateMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(arg.where["revokedAt"]).toBeNull();
  });

  it("🔴 l'effacement SUPPRIME les images sur R2 — l'oubli O2", async () => {
    mockPrisma.emargementSignature.findMany.mockResolvedValue([
      { id: "s1", signatureKey: "emargement/2026/signatures/a.png" },
      { id: "s2", signatureKey: "emargement/2026/signatures/b.png" },
    ]);

    await supprimerStagiaire("t1");

    expect(mockSupprimerImage).toHaveBeenCalledTimes(2);
    expect(mockPrisma.emargementSignature.update).toHaveBeenCalledTimes(2);
  });

  it("ne pose `imagePurgeeAt` que si la suppression a RÉUSSI", async () => {
    // Le poser d'office ferait croire à un effacement qui n'a pas eu lieu —
    // pire que pas d'effacement, puisque plus personne n'irait vérifier.
    mockPrisma.emargementSignature.findMany.mockResolvedValue([
      { id: "s1", signatureKey: "emargement/2026/signatures/a.png" },
    ]);
    mockSupprimerImage.mockRejectedValue(new Error("R2 500"));

    await expect(supprimerStagiaire("t1")).rejects.toThrow(/incomplet/);

    expect(mockPrisma.emargementSignature.update).not.toHaveBeenCalled();
  });

  it("🔴 LÈVE si une purge échoue — sinon la demande passe en « traitée » et le rejeu devient impossible", async () => {
    // Avaler l'échec faisait retourner normalement, donc marquer la demande RGPD
    // « traitée » — et le garde qui exige « demandée » rendait tout rejeu
    // impossible. L'image restait 5 ans, et rien ne balaie `imagePurgeeAt`.
    mockPrisma.emargementSignature.findMany.mockResolvedValue([
      { id: "s1", signatureKey: "emargement/2026/signatures/a.png" },
    ]);
    mockSupprimerImage.mockRejectedValue(new Error("R2 500"));

    await expect(supprimerStagiaire("t1")).rejects.toThrow();
  });

  it("un échec sur une image n'empêche pas de tenter les suivantes", async () => {
    mockPrisma.emargementSignature.findMany.mockResolvedValue([
      { id: "s1", signatureKey: "emargement/2026/signatures/a.png" },
      { id: "s2", signatureKey: "emargement/2026/signatures/b.png" },
    ]);
    mockSupprimerImage.mockRejectedValueOnce(new Error("R2 500")).mockResolvedValue(undefined);

    await expect(supprimerStagiaire("t1")).rejects.toThrow();

    // Les deux ont été tentées, la seconde a réussi : le rejeu ne reprendra que
    // ce qui reste, grâce au filtre `imagePurgeeAt: null`.
    expect(mockSupprimerImage).toHaveBeenCalledTimes(2);
    expect(mockPrisma.emargementSignature.update).toHaveBeenCalledTimes(1);
  });
});
