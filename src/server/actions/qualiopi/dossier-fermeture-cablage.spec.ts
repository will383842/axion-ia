/**
 * Le RETOUR du sous-lot 8C : ce qui s'ouvre tout seul doit savoir se refermer tout seul.
 *
 * ## 🔴 Le défaut, mesuré en production le 17/09/2026
 *
 * Une session du 05/09 est passée de `direct` à `opco` + subrogation, puis est
 * revenue à `direct` **cinq secondes plus tard** — une simple correction de
 * saisie. L'aller a ouvert un dossier de financement tout seul
 * (`qualiopi.dossier_financement.ouvert_auto`) ; le retour n'a rien défait :
 *
 *   1. un dossier `opco`, `a_monter`, « Financeur à identifier », 100 €, restait
 *      rattaché à une action facturée en direct avec TVA ;
 *   2. `training_sessions.opco_subrogation` restait à `true` — le formulaire
 *      n'envoie la subrogation que quand le type affiché est OPCO/mixte.
 *
 * Deux résidus DÉFINITIFS et visibles, laissés par n'importe qui se trompe de
 * menu puis se corrige. L'aller était testé (`dossier-ouverture-cablage.spec.ts`),
 * le retour n'existait pas.
 *
 * ## Ce qui se referme, et ce qui ne se referme JAMAIS
 *
 * - un dossier `a_monter` est un classeur vide qui ne parle à personne : il
 *   s'ouvre sans humain, il se referme sans humain (`clos`, jamais supprimé) ;
 * - un dossier `envoye` ou au-delà ENGAGE l'organisme auprès d'un financeur :
 *   il n'est jamais touché, l'action le signale en clair.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockSessionFindUnique,
  mockSessionUpdate,
  mockDossierFindFirst,
  mockDossierFindMany,
  mockDossierFindUniqueOrThrow,
  mockDossierUpdateMany,
  mockDossierCreate,
  mockLog,
} = vi.hoisted(() => ({
  mockSessionFindUnique: vi.fn(),
  mockSessionUpdate: vi.fn(),
  mockDossierFindFirst: vi.fn(),
  mockDossierFindMany: vi.fn(),
  mockDossierFindUniqueOrThrow: vi.fn(),
  mockDossierUpdateMany: vi.fn(),
  mockDossierCreate: vi.fn(),
  mockLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: mockSessionFindUnique,
      findUniqueOrThrow: mockSessionFindUnique,
      update: mockSessionUpdate,
    },
    dossierFinancement: {
      findFirst: mockDossierFindFirst,
      findMany: mockDossierFindMany,
      findUniqueOrThrow: mockDossierFindUniqueOrThrow,
      updateMany: mockDossierUpdateMany,
      create: mockDossierCreate,
    },
    client: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    activityLog: { create: vi.fn() },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: mockLog,
}));

vi.mock("@/server/actions/qualiopi/_revalidate", () => ({
  revalidateQualiopi: vi.fn(),
  revalidateAdmin: vi.fn(),
}));

import { setFinancementSessionAction } from "@/server/actions/qualiopi/financements";

const SESSION_ID = "44444444-4444-4444-8444-444444444444";

/** Les dossiers de la session, tels que la base les rend. */
function dossiersEnBase(dossiers: Array<{ id: string; statut: string } & Record<string, unknown>>) {
  // Comme Prisma : un horodatage jamais posé vaut `null`. Un champ ABSENT n'est
  // pas « jamais déposé » — la fermeture échoue fermée (dossier traité engagé).
  const lus = dossiers.map((d) => ({
    envoyeAt: null,
    accordAt: null,
    refuseAt: null,
    paiementRecuAt: null,
    ...d,
  }));
  mockDossierFindMany.mockResolvedValue(lus);
  mockDossierFindUniqueOrThrow.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve({ statut: dossiers.find((d) => d.id === where.id)?.statut }),
  );
}

/** Le `data` écrit sur la session. */
function ecritSurLaSession(): Record<string, unknown> {
  return (mockSessionUpdate.mock.calls[0]?.[0]?.data ?? {}) as Record<string, unknown>;
}

/** Les dossiers passés à `clos` (verrou optimiste : `updateMany` conditionné au statut). */
function dossiersClos(): string[] {
  return mockDossierUpdateMany.mock.calls
    .filter((c) => (c[0]?.data as { statut?: string })?.statut === "clos")
    .map((c) => (c[0]?.where as { id: string }).id);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLog.mockResolvedValue(undefined);
  mockSessionUpdate.mockResolvedValue({ id: SESSION_ID });
  mockDossierFindFirst.mockResolvedValue(null);
  mockDossierCreate.mockResolvedValue({ id: "d-neuf" });
  mockDossierUpdateMany.mockResolvedValue({ count: 1 });
  dossiersEnBase([]);
});

describe("🔴 le retour opco → direct DÉFAIT ce que l'aller a fait", () => {
  it("la subrogation retombe à `false` dans la MÊME écriture", async () => {
    mockSessionFindUnique.mockResolvedValue({ financementType: "opco" });

    const r = await setFinancementSessionAction({
      sessionId: SESSION_ID,
      financementType: "direct",
    });

    expect("data" in r).toBe(true);
    expect(
      ecritSurLaSession()["opcoSubrogation"],
      "une session `direct` garde `opco_subrogation = true` — le résidu du 17/09",
    ).toBe(false);
  });

  it("le dossier `a_monter` ouvert par l'aller est CLOS — jamais supprimé", async () => {
    mockSessionFindUnique.mockResolvedValue({ financementType: "opco" });
    dossiersEnBase([{ id: "d-orphelin", statut: "a_monter" }]);

    await setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "direct" });

    expect(
      dossiersClos(),
      "le dossier ouvert tout seul n'a pas été refermé : il reste orphelin sur une action en direct",
    ).toEqual(["d-orphelin"]);
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "qualiopi.dossier_financement.clos_auto",
        targetId: "d-orphelin",
      }),
    );
  });

  it("🔴 un dossier ENGAGÉ (`envoye`) n'est JAMAIS touché — l'action le dit en clair", async () => {
    mockSessionFindUnique.mockResolvedValue({ financementType: "opco" });
    dossiersEnBase([{ id: "d-parti", statut: "envoye" }]);

    const r = await setFinancementSessionAction({
      sessionId: SESSION_ID,
      financementType: "direct",
    });

    expect(dossiersClos(), "un dossier déposé chez le financeur a été clos par un menu").toEqual(
      [],
    );
    expect(
      "data" in r && r.data.avertissement,
      "aucun avertissement sur le dossier engagé",
    ).toMatch(/envoy/i);
  });

  it("aller-retour en 5 s : 0 dossier `a_monter` restant, subrogation à `false`", async () => {
    // Aller : direct → opco + subrogation. Le dossier s'ouvre.
    mockSessionFindUnique
      .mockResolvedValueOnce({ client: { type: "entreprise" } })
      .mockResolvedValueOnce({ financementType: "direct" })
      .mockResolvedValue({
        id: SESSION_ID,
        clientId: "c-1",
        montantHtCents: 10000,
        financementType: "opco",
        opcoSubrogation: true,
        numeroDossierOpco: null,
        priseEnChargeMontantCents: null,
        priseEnChargeUnite: null,
        priseEnChargePlafondFormationCents: null,
        priseEnChargePlafondAnnuelCents: null,
        nbParticipantsPrevus: 1,
        formation: { dureeHeures: 7 },
        edofVerifieAt: null,
        ftDispositif: null,
        client: { id: "c-1", raisonSociale: "SCI", opcoIdentifie: null, type: "entreprise" },
        enrollments: [],
      });
    await setFinancementSessionAction({
      sessionId: SESSION_ID,
      financementType: "opco",
      opcoSubrogation: true,
    });
    expect(mockDossierCreate).toHaveBeenCalledTimes(1);

    // Retour, cinq secondes plus tard.
    mockSessionFindUnique.mockReset();
    mockSessionFindUnique.mockResolvedValue({ financementType: "opco" });
    mockSessionUpdate.mockClear();
    dossiersEnBase([{ id: "d-neuf", statut: "a_monter" }]);
    await setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "direct" });

    expect(dossiersClos()).toEqual(["d-neuf"]);
    expect(ecritSurLaSession()["opcoSubrogation"]).toBe(false);
  });
});

describe("🔴 réenregistrer « direct » NETTOIE un résidu déjà en base", () => {
  it("direct → direct sur une session restée en subrogation : `false`", async () => {
    // C'est le chemin de nettoyage du résidu du 17/09 PAR LA CONSOLE (R-12 :
    // aucune écriture directe en base) : réenregistrer le financement.
    mockSessionFindUnique.mockResolvedValue({ financementType: "direct" });

    await setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "direct" });

    expect(ecritSurLaSession()["opcoSubrogation"]).toBe(false);
  });

  it("direct → direct avec un dossier `a_monter` resté orphelin : il est clos", async () => {
    mockSessionFindUnique.mockResolvedValue({ financementType: "direct" });
    dossiersEnBase([{ id: "d-ancien", statut: "a_monter" }]);

    await setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "direct" });

    expect(dossiersClos()).toEqual(["d-ancien"]);
  });
});

describe("et rien ne se referme quand il ne doit pas", () => {
  it("opco → opco garde la subrogation saisie — contre-témoin", async () => {
    mockSessionFindUnique
      .mockResolvedValueOnce({ client: { type: "entreprise" } })
      .mockResolvedValue({ financementType: "opco" });
    dossiersEnBase([{ id: "d-actif", statut: "a_monter" }]);

    await setFinancementSessionAction({
      sessionId: SESSION_ID,
      financementType: "opco",
      opcoSubrogation: true,
    });

    expect(ecritSurLaSession()["opcoSubrogation"]).toBe(true);
    expect(dossiersClos(), "un dossier d'une session TOUJOURS financée a été clos").toEqual([]);
  });

  it("mixte garde la subrogation — il porte une part OPCO", async () => {
    mockSessionFindUnique
      .mockResolvedValueOnce({ client: { type: "entreprise" } })
      .mockResolvedValue({ financementType: "mixte" });

    await setFinancementSessionAction({
      sessionId: SESSION_ID,
      financementType: "mixte",
      opcoSubrogation: true,
    });

    expect(ecritSurLaSession()["opcoSubrogation"]).toBe(true);
  });

  it("opco → cpf : on reste dans le périmètre suivi, le dossier n'est pas clos", async () => {
    mockSessionFindUnique
      .mockResolvedValueOnce({ client: { type: "entreprise" } })
      .mockResolvedValue({ financementType: "opco" });
    dossiersEnBase([{ id: "d-actif", statut: "a_monter" }]);

    await setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "cpf" });

    expect(dossiersClos()).toEqual([]);
  });

  it("un champ modifié SANS le financement ne referme rien et ne touche pas la subrogation", async () => {
    mockSessionFindUnique.mockResolvedValue({ financementType: "opco" });
    dossiersEnBase([{ id: "d-actif", statut: "a_monter" }]);

    await setFinancementSessionAction({ sessionId: SESSION_ID, numeroDossierOpco: "ATL-9" });

    expect(ecritSurLaSession()).not.toHaveProperty("opcoSubrogation");
    expect(dossiersClos()).toEqual([]);
  });
});

describe("🔴 la fermeture est FAIL-SOFT, comme l'ouverture", () => {
  it("un échec de fermeture ne fait pas perdre le financement saisi", async () => {
    mockSessionFindUnique.mockResolvedValue({ financementType: "opco" });
    mockDossierFindMany.mockRejectedValue(new Error("base indisponible"));

    const r = await setFinancementSessionAction({
      sessionId: SESSION_ID,
      financementType: "direct",
    });

    expect("data" in r, "l'échec de la fermeture a fait échouer l'enregistrement").toBe(true);
    expect(mockSessionUpdate).toHaveBeenCalled();
  });
});

describe("🔴 un dossier CLOS ne bloque pas la réouverture du suivi", () => {
  it("revenir en opco après un aller-retour ouvre un NOUVEAU dossier", async () => {
    // Sans cela, opco → direct → opco laisserait la session en OPCO avec pour
    // seul dossier un dossier `clos` : aucune alerte, aucune ligne au cockpit —
    // exactement le défaut que le sous-lot 8C a fermé.
    mockSessionFindUnique
      .mockResolvedValueOnce({ client: { type: "entreprise" } })
      .mockResolvedValueOnce({ financementType: "direct" })
      .mockResolvedValue({
        id: SESSION_ID,
        clientId: "c-1",
        montantHtCents: 10000,
        financementType: "opco",
        opcoSubrogation: false,
        numeroDossierOpco: null,
        priseEnChargeMontantCents: null,
        priseEnChargeUnite: null,
        priseEnChargePlafondFormationCents: null,
        priseEnChargePlafondAnnuelCents: null,
        nbParticipantsPrevus: 1,
        formation: { dureeHeures: 7 },
        edofVerifieAt: null,
        ftDispositif: null,
        client: { id: "c-1", raisonSociale: "SCI", opcoIdentifie: null, type: "entreprise" },
        enrollments: [],
      });

    await setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "opco" });

    const where = mockDossierFindFirst.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(
      where?.["statut"],
      "la recherche d'un dossier existant compte les dossiers CLOS : le suivi ne se rouvrira jamais",
    ).toEqual({ not: "clos" });
  });
});

describe("🔴 B1/B2 (#1112) — un dossier ENGAGÉ n'est JAMAIS clos, quel que soit son statut", () => {
  // La machine à états PERMET `→ clos` depuis accord_recu, refuse, facture et
  // paiement_recu (`DOSSIER_TRANSITIONS`). Le seul témoin d'origine portait sur
  // `envoye`, le seul état qu'elle interdit déjà de clore : il ne gardait rien.
  // Chacun de ces témoins doit rougir si la fermeture se fie à la machine à
  // états (« tout ce qui peut aller à clos ») au lieu de l'historique de dépôt.
  it.each(["envoye", "accord_recu", "refuse", "facture", "paiement_recu"])(
    "`%s` : pas clos, et l'action le dit",
    async (statut) => {
      mockSessionFindUnique.mockResolvedValue({ financementType: "opco" });
      dossiersEnBase([{ id: "d-engage", statut }]);

      const r = await setFinancementSessionAction({
        sessionId: SESSION_ID,
        financementType: "direct",
      });

      expect(dossiersClos(), `un dossier \`${statut}\` a été clos par un menu`).toEqual([]);
      expect("data" in r && r.data.avertissement, "aucun avertissement").toBeTruthy();
    },
  );

  it.each(["envoyeAt", "accordAt", "refuseAt", "paiementRecuAt"])(
    "🔴 `a_monter` qui porte `%s` (déposé puis renvoyé) : ENGAGÉ, pas clos",
    async (champ) => {
      // `envoye → a_monter` est permis et ne remet aucun horodatage à zéro : un
      // `a_monter` n'est un classeur vide que s'il n'a JAMAIS été déposé. Panne
      // de la revue 5250421969 : un éditeur sans `deposer_demande_financeur`
      // clôturait, sans avertissement, une demande en cours chez l'OPCO.
      mockSessionFindUnique.mockResolvedValue({ financementType: "opco" });
      dossiersEnBase([
        { id: "d-depose-puis-renvoye", statut: "a_monter", [champ]: new Date("2026-09-01") },
      ]);

      const r = await setFinancementSessionAction({
        sessionId: SESSION_ID,
        financementType: "direct",
      });

      expect(dossiersClos(), "un dossier déjà déposé a été clos comme un classeur vide").toEqual(
        [],
      );
      expect("data" in r && r.data.avertissement, "aucun avertissement").toMatch(/déposé/i);
    },
  );

  it("l'avertissement parle français, pas en codes machine", async () => {
    mockSessionFindUnique.mockResolvedValue({ financementType: "opco" });
    dossiersEnBase([{ id: "d-accord", statut: "accord_recu" }]);

    const r = await setFinancementSessionAction({
      sessionId: SESSION_ID,
      financementType: "direct",
    });

    const texte = "data" in r ? (r.data.avertissement ?? "") : "";
    expect(texte).toContain("Accord reçu");
    expect(texte).not.toContain("accord_recu");
  });
});

describe("la fermeture ne relit que ce qui est encore ouvert", () => {
  it("la recherche des dossiers à refermer exclut les dossiers `clos`", async () => {
    mockSessionFindUnique.mockResolvedValue({ financementType: "opco" });

    await setFinancementSessionAction({ sessionId: SESSION_ID, financementType: "direct" });

    const where = mockDossierFindMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where?.["trainingSessionId"]).toBe(SESSION_ID);
    expect(where?.["statut"], "les dossiers clos sont relus, et comptés comme engagés").toEqual({
      not: "clos",
    });
  });
});

describe("🔴 la journalisation suit chaque fermeture, pas la boucle", () => {
  it("un échec sur le 2ᵉ dossier n'efface pas la trace du 1ᵉʳ, déjà clos", async () => {
    mockSessionFindUnique.mockResolvedValue({ financementType: "opco" });
    dossiersEnBase([
      { id: "d-1", statut: "a_monter" },
      { id: "d-2", statut: "a_monter" },
    ]);
    // Verrou optimiste perdu sur le second : `transitionnerDossier` lève.
    mockDossierUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const r = await setFinancementSessionAction({
      sessionId: SESSION_ID,
      financementType: "direct",
    });

    expect("data" in r).toBe(true);
    expect(mockLog, "le dossier d-1 est clos en base mais absent du journal").toHaveBeenCalledWith(
      expect.objectContaining({
        action: "qualiopi.dossier_financement.clos_auto",
        targetId: "d-1",
      }),
    );
  });
});
