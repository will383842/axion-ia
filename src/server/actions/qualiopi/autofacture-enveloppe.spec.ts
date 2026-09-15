/**
 * Le bouton « Émettre l'autofacture » se comporte EXACTEMENT comme avant
 * l'extraction du service (2026-09-15).
 *
 * `autofacture.spec.ts` tient le fond — les quatre conditions, la fenêtre de
 * contestation, la pièce jointe. Il reste inchangé. Ce fichier-ci tient ce que
 * l'extraction pouvait déplacer sans qu'aucune de ses assertions ne bouge :
 *
 *   - la garde passe AVANT toute lecture, et son refus remonte tel quel ;
 *   - des données invalides ne lisent rien ;
 *   - le journal est écrit au nom de la SESSION, avec exactement les mêmes
 *     champs (aucun `origine` ajouté côté bouton), et AVANT la transmission ;
 *   - la reprise « Transmettre » journalise toujours au nom de la session.
 *
 * 🔑 Écrit et passé VERT sur `main` avant l'extraction, puis rejoué après : un
 * test de caractérisation ne prouve rien s'il n'a vu qu'une seule version.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLog = vi.fn();
const mockHabilitation = vi.fn();
const mockStatementFindUnique = vi.fn();
const mockStatementUpdate = vi.fn();
const mockStatementFindMany = vi.fn();
const mockDocFindUnique = vi.fn();
const mockGenerateDocument = vi.fn();
const mockEnqueueEmail = vi.fn();
const mockIdentite = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: {
      findUnique: (...a: unknown[]) => mockStatementFindUnique(...a),
      update: (...a: unknown[]) => mockStatementUpdate(...a),
      findMany: (...a: unknown[]) => mockStatementFindMany(...a),
    },
    documentGenere: {
      findUnique: (...a: unknown[]) => mockDocFindUnique(...a),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: (...a: unknown[]) => mockHabilitation(...a),
  logQualiopiActivity: (...a: unknown[]) => mockLog(...a),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => mockEnqueueEmail(...a),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: (...a: unknown[]) => mockGenerateDocument(...a),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: () => mockIdentite(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { emettreAutofactureAction, transmettreAutofactureAction } from "./autofacture";

const ID = "11111111-1111-4111-8111-111111111111";
const SESSION = { userId: "admin-uuid", role: "super_admin" };

function releve(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    statut: "valide",
    tvaRegime: "assujetti_20",
    totalTtcCents: 144_000,
    numeroFacture: null,
    autofactureAt: null,
    autofactureDocumentId: null,
    autofactureTransmiseAt: null,
    contestationAvantAt: null,
    contesteeAt: null,
    dateFacture: null,
    periodeYear: 2026,
    periodeMonth: 8,
    trainerId: "22222222-2222-4222-8222-222222222222",
    trainer: {
      nom: "Roux",
      prenom: "Camille",
      email: "camille@example.test",
      siret: "93812345600017",
      numeroTvaIntracom: "FR55938123456",
      adresseProfessionnelle: "12 rue des Alpes, 38000 Grenoble",
      mandatAutofacturationSigneAt: new Date("2026-08-01T00:00:00.000Z"),
      mandatAutofacturationRevoqueAt: null,
    },
    feeLines: [
      {
        prestationType: "formation_collective",
        heures: { toNumber: () => 14 },
        montantHtCents: 120_000,
      },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockHabilitation.mockResolvedValue(SESSION);
  mockLog.mockResolvedValue(undefined);
  mockStatementUpdate.mockResolvedValue({});
  mockStatementFindMany.mockResolvedValue([]);
  mockDocFindUnique.mockResolvedValue({
    type: "autofacture_honoraires",
    numero: "AXI-DOC-2026-007",
    createdAt: new Date("2026-09-10T00:00:00.000Z"),
  });
  mockGenerateDocument.mockResolvedValue({
    id: "doc-1",
    numero: "AXI-DOC-2026-007",
    pdfUrl: null,
    hashSha256: "a".repeat(64),
  });
  mockEnqueueEmail.mockResolvedValue({ enqueued: true });
  mockIdentite.mockResolvedValue({
    raisonSociale: "Axion-IA SAS",
    nda: "84380000000",
    qualiopi: "Q-1",
    siret: "93800000000011",
    adresseSiege: "1 place Victor Hugo, 38000 Grenoble",
    adresseExercice: "1 place Victor Hugo",
    email: "contact@axion-ia.test",
    telephone: "0400000000",
    site: "https://axion-ia.test",
    tvaIntracom: "FR11938000000",
  });
});

describe("l'enveloppe du bouton « Émettre »", () => {
  it("la garde `remunerer_formateur` passe AVANT toute lecture", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    await emettreAutofactureAction({ statementId: ID });

    expect(mockHabilitation).toHaveBeenCalledWith("remunerer_formateur");
    const garde = mockHabilitation.mock.invocationCallOrder[0] as number;
    const lecture = mockStatementFindUnique.mock.invocationCallOrder[0] as number;
    expect(garde).toBeLessThan(lecture);
  });

  it("🔴 un refus de la garde REMONTE, et rien n'est lu ni produit", async () => {
    mockHabilitation.mockRejectedValue(new Error("forbidden: acte engageant (test)"));
    await expect(emettreAutofactureAction({ statementId: ID })).rejects.toThrow(/forbidden/);
    expect(mockStatementFindUnique).not.toHaveBeenCalled();
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it("des données invalides ne lisent rien", async () => {
    const res = await emettreAutofactureAction({ statementId: "pas-un-uuid" });
    expect(res).toEqual({ error: "Données invalides" });
    expect(mockStatementFindUnique).not.toHaveBeenCalled();
  });

  it("un refus rend `{ error }` SEUL — aucun code interne ne fuit vers l'écran", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ feeLines: [] }));
    const res = await emettreAutofactureAction({ statementId: ID });
    expect(Object.keys(res)).toEqual(["error"]);
  });

  it("une réussite rend `{ data: { numero, transmise } }`, rien de plus", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    const res = await emettreAutofactureAction({ statementId: ID });
    expect(Object.keys(res)).toEqual(["data"]);
    if (!("data" in res)) return;
    expect(Object.keys(res.data).sort()).toEqual(["numero", "transmise"]);
  });

  it("🔑 le journal est écrit au nom de la SESSION, champs identiques, AVANT l'envoi", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    const res = await emettreAutofactureAction({ statementId: ID });
    if (!("data" in res)) throw new Error("émission attendue");

    expect(mockLog).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith({
      action: "qualiopi.autofacture.emission",
      targetType: "TrainerStatement",
      targetId: ID,
      changes: {
        numero: res.data.numero,
        documentId: "doc-1",
        hashSha256: "a".repeat(64),
        mandat: { source: "saisie", signeAt: new Date("2026-08-01T00:00:00.000Z") },
      },
      session: SESSION,
    });
    const journal = mockLog.mock.invocationCallOrder[0] as number;
    const envoi = mockEnqueueEmail.mock.invocationCallOrder[0] as number;
    expect(journal).toBeLessThan(envoi);
  });

  it("un refus métier n'écrit AUCUN journal", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({ trainer: { ...(releve().trainer as object), siret: null } }),
    );
    await emettreAutofactureAction({ statementId: ID });
    expect(mockLog).not.toHaveBeenCalled();
  });
});

describe("l'enveloppe du bouton « Transmettre »", () => {
  it("journalise la reprise au nom de la session", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({
        autofactureAt: new Date("2026-09-01T00:00:00.000Z"),
        autofactureDocumentId: "doc-1",
        numeroFacture: "AXI-AUTOF-2026-001",
        dateFacture: new Date("2026-09-01T00:00:00.000Z"),
      }),
    );
    const res = await transmettreAutofactureAction({ statementId: ID });
    expect(res).toEqual({ data: { transmise: true } });
    expect(mockHabilitation).toHaveBeenCalledWith("remunerer_formateur");
    expect(mockLog).toHaveBeenCalledWith({
      action: "qualiopi.autofacture.transmission",
      targetType: "TrainerStatement",
      targetId: ID,
      changes: { transmise: true },
      session: SESSION,
    });
  });
});
