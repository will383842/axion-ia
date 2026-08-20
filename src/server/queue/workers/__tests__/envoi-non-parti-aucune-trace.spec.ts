/**
 * `D5-1-C1` — un envoi qui n'est pas parti ne doit laisser AUCUNE trace.
 *
 * ## Le défaut
 *
 * `enqueueEmail` **ne lève pas** quand l'envoi échoue : elle RETOURNE
 * `{ enqueued: false }` si la file est absente, et
 * `{ enqueued: false, garePourValidation: true }` si une règle
 * `EmailAutomationSetting` gare le message en corbeille de validation.
 *
 * Six fonctions d'envoi rendaient `Promise<void>`. Les crons posaient donc
 * `envoyeAt` dès que l'appel ne levait pas — c'est-à-dire toujours. Le
 * destinataire ne recevait rien, la base affirmait le contraire, et le filtre
 * `envoyeAt: null` l'écartait ensuite DÉFINITIVEMENT du rattrapage.
 *
 * 🔑 C'est la reconstitution littérale de l'incident « aucune convocation jamais
 * envoyée en production ». La convocation a été corrigée le 2026-08-19 ; les six
 * autres portaient le même défaut.
 *
 * ## Ce que ce fichier garde, et que les tests existants ne gardaient pas
 *
 * ⚠️ `qualiopi-formation-crons-worker.spec.ts` couvrait déjà le cas où l'envoi
 * **LÈVE** (`mockRejectedValueOnce`). Il ne couvrait PAS celui où l'envoi rend
 * « non envoyé » **sans lever** — qui est précisément le défaut. Une garde qui
 * ne teste que la levée passe à côté de la seule façon dont ce bug se produit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ⚠️ `vi.mock` est hissé en tête de fichier : sa fabrique ne peut pas fermer sur
// une variable de portée module (« Cannot access before initialization »). Les
// doubles sont donc créés DANS la fabrique, et récupérés ensuite par import.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaire: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    trainingSession: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
  },
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
// ⚠️ Mêmes doubles que `qualiopi-formation-crons-worker.spec.ts` : sans eux, la
// chaîne d'import atteint `next-auth`, qui tente de charger `next/server` hors
// contexte Next et fait échouer la COLLECTE du fichier — « no tests », un état
// qui ressemble à un succès dans un journal pressé.
vi.mock("@/server/qualiopi/indicateurs/service", () => ({
  invalidateIndicateursCache: vi.fn(),
}));
vi.mock("@/server/qualiopi/formations/state-machine", () => ({
  assertSessionTransition: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { envoyerSatisfactionJ1 } from "@/server/qualiopi/notifications/notifications-service";
import { formationCronsHandler } from "../qualiopi-formation-crons-worker";

const mockEnvoi = envoyerSatisfactionJ1 as ReturnType<typeof vi.fn>;
const mp = prisma as unknown as {
  questionnaire: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  trainingSession: { findMany: ReturnType<typeof vi.fn> };
  enrollment: { findMany: ReturnType<typeof vi.fn> };
};

/** Une inscription éligible à la satisfaction J+1. */
function decor(): void {
  mp.enrollment.findMany.mockResolvedValue([{ id: "enr-1" }]);
  mp.questionnaire.findMany.mockResolvedValue([]);
  mp.trainingSession.findMany.mockResolvedValue([]);
  mp.questionnaire.updateMany.mockResolvedValue({ count: 1 });
}

async function lancer(): Promise<void> {
  await formationCronsHandler({
    type: "formation-crons.satisfaction-j1",
    tick: "2026-08-20T08:00:00Z",
  } as unknown as Parameters<typeof formationCronsHandler>[0]);
}

describe("`D5-1-C1` — un envoi non parti ne pose aucune trace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["DATABASE_URL"];
    decor();
  });

  it("🔴 la file est indisponible → `envoyeAt` n'est PAS posé", () => {
    // `{ enqueued: false }` sans levée : le cas exact que les tests existants
    // ne couvraient pas, et le seul par lequel ce bug se produit.
    mockEnvoi.mockResolvedValue(false);
    return lancer().then(() => {
      expect(
        mp.questionnaire.updateMany,
        "poser la trace écarterait le stagiaire du rattrapage, définitivement",
      ).not.toHaveBeenCalled();
    });
  });

  it("🔴 le message est garé en corbeille de validation → pas de trace non plus", () => {
    // ⚠️ « Garé » compte comme NON ENVOYÉ. Le message partira peut-être, après
    // approbation humaine — mais il n'est pas parti. Le cron doit rester en
    // mesure de le reprendre.
    mockEnvoi.mockResolvedValue(false);
    return lancer().then(() => {
      expect(mp.questionnaire.updateMany).not.toHaveBeenCalled();
    });
  });

  it("l'envoi RÉUSSIT → la trace est posée", () => {
    // 🔑 Le témoin de non-vacuité. Sans lui, un cron qui n'écrirait JAMAIS de
    // trace passerait les deux tests ci-dessus — et on aurait « corrigé » le
    // problème en cassant le rattrapage dans l'autre sens : le stagiaire
    // recevrait le même message chaque matin.
    mockEnvoi.mockResolvedValue(true);
    return lancer().then(() => {
      expect(mp.questionnaire.updateMany).toHaveBeenCalled();
    });
  });
});
