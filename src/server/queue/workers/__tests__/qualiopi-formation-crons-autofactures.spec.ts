/**
 * 🔴 LE RATTRAPAGE DES AUTOFACTURES N'A JAMAIS PU ÉMETTRE UNE SEULE PIÈCE.
 *
 * `formation-crons.autofactures` (horaire) rattrape les autofactures dont
 * l'émission automatique a échoué. Il appelait `emettreAutofactureAction`, dont
 * la première ligne est `requireHabilitation("remunerer_formateur")`. Le worker
 * tourne `tsx`, hors de Next : `auth()` n'y a ni cookie ni `headers()`, et lève.
 * Le `catch` du cron comptait l'exception comme un refus — et se taisait.
 *
 * Ce fichier passe par le DISPATCHER du worker (`formationCronsHandler`), pas
 * par un service isolé : c'est ce que BullMQ appelle, et c'est ce qui échouait.
 * `@/auth` y lève comme en production. Aucune garde n'est moquée pour laisser
 * passer : si le chemin du cron retouche à la session, le premier test rougit.
 *
 * Trois propriétés :
 *   1. une autofacture ÉLIGIBLE s'émet sans session, et le journal le dit
 *      (`adminUserId: null`, `origine: "rattrapage_automatique"`) ;
 *   2. un REFUS MÉTIER (fiche incomplète) se compte sans bruit — l'alerte
 *      `autofacture_a_emettre` le porte déjà ;
 *   3. une EXCEPTION TECHNIQUE se voit : `console.error` avec l'identifiant du
 *      relevé, une ligne de journal que l'alerte lit, et les relevés suivants
 *      sont quand même traités.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    documentGenere: { findUnique: vi.fn(), findMany: vi.fn() },
    activityLog: { create: vi.fn() },
  },
}));

// 🔴 LE WORKER, TEL QU'IL EST EN PRODUCTION : aucune requête HTTP, donc aucune
// session. `auth()` et `headers()` y lèvent — c'est exactement ce que la garde
// de l'action rencontrait.
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => {
    throw new Error("`headers` was called outside a request scope");
  }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => {
    throw new Error("`headers` was called outside a request scope");
  }),
}));

vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({ generateDocument: vi.fn() }));
vi.mock("@/server/qualiopi/documents/organisme", () => ({ getOrganismeIdentite: vi.fn() }));

// Chargement du worker : mêmes doubles que les autres specs du dispatcher, pour
// que la collecte n'atteigne ni BullMQ réel ni `next-auth` par un autre chemin.
vi.mock("../connection", () => ({ getBullConnectionOrThrow: vi.fn().mockReturnValue({}) }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
}));
vi.mock("@/server/qualiopi/notifications/notifications-service", () => ({
  envoyerConvocation: vi.fn(),
  envoyerPositionnement: vi.fn(),
  envoyerRappelJ7: vi.fn(),
  envoyerSatisfactionJ1: vi.fn(),
  envoyerSuiviJ30: vi.fn(),
  envoyerRelanceQuestionnaire: vi.fn(),
  envoyerEnqueteEntreprise: vi.fn(),
  notifierAlerteInterne: vi.fn(),
}));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  synchroniserAlertes: vi.fn().mockResolvedValue({ crees: 0, resolues: 0 }),
}));
vi.mock("@/server/qualiopi/alertes/envoi-groupe", () => ({
  notifierAlertesGroupees: vi
    .fn()
    .mockResolvedValue({ messages: 0, alertes: 0, sansGuichet: 0, replis: [] }),
}));
vi.mock("@/server/qualiopi/formations/crons", () => ({
  decideSessionTransitions: vi.fn().mockReturnValue([]),
}));
vi.mock("@/server/qualiopi/formations/transition-helper", () => ({
  writeSessionTransition: vi.fn(),
}));
vi.mock("@/server/qualiopi/evaluations/attestation-service", () => ({
  genererAttestationPourEnrollment: vi.fn(),
}));
vi.mock("@/server/qualiopi/indicateurs/service", () => ({ invalidateIndicateursCache: vi.fn() }));
vi.mock("@/server/qualiopi/formations/state-machine", () => ({ assertSessionTransition: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { enqueueEmail } from "@/server/queue/queues";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { formationCronsHandler } from "../qualiopi-formation-crons-worker";

const mp = prisma as unknown as {
  trainerStatement: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  documentGenere: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  activityLog: { create: ReturnType<typeof vi.fn> };
};
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockEnqueue = enqueueEmail as unknown as ReturnType<typeof vi.fn>;
const mockGenerate = generateDocument as unknown as ReturnType<typeof vi.fn>;
const mockIdentite = getOrganismeIdentite as unknown as ReturnType<typeof vi.fn>;

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "33333333-3333-4333-8333-333333333333";

/** Un relevé validé, un formateur complet, un mandat en vigueur. */
function releve(id: string, trainerOver: Record<string, unknown> = {}) {
  return {
    id,
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
      ...trainerOver,
    },
    feeLines: [
      {
        prestationType: "formation_collective",
        heures: { toNumber: () => 14 },
        montantHtCents: 120_000,
      },
    ],
  };
}

const JOB = { type: "formation-crons.autofactures" } as Parameters<typeof formationCronsHandler>[0];

/** Toutes les lignes de journal écrites pendant le passage. */
function journaux(): Array<Record<string, unknown>> {
  return mp.activityLog.create.mock.calls.map(
    (c: unknown[]) => (c[0] as { data: Record<string, unknown> }).data,
  );
}

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  mp.trainerStatement.update.mockResolvedValue({});
  mp.documentGenere.findMany.mockResolvedValue([]);
  mp.documentGenere.findUnique.mockResolvedValue({
    type: "autofacture_honoraires",
    numero: "AXI-DOC-2026-007",
    createdAt: new Date("2026-09-10T00:00:00.000Z"),
  });
  mp.activityLog.create.mockResolvedValue({});
  mockGenerate.mockResolvedValue({
    id: "doc-1",
    numero: "AXI-DOC-2026-007",
    pdfUrl: null,
    hashSha256: "a".repeat(64),
  });
  mockEnqueue.mockResolvedValue({ enqueued: true });
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("🔴 formation-crons.autofactures émet SANS session admin", () => {
  it("une autofacture éligible est émise, numérotée, transmise", async () => {
    mp.trainerStatement.findMany.mockResolvedValue([{ id: ID_A }]);
    mp.trainerStatement.findUnique.mockResolvedValue(releve(ID_A));

    await formationCronsHandler(JOB);

    expect(mockGenerate, "aucune pièce produite : le cron n'a rien émis").toHaveBeenCalledTimes(1);
    const ecriture = mp.trainerStatement.update.mock.calls
      .map((c: unknown[]) => (c[0] as { data: Record<string, unknown> }).data)
      .find((d) => "autofactureAt" in d);
    expect(ecriture?.["numeroFacture"]).toMatch(/^AXI-AUTOF-\d{4}-\d{3,}$/);
    expect(ecriture?.["autofactureDocumentId"]).toBe("doc-1");
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("🔑 le chemin du cron ne consulte JAMAIS la session", async () => {
    // Témoin de la cause, pas du symptôme : même si une autre porte laissait
    // passer, un appel à `auth()` depuis le worker est le défaut lui-même.
    mp.trainerStatement.findMany.mockResolvedValue([{ id: ID_A }]);
    mp.trainerStatement.findUnique.mockResolvedValue(releve(ID_A));

    await formationCronsHandler(JOB);

    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("le journal d'émission est SANS administrateur, et porte son origine", async () => {
    mp.trainerStatement.findMany.mockResolvedValue([{ id: ID_A }]);
    mp.trainerStatement.findUnique.mockResolvedValue(releve(ID_A));

    await formationCronsHandler(JOB);

    const emission = journaux().find((j) => j["action"] === "qualiopi.autofacture.emission");
    expect(emission, "aucune trace d'émission au registre").toBeDefined();
    expect(emission?.["adminUserId"]).toBeNull();
    expect(emission?.["targetId"]).toBe(ID_A);
    const changes = emission?.["changes"] as Record<string, unknown>;
    expect(changes["origine"]).toBe("rattrapage_automatique");
    expect(changes["documentId"]).toBe("doc-1");
    expect(changes["mandat"]).toEqual({
      source: "saisie",
      signeAt: new Date("2026-08-01T00:00:00.000Z"),
    });
  });
});

describe("refus métier ≠ exception technique", () => {
  it("🔑 une fiche incomplète est comptée comme refus, SANS erreur ni journal d'échec", async () => {
    // Attendu, et déjà porté par l'alerte `autofacture_a_emettre` avec la liste
    // des manques. Le crier toutes les heures apprendrait à ignorer le journal.
    mp.trainerStatement.findMany.mockResolvedValue([{ id: ID_A }]);
    mp.trainerStatement.findUnique.mockResolvedValue(releve(ID_A, { siret: null }));

    await formationCronsHandler(JOB);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(journaux()).toEqual([]);
    const bilan = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(bilan).toMatch(/0 émise\(s\)/);
    expect(bilan).toMatch(/1 refusée\(s\)/);
  });

  it("🔴 une panne de PDF est une ERREUR : console.error avec l'id, journal d'échec", async () => {
    mp.trainerStatement.findMany.mockResolvedValue([{ id: ID_A }]);
    mp.trainerStatement.findUnique.mockResolvedValue(releve(ID_A));
    mockGenerate.mockRejectedValue(new Error("rendu indisponible (test)"));

    await formationCronsHandler(JOB);

    const erreurs = errorSpy.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
    expect(erreurs).toContain(ID_A);
    expect(erreurs).toContain("rendu indisponible (test)");
    const echec = journaux().find((j) => j["action"] === "qualiopi.autofacture.rattrapage.echec");
    expect(
      echec,
      "l'échec technique n'a laissé aucune trace que l'alerte puisse lire",
    ).toBeDefined();
    expect(echec?.["adminUserId"]).toBeNull();
    expect(echec?.["targetId"]).toBe(ID_A);
    expect((echec?.["changes"] as Record<string, unknown>)["code"]).toBe("technique");
  });

  it("🔴 une exception LEVÉE est journalisée, et les relevés suivants passent quand même", async () => {
    mp.trainerStatement.findMany.mockResolvedValue([{ id: ID_A }, { id: ID_B }]);
    mp.trainerStatement.findUnique.mockImplementation(async (a: { where: { id: string } }) => {
      if (a.where.id === ID_A) throw new Error("connexion perdue (test)");
      return releve(ID_B);
    });

    await formationCronsHandler(JOB);

    const erreurs = errorSpy.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
    expect(erreurs).toContain(ID_A);
    expect(erreurs).toContain("connexion perdue (test)");
    // Un formateur n'attend pas parce que le relevé d'un autre a planté.
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    const echec = journaux().find(
      (j) => j["action"] === "qualiopi.autofacture.rattrapage.echec" && j["targetId"] === ID_A,
    );
    expect(echec).toBeDefined();
  });
});
