/**
 * Le CÂBLAGE du sous-lot 8C — et pas seulement sa décision.
 *
 * ## 🔴 Le trou que ce fichier ferme
 *
 * La vérification adversariale du 16/08 a prouvé par exécution que **couper
 * l'appel de 8C laissait 568 tests verts**. `dossier-auto.spec.ts` verrouille la
 * DÉCISION (`changementOuvreUnDossier("direct", "opco") === true`) ; rien ne
 * verrouillait le POINT D'APPEL.
 *
 * Autrement dit : le lot 8C pouvait être intégralement annulé en production sans
 * qu'une seule PR ne rougisse — et le défaut d'origine qu'il ferme est
 * exactement celui-là. « `creerDossierDepuisSession` n'avait qu'un seul
 * appelant [...] vérifié en production, **zéro dossier existait** ».
 *
 * > 🔑 Une décision extraite dans un module pur bien testé, dont le point
 * > d'appel n'est couvert par rien, est une garde qui ne garde rien. C'est la
 * > forme la plus trompeuse du défaut, parce que la couverture a l'air bonne.
 *
 * Ces tests montent la Server Action avec un Prisma simulé et vérifient ce qui
 * a été RÉELLEMENT appelé.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSessionFindUnique, mockSessionUpdate, mockDossierFindFirst, mockDossierCreate } =
  vi.hoisted(() => ({
    mockSessionFindUnique: vi.fn(),
    mockSessionUpdate: vi.fn(),
    mockDossierFindFirst: vi.fn(),
    mockDossierCreate: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: mockSessionFindUnique,
      findUniqueOrThrow: mockSessionFindUnique,
      update: mockSessionUpdate,
    },
    dossierFinancement: { findFirst: mockDossierFindFirst, create: mockDossierCreate },
    client: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    activityLog: { create: vi.fn() },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/actions/qualiopi/_revalidate", () => ({
  revalidateQualiopi: vi.fn(),
  revalidateAdmin: vi.fn(),
}));

import { setFinancementSessionAction } from "@/server/actions/qualiopi/financements";

const SESSION_ID = "44444444-4444-4444-8444-444444444444";

/** La session telle que la lit `creerDossierDepuisSession`. */
function sessionLue(financementType: string) {
  return {
    id: SESSION_ID,
    clientId: "c-1",
    montantHtCents: 300000,
    financementType,
    opcoSubrogation: false,
    numeroDossierOpco: null,
    priseEnChargeMontantCents: null,
    priseEnChargeUnite: null,
    priseEnChargePlafondFormationCents: null,
    priseEnChargePlafondAnnuelCents: null,
    nbParticipantsPrevus: 5,
    formation: { dureeHeures: 14 },
    edofVerifieAt: null,
    ftDispositif: null,
    client: { id: "c-1", raisonSociale: "Acme", opcoIdentifie: "atlas", type: "entreprise" },
    enrollments: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionUpdate.mockResolvedValue({ id: SESSION_ID });
  mockDossierFindFirst.mockResolvedValue(null);
  mockDossierCreate.mockResolvedValue({ id: "d-1" });
});

describe("🔴 le dossier s'ouvre RÉELLEMENT — c'est l'appel qui est testé, pas la décision", () => {
  it("passer de `direct` à `opco` CRÉE un dossier de financement", async () => {
    // La lecture du financement AVANT écriture, puis la relecture complète par
    // `creerDossierDepuisSession` : deux appels, même mock.
    mockSessionFindUnique
      .mockResolvedValueOnce({ client: { type: "entreprise" } }) // garde de cohérence
      .mockResolvedValueOnce({ financementType: "direct" }) // état AVANT
      .mockResolvedValue(sessionLue("opco")); // lecture du constructeur

    const r = await setFinancementSessionAction({
      sessionId: SESSION_ID,
      financementType: "opco",
    });

    expect("data" in r, "l'action a échoué").toBe(true);
    expect(
      mockDossierCreate,
      "AUCUN dossier n'a été créé : le câblage 8C est coupé, et le suivi OPCO est éteint",
    ).toHaveBeenCalledTimes(1);
  });

  it("le dossier naît en `a_monter` — ouvrir n'est pas déposer", async () => {
    mockSessionFindUnique
      .mockResolvedValueOnce({ client: { type: "entreprise" } })
      .mockResolvedValueOnce({ financementType: "direct" })
      .mockResolvedValue(sessionLue("opco"));

    await setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "opco" });

    // 🔴 Le statut par défaut du schéma est `a_monter`. Le constructeur ne doit
    // JAMAIS le forcer plus loin : déposer la demande engage l'organisme au nom
    // du client et reste un acte habilité.
    const data = mockDossierCreate.mock.calls[0]?.[0]?.data as Record<string, unknown> | undefined;
    expect(data?.["statut"], "le dossier a été ouvert dans un statut engageant").toBeUndefined();
  });

  it("le dossier est rattaché à LA SESSION — sans ce lien, tout le suivi reste aveugle", async () => {
    mockSessionFindUnique
      .mockResolvedValueOnce({ client: { type: "entreprise" } })
      .mockResolvedValueOnce({ financementType: "direct" })
      .mockResolvedValue(sessionLue("opco"));

    await setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "opco" });

    const data = mockDossierCreate.mock.calls[0]?.[0]?.data as Record<string, unknown> | undefined;
    expect(data?.["trainingSessionId"]).toBe(SESSION_ID);
  });
});

describe("et il ne s'ouvre PAS quand il ne doit pas", () => {
  it("`opco` → `opco` n'ouvre rien — sinon corriger un n° de dossier en rouvrirait un", async () => {
    mockSessionFindUnique
      .mockResolvedValueOnce({ client: { type: "entreprise" } })
      .mockResolvedValueOnce({ financementType: "opco" })
      .mockResolvedValue(sessionLue("opco"));

    await setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "opco" });

    expect(mockDossierCreate).not.toHaveBeenCalled();
  });

  it("un financement `direct` n'ouvre aucun dossier — il n'y a pas de financeur à suivre", async () => {
    mockSessionFindUnique
      .mockResolvedValueOnce({ client: { type: "entreprise" } })
      .mockResolvedValueOnce({ financementType: null })
      .mockResolvedValue(sessionLue("direct"));

    await setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "direct" });

    expect(mockDossierCreate).not.toHaveBeenCalled();
  });

  it("modifier un autre champ SANS toucher au financement n'ouvre rien", async () => {
    mockSessionFindUnique
      .mockResolvedValueOnce({ financementType: "opco" })
      .mockResolvedValue(sessionLue("opco"));

    await setFinancementSessionAction({ sessionId: SESSION_ID, numeroDossierOpco: "ATL-9" });

    expect(mockDossierCreate).not.toHaveBeenCalled();
  });

  it("🔴 un dossier EXISTANT n'est jamais dupliqué", async () => {
    mockDossierFindFirst.mockResolvedValue({ id: "deja-la" });
    mockSessionFindUnique
      .mockResolvedValueOnce({ client: { type: "entreprise" } })
      .mockResolvedValueOnce({ financementType: "direct" })
      .mockResolvedValue(sessionLue("opco"));

    await setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "opco" });

    expect(
      mockDossierCreate,
      "un second dossier a été créé pour la même session",
    ).not.toHaveBeenCalled();
  });
});

describe("🔴 l'ouverture est FAIL-SOFT — elle ne doit jamais perdre la donnée métier", () => {
  it("un échec d'ouverture ne fait pas échouer l'enregistrement du financement", async () => {
    // Le financement vient d'être saisi par un humain. Faire échouer l'action
    // parce que la vue de PILOTAGE n'a pas pu s'ouvrir perdrait la donnée
    // métier au profit de son tableau de bord.
    mockDossierCreate.mockRejectedValue(new Error("base indisponible"));
    mockSessionFindUnique
      .mockResolvedValueOnce({ client: { type: "entreprise" } })
      .mockResolvedValueOnce({ financementType: "direct" })
      .mockResolvedValue(sessionLue("opco"));

    const r = await setFinancementSessionAction({
      sessionId: SESSION_ID,
      financementType: "opco",
    });

    expect("data" in r, "l'échec du dossier a fait perdre le financement saisi").toBe(true);
    expect(mockSessionUpdate).toHaveBeenCalled();
  });
});
