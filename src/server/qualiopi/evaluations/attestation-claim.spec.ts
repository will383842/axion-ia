/**
 * Tests NÉGATIFS du claim atomique d'attestation (défaut J3).
 *
 * ## Ce que ces tests verrouillent
 *
 * La garde d'idempotence était une LECTURE prise en tête de fonction, alors que
 * l'écriture de `attestationGenereeAt` n'intervient qu'après le rendu du PDF —
 * plusieurs centaines de millisecondes et plusieurs allers-retours plus loin.
 * Deux exécutions concurrentes (le cron de 09:00 et un clic « Générer »)
 * lisaient donc toutes deux `null` et produisaient chacune une attestation :
 * deux numéros `AXI-ATT`, deux `qrToken` publiquement vérifiables, une seule
 * référencée par `attestationDocumentId`. L'autre restait orpheline **et
 * authentifiée**.
 *
 * Le correctif transforme la garde en `updateMany` conditionné — atomique côté
 * base. Ces tests vérifient les deux moitiés du patron, et la seconde compte
 * autant que la première : **un verrou qu'on ne relâche pas ne protège plus, il
 * condamne.**
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    documentGenere: { findUnique: vi.fn() },
    trainer: { findUnique: vi.fn() },
    activityLog: { create: vi.fn() },
  },
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(80),
}));
vi.mock("@/server/qualiopi/presence/taux", () => ({
  classifierPresence: vi.fn().mockReturnValue("complete"),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn().mockResolvedValue({
    raisonSociale: "Axion-IA SAS",
    nda: "12345678901",
    siret: "12345678900010",
    adresseSiege: "Paris",
    adresseExercice: "Saint-Lattier",
    email: "contact@axion-ia.com",
  }),
}));
vi.mock("@/server/qualiopi/documents/qr", () => ({
  makeQrToken: vi.fn().mockReturnValue("qr-token"),
  qrDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,x"),
}));
vi.mock("./evaluations-service", () => ({
  getFinaleResultats: vi.fn().mockResolvedValue(null),
  evaluationSansAucuneNote: () => true,
}));
vi.mock("@/server/qualiopi/notifications/notifications-service", () => ({
  envoyerAttestationDisponible: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { genererAttestationPourEnrollment } from "./attestation-service";

const mockPrisma = prisma as unknown as {
  enrollment: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  activityLog: { create: ReturnType<typeof vi.fn> };
};
const mockGenerate = generateDocument as unknown as ReturnType<typeof vi.fn>;

const ENROLLMENT_ID = "11111111-1111-4111-8111-111111111111";

function inscription(over: Record<string, unknown> = {}) {
  return {
    id: ENROLLMENT_ID,
    statut: "presente",
    tauxPresencePct: 100,
    attestationGenereeAt: null,
    attestationResultat: null,
    attestationDocumentId: null,
    trainee: { id: "t-1", nom: "Blanc", prenom: "Test", email: "t@example.test" },
    session: {
      id: "s-1",
      numero: "AXI-SESS-2026-999",
      titreSession: "Test",
      dateDebut: new Date("2026-01-05T09:00:00Z"),
      dateFin: new Date("2026-01-05T17:00:00Z"),
      dureeHeures: 7,
      modalite: "presentiel",
      formationSnapshot: null,
      formation: {
        id: "f-1",
        titre: "Formation test",
        objectifsPedagogiques: [],
        dureeHeures: 7,
      },
    },
    ...over,
  };
}

describe("attestation — claim atomique (J3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.enrollment.findUnique.mockResolvedValue(inscription());
    mockPrisma.enrollment.update.mockResolvedValue({});
    mockPrisma.enrollment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.activityLog.create.mockResolvedValue({});
    mockGenerate.mockResolvedValue({
      id: "doc-1",
      numero: "AXI-ATT-2026-001",
      pdfUrl: "https://r2.example.test/a.pdf",
      hashSha256: "a".repeat(64),
    });
  });

  it("la garde est un updateMany CONDITIONNÉ, pas une lecture", async () => {
    await genererAttestationPourEnrollment(ENROLLMENT_ID);

    const appel = mockPrisma.enrollment.updateMany.mock.calls[0]?.[0];
    expect(appel, "aucun claim n'a été posé").toBeDefined();
    // La condition EST la garde : sans `attestationGenereeAt: null`, deux
    // exécutions concurrentes gagnent toutes les deux.
    expect(appel.where).toMatchObject({ id: ENROLLMENT_ID, attestationGenereeAt: null });
    expect(appel.data.attestationGenereeAt).toBeInstanceOf(Date);
  });

  it("🔴 le perdant de la course ne génère AUCUN document", async () => {
    // count = 0 : une autre exécution a déjà réservé cette inscription.
    mockPrisma.enrollment.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.enrollment.findUnique.mockResolvedValueOnce(inscription()).mockResolvedValueOnce({
      attestationResultat: "complete",
      attestationDocumentId: "doc-du-gagnant",
    });

    const res = await genererAttestationPourEnrollment(ENROLLMENT_ID);

    expect(mockGenerate, "le perdant a produit une seconde attestation").not.toHaveBeenCalled();
    // Il rend l'état RÉEL du gagnant, pas l'instantané périmé lu au début.
    expect(res).toEqual({ resultat: "complete", documentId: "doc-du-gagnant" });
  });

  it("🔴 un échec de rendu LIBÈRE le claim — sinon le cron ne reprend jamais", async () => {
    mockGenerate.mockRejectedValue(new Error("R2 indisponible"));

    await expect(genererAttestationPourEnrollment(ENROLLMENT_ID)).rejects.toThrow(
      "R2 indisponible",
    );

    const liberation = mockPrisma.enrollment.updateMany.mock.calls.find(
      (c) => c[0]?.data?.attestationGenereeAt === null,
    );
    expect(
      liberation,
      "le claim n'a pas été relâché : l'inscription reste « attestée » sans pièce, et le cron la filtre",
    ).toBeDefined();
    expect(liberation?.[0].where).toMatchObject({ id: ENROLLMENT_ID });
  });

  it("l'erreur d'origine est propagée telle quelle, même si la libération échoue", async () => {
    mockGenerate.mockRejectedValue(new Error("police PDF absente"));
    // La libération elle-même tombe : on ne doit PAS masquer la cause première.
    mockPrisma.enrollment.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error("DB down"));

    await expect(genererAttestationPourEnrollment(ENROLLMENT_ID)).rejects.toThrow(
      "police PDF absente",
    );
  });

  it("`force` ne pose pas de claim — régénérer est un acte délibéré et motivé", async () => {
    mockPrisma.enrollment.findUnique.mockResolvedValue(
      inscription({ attestationGenereeAt: new Date("2026-01-06T09:00:00Z") }),
    );

    await genererAttestationPourEnrollment(ENROLLMENT_ID, {
      force: true,
      rectificationMotif: "Erreur de nom corrigée",
    });

    const claims = mockPrisma.enrollment.updateMany.mock.calls.filter(
      (c) => c[0]?.where?.attestationGenereeAt === null,
    );
    expect(claims, "un claim a été posé alors que force était demandé").toHaveLength(0);
    expect(mockGenerate).toHaveBeenCalled();
  });
});
