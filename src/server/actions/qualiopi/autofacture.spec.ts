/**
 * Tests — émission, transmission et contestation d'une autofacture.
 *
 * 🔑 CE QUI SE TESTE ICI N'EST PAS « ÇA MARCHE », C'EST LE REFUS ET LA FRONTIÈRE.
 *
 * Une facture d'autofacturation à laquelle il manque une seule des quatre
 * conditions réglementaires est irrégulière, et sa TVA non déductible. On ne
 * l'apprend qu'au contrôle. Les tests qui comptent sont donc :
 *   · l'émission REFUSE quand une condition manque, et dit lesquelles ;
 *   · la fenêtre de contestation ne s'ouvre QUE si l'envoi est réellement parti ;
 *   · une pièce contestée ne se paie pas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLog = vi.fn();
const mockStatementFindUnique = vi.fn();
const mockStatementUpdate = vi.fn();
const mockStatementFindMany = vi.fn();
const mockDocFindFirst = vi.fn();
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
    documentGenere: { findFirst: (...a: unknown[]) => mockDocFindFirst(...a) },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
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

import {
  contesterAutofactureAction,
  emettreAutofactureAction,
  transmettreAutofactureAction,
} from "./autofacture";

const ID = "11111111-1111-4111-8111-111111111111";

/** Un relevé validé, un formateur complet, un mandat en vigueur. */
function releve(over: Record<string, unknown> = {}): Record<string, unknown> {
  // ⚠️ `trainer` est extrait du spread : sans ça, passer `{ trainer: { siret:
  // null } }` REMPLACE tout le formateur au lieu de le surcharger, et les
  // tests mesurent un formateur vide au lieu du cas décrit.
  const { trainer: trainerOver, ...reste } = over;
  return {
    id: ID,
    statut: "valide",
    tvaRegime: "assujetti_20",
    totalTtcCents: 144_000,
    numeroFacture: null,
    autofactureAt: null,
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
      ...((trainerOver as Record<string, unknown>) ?? {}),
    },
    feeLines: [
      {
        prestationType: "formation_collective",
        heures: { toNumber: () => 14 },
        montantHtCents: 120_000,
      },
    ],
    ...reste,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLog.mockResolvedValue(undefined);
  mockStatementUpdate.mockResolvedValue({});
  mockStatementFindMany.mockResolvedValue([]);
  mockDocFindFirst.mockResolvedValue({
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

describe("emettreAutofactureAction — les quatre conditions", () => {
  it("émet, numérote dans la série AXI-AUTOF, et transmet", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    const res = await emettreAutofactureAction({ statementId: ID });

    expect("data" in res).toBe(true);
    if (!("data" in res)) return;
    // 🔴 Série PROPRE : intercaler une pièce d'ACHAT dans `AXI-FACT`, la série
    // des ventes, ferait mentir la continuité que cette série doit garantir.
    expect(res.data.numero).toMatch(/^AXI-AUTOF-\d{4}-\d{3,}$/);
    expect(res.data.transmise).toBe(true);
  });

  it("🔴 REFUSE sans mandat, et le refus NOMME le geste qui le lève", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({ trainer: { mandatAutofacturationSigneAt: null } }),
    );
    const res = await emettreAutofactureAction({ statementId: ID });
    expect("error" in res).toBe(true);
    if (!("error" in res)) return;
    expect(res.error).toMatch(/mandat/i);
    // Rien n'a été produit ni écrit : un refus qui laisse un PDF derrière lui
    // est un refus qui a émis.
    expect(mockGenerateDocument).not.toHaveBeenCalled();
    expect(mockStatementUpdate).not.toHaveBeenCalled();
  });

  it("🔴 rend TOUS les motifs à la fois, pas le premier", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({
        statut: "brouillon",
        trainer: { mandatAutofacturationSigneAt: null, siret: null },
      }),
    );
    const res = await emettreAutofactureAction({ statementId: ID });
    expect("error" in res).toBe(true);
    if (!("error" in res)) return;
    expect(res.error).toMatch(/validé/i);
    expect(res.error).toMatch(/mandat/i);
    expect(res.error).toMatch(/SIRET/i);
  });

  it("🔴 refuse si la pièce ne dirait pas la même chose que la dette", async () => {
    // Le point de rencontre des DEUX calculs de TVA du dépôt. Émettre une pièce
    // qui réclame autre chose que ce qu'on doit fabriquerait le désaccord au
    // lieu de le constater.
    mockStatementFindUnique.mockResolvedValue(releve({ totalTtcCents: 999_999 }));
    const res = await emettreAutofactureAction({ statementId: ID });
    expect("error" in res).toBe(true);
    if (!("error" in res)) return;
    expect(res.error).toMatch(/Incohérence de montant/);
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it("refuse un relevé sans ligne d'honoraires", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ feeLines: [] }));
    const res = await emettreAutofactureAction({ statementId: ID });
    expect("error" in res && res.error).toMatch(/vide/i);
  });
});

describe("🔴 la fenêtre de contestation ne s'ouvre QUE si l'envoi part", () => {
  /** Les champs écrits par le dernier `update` du relevé. */
  function dernierUpdate(): Record<string, unknown> {
    const calls = mockStatementUpdate.mock.calls;
    return (calls.at(-1)?.[0]?.data ?? {}) as Record<string, unknown>;
  }

  it("envoi parti → transmission et terme des 8 jours écrits", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    await emettreAutofactureAction({ statementId: ID });

    const data = dernierUpdate();
    expect(data["autofactureTransmiseAt"]).toBeInstanceOf(Date);
    const terme = data["contestationAvantAt"] as Date;
    const transmise = data["autofactureTransmiseAt"] as Date;
    expect(Math.round((terme.getTime() - transmise.getTime()) / 86_400_000)).toBe(8);
  });

  it("🔴 e-mail GARÉ pour validation → aucune fenêtre ouverte", async () => {
    // `enqueued: true` ET `garePourValidation: true` : les deux drapeaux se
    // lisent ENSEMBLE. Un envoi garé n'est pas un envoi — poser la date
    // donnerait au formateur moins de huit jours, parfois zéro, sur un délai
    // que le contrat lui garantit.
    mockEnqueueEmail.mockResolvedValue({ enqueued: true, garePourValidation: true });
    mockStatementFindUnique.mockResolvedValue(releve());
    const res = await emettreAutofactureAction({ statementId: ID });

    expect("data" in res && res.data.transmise).toBe(false);
    for (const call of mockStatementUpdate.mock.calls) {
      const data = (call?.[0]?.data ?? {}) as Record<string, unknown>;
      expect(
        data["contestationAvantAt"],
        "une fenêtre a été ouverte sur un envoi garé",
      ).toBeUndefined();
    }
  });

  it("🔴 file d'envoi indisponible → la pièce existe, la fenêtre reste fermée", async () => {
    mockEnqueueEmail.mockResolvedValue({ enqueued: false });
    mockStatementFindUnique.mockResolvedValue(releve());
    const res = await emettreAutofactureAction({ statementId: ID });

    // L'émission RÉUSSIT — une transmission ratée n'annule pas une pièce
    // valide, elle se réessaie.
    expect("data" in res).toBe(true);
    if (!("data" in res)) return;
    expect(res.data.transmise).toBe(false);
    expect(mockStatementUpdate).toHaveBeenCalled();
  });

  it("🔑 CONTRE-TÉMOIN : l'e-mail porte bien la date limite, calculée", async () => {
    // Sans lui, les tests ci-dessus resteraient verts avec un e-mail qui dirait
    // « sous huitaine » sans jamais donner de date — le formateur devrait
    // convertir lui-même un délai qu'il est le seul à subir.
    mockStatementFindUnique.mockResolvedValue(releve());
    await emettreAutofactureAction({ statementId: ID });

    const payload = mockEnqueueEmail.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload["contestationAvantLabel"]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(payload["numero"]).toMatch(/^AXI-AUTOF-/);
  });

  it("le PDF est joint à l'envoi", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    await emettreAutofactureAction({ statementId: ID });
    const opts = mockEnqueueEmail.mock.calls[0]?.[4] as Record<string, unknown>;
    const pj = opts["attachments"] as Array<{ filename: string }>;
    expect(pj?.[0]?.filename).toMatch(/^AXI-AUTOF-.*\.pdf$/);
  });
});

describe("transmettreAutofactureAction — la reprise", () => {
  it("refuse s'il n'y a rien à transmettre", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    const res = await transmettreAutofactureAction({ statementId: ID });
    expect("error" in res && res.error).toMatch(/rien à transmettre/i);
  });

  it("refuse une seconde transmission", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({ autofactureAt: new Date(), autofactureTransmiseAt: new Date() }),
    );
    const res = await transmettreAutofactureAction({ statementId: ID });
    expect("error" in res && res.error).toMatch(/déjà été transmise/i);
  });

  it("refuse sans adresse e-mail, en le DISANT", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({ autofactureAt: new Date(), trainer: { email: "" } }),
    );
    const res = await transmettreAutofactureAction({ statementId: ID });
    expect("error" in res && res.error).toMatch(/adresse e-mail/i);
  });
});

describe("contesterAutofactureAction", () => {
  it("enregistre la contestation et son motif", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({
        autofactureAt: new Date("2026-09-01T00:00:00.000Z"),
        contestationAvantAt: new Date("2100-01-01T00:00:00.000Z"),
      }),
    );
    const res = await contesterAutofactureAction({ statementId: ID, motif: "2 jours, pas 3" });
    expect("data" in res && res.data.horsDelai).toBe(false);
    const data = mockStatementUpdate.mock.calls.at(-1)?.[0]?.data as Record<string, unknown>;
    expect(data["contesteeAt"]).toBeInstanceOf(Date);
    expect(data["contestationMotif"]).toBe("2 jours, pas 3");
  });

  it("🔴 enregistre AUSSI une contestation hors délai, et le signale", async () => {
    // Passé huit jours la facture est « réputée acceptée » — cela ne fait pas
    // disparaître le désaccord. Refuser de le consigner effacerait un fait et
    // laisserait partir un virement sur une pièce contestée.
    mockStatementFindUnique.mockResolvedValue(
      releve({
        autofactureAt: new Date("2026-01-01T00:00:00.000Z"),
        contestationAvantAt: new Date("2026-01-09T00:00:00.000Z"),
      }),
    );
    const res = await contesterAutofactureAction({ statementId: ID, motif: "erreur de taux" });
    expect("data" in res && res.data.horsDelai).toBe(true);
    expect(mockStatementUpdate).toHaveBeenCalled();
  });

  it("refuse une seconde contestation", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({ autofactureAt: new Date(), contesteeAt: new Date() }),
    );
    const res = await contesterAutofactureAction({ statementId: ID, motif: "x" });
    expect("error" in res && res.error).toMatch(/déjà enregistrée/i);
  });

  it("exige un motif", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ autofactureAt: new Date() }));
    const res = await contesterAutofactureAction({ statementId: ID, motif: "" });
    expect("error" in res && res.error).toMatch(/motif/i);
  });
});
