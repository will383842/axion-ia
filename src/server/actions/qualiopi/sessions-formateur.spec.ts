/**
 * Tests — le formateur choisi À LA CRÉATION d'une session.
 *
 * 🔴 Le défaut fermé : `formateurPrincipalId` n'avait qu'un seul écrivain,
 * l'assignation depuis la FICHE de la session — donc toujours après coup. On
 * demandait au planificateur de revenir sur ses pas pour renseigner la seule
 * chose qu'il savait au moment où il planifiait, et entre-temps les documents
 * nominatifs retombaient sur la raison sociale de l'organisme.
 *
 * Deux invariants sont verrouillés ici, et ils ne se recouvrent pas.
 *
 * 1. **La garde d'habilitation** (RNQ off.6/19). Le formulaire ne propose que
 *    des formateurs habilités, mais une garde d'interface ne protège que les
 *    usages ordinaires : une Server Action est appelable directement. Accepter à
 *    la création ce que la fiche refuse ouvrirait une porte dérobée — et un
 *    formateur non habilité animant une formation est une non-conformité que
 *    l'audit relève sur pièces.
 *
 * 2. **Le DUAL-WRITE**. Le formateur est rattaché par DEUX voies que le schéma
 *    porte toutes les deux : la FK `formateurPrincipalId` et une ligne
 *    `session_formateurs`. N'écrire que la FK ne serait pas une demi-mesure mais
 *    une incohérence : la fiche et les documents afficheraient le formateur (ils
 *    lisent la FK) pendant que tout ce qui AGRÈGE compterait zéro
 *    (`fiabilite-service` compte par `sessionFormateur.count`,
 *    `remuneration/marge` ventile par `sessionFormateur.groupBy`). Un formateur
 *    visible sur ses sessions et crédité d'aucune mission : l'écart ne se voit
 *    qu'en recoupant deux écrans, donc il ne se voit pas. D'où l'assertion sur
 *    les DEUX écritures, et pas seulement sur « pas d'erreur ».
 *
 * Et un CONTRE-TEST, sans lequel les trois autres pourraient être satisfaits par
 * une garde qui rendrait le champ obligatoire : une session se crée toujours
 * SANS formateur. C'est le cas majoritaire d'une planification à froid.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFormationFindUnique = vi.fn();
const mockTrainerFindUnique = vi.fn();
const mockSessionCreate = vi.fn();
const mockSessionFindMany = vi.fn();
const mockSessionFormateurCreate = vi.fn();
const mockSessionJourCreateMany = vi.fn();
const mockTransitionCreate = vi.fn();

vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, unknown> = {
    formation: { findUnique: (...a: unknown[]) => mockFormationFindUnique(...a) },
    trainer: { findUnique: (...a: unknown[]) => mockTrainerFindUnique(...a) },
    trainingSession: {
      create: (...a: unknown[]) => mockSessionCreate(...a),
      findMany: (...a: unknown[]) => mockSessionFindMany(...a),
    },
    sessionFormateur: { create: (...a: unknown[]) => mockSessionFormateurCreate(...a) },
    sessionJour: { createMany: (...a: unknown[]) => mockSessionJourCreateMany(...a) },
    // ⚠️ `formationTransition`, PAS `sessionTransition` : c'est le modèle
    // qu'écrit `writeSessionTransition`. Se tromper de nom fait échouer la
    // transaction, que le `catch` générique de l'action transforme en « Erreur
    // lors de la création » — un test qui n'assère que « pas d'erreur de garde »
    // resterait alors vert sans qu'aucune écriture n'ait eu lieu.
    formationTransition: { create: (...a: unknown[]) => mockTransitionCreate(...a) },
  };
  prismaMock["$transaction"] = async (fn: unknown) =>
    typeof fn === "function" ? (fn as (tx: unknown) => unknown)(prismaMock) : fn;
  return { prisma: prismaMock };
});

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

import { createSessionAction } from "./sessions";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";

const FORMATION_ID = "44444444-4444-4444-8444-444444444444";
const AUTRE_FORMATION_ID = "66666666-6666-4666-8666-666666666666";
const TRAINER_ID = "55555555-5555-4555-8555-555555555555";
const SESSION_ID = "sess-1";

function entree(over: Record<string, unknown> = {}) {
  return {
    formationId: FORMATION_ID,
    dateDebut: new Date("2026-09-01T09:00:00Z"),
    dateFin: new Date("2026-09-01T17:00:00Z"),
    modalite: "presentiel" as const,
    nbParticipantsPrevus: 5,
    montantHtCents: 200_000,
    trainerId: TRAINER_ID,
    ...over,
  };
}

/** Formateur salarié, habilité sur la formation visée, tarif renseigné. */
function formateurHabilite(over: Record<string, unknown> = {}) {
  return {
    actif: true,
    statut: "salarie",
    sousTraitantVerifieAt: null,
    tarifJourneeHtCents: 60_000,
    habilitations: [{ formationId: FORMATION_ID }],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFormationFindUnique.mockResolvedValue({
    id: FORMATION_ID,
    titre: "IA pour bien commencer",
    dureeHeures: 4,
    modalite: "presentiel",
    objectifsPedagogiques: ["Comprendre"],
    programmeDetaille: null,
    methodesPedagogiques: "Ateliers",
    certificationType: "attestation",
    versionProgramme: "v1",
    // La garde de publication passe AVANT celle du formateur : sans ces deux
    // champs, tous les tests seraient recalés en amont et ne verraient jamais la
    // garde visée.
    statut: "actif",
    statutGeneration: "publie",
  });
  mockTrainerFindUnique.mockResolvedValue(formateurHabilite());
  // Aucun numéro existant → la série démarre à 001 (allocateur MAX+1).
  mockSessionFindMany.mockResolvedValue([]);
  mockSessionCreate.mockResolvedValue({ id: SESSION_ID, numero: "AXI-SESS-2026-001" });
  mockSessionFormateurCreate.mockResolvedValue({ id: "sf-1" });
  mockSessionJourCreateMany.mockResolvedValue({ count: 1 });
  mockTransitionCreate.mockResolvedValue({ id: "tr-1" });
});

/** Données passées au `trainingSession.create` de la transaction. */
function donneesSessionCreee(): Record<string, unknown> {
  const arg = mockSessionCreate.mock.calls[0]?.[0] as { data?: Record<string, unknown> };
  return arg?.data ?? {};
}

describe("createSessionAction — formateur habilité", () => {
  it("accepte le formateur et écrit les DEUX rattachements dans la même transaction", async () => {
    const r = await createSessionAction(entree());

    expect(r).toEqual({ data: { id: SESSION_ID, numero: "AXI-SESS-2026-001" } });

    // Écriture 1 — la FK, lue par la fiche session et les documents nominatifs.
    expect(donneesSessionCreee()["formateurPrincipalId"]).toBe(TRAINER_ID);

    // Écriture 2 — la ligne normalisée, lue par tout ce qui agrège. Son absence
    // ne casserait RIEN visiblement : elle ferait seulement disparaître la
    // mission des compteurs de fiabilité et de la ventilation de marge.
    expect(mockSessionFormateurCreate).toHaveBeenCalledWith({
      data: {
        sessionId: SESSION_ID,
        trainerId: TRAINER_ID,
        role: "principal",
        tarifHtCents: 60_000,
      },
    });
  });

  it("fige le tarif du formateur à l'affectation, et non le barème du jour du relevé", async () => {
    mockTrainerFindUnique.mockResolvedValue(formateurHabilite({ tarifJourneeHtCents: 42_500 }));
    await createSessionAction(entree());
    const arg = mockSessionFormateurCreate.mock.calls[0]?.[0] as {
      data?: { tarifHtCents?: number | null };
    };
    expect(arg?.data?.tarifHtCents).toBe(42_500);
  });

  it("accepte un formateur sans tarif — `null`, jamais 0 (0 est un prix, pas une absence)", async () => {
    mockTrainerFindUnique.mockResolvedValue(formateurHabilite({ tarifJourneeHtCents: null }));
    await createSessionAction(entree());
    const arg = mockSessionFormateurCreate.mock.calls[0]?.[0] as {
      data?: { tarifHtCents?: number | null };
    };
    expect(arg?.data?.tarifHtCents).toBeNull();
  });

  it("journalise le formateur retenu — l'affectation initiale doit être traçable", async () => {
    await createSessionAction(entree());
    const arg = vi.mocked(logQualiopiActivity).mock.calls[0]?.[0] as {
      changes?: Record<string, unknown>;
    };
    expect(arg?.changes?.["formateurPrincipalId"]).toBe(TRAINER_ID);
  });
});

describe("createSessionAction — garde d'habilitation", () => {
  // 🔴 Le cas qui compte : un formateur non habilité animant une formation est
  // une non-conformité relevée sur pièces (RNQ off.6/19).
  it("refuse un formateur NON habilité sur la formation, et dit pourquoi", async () => {
    mockTrainerFindUnique.mockResolvedValue(
      formateurHabilite({ habilitations: [{ formationId: AUTRE_FORMATION_ID }] }),
    );

    const r = await createSessionAction(entree());

    expect("error" in r).toBe(true);
    if ("error" in r) {
      expect(r.error).toContain("Assignation refusée");
      // Le MOTIF, pas seulement le refus : sans lui, l'admin ne sait pas si le
      // formateur est inactif, non habilité, ou non vérifié — trois gestes
      // correctifs différents.
      expect(r.error).toContain("non habilité");
    }
    // Aucune des deux écritures : un refus qui laisserait la session derrière
    // lui serait pire que pas de garde du tout.
    expect(mockSessionCreate).not.toHaveBeenCalled();
    expect(mockSessionFormateurCreate).not.toHaveBeenCalled();
  });

  // ⚠️ Cas exigé par la vigilance URSSAF : un sous-traitant dont l'existence
  // légale n'a pas été vérifiée (`sousTraitantVerifieAt`) n'est pas assignable,
  // même parfaitement habilité sur la formation.
  it("refuse un sous-traitant non vérifié, même habilité sur la formation", async () => {
    mockTrainerFindUnique.mockResolvedValue(
      formateurHabilite({ statut: "sous_traitant", sousTraitantVerifieAt: null }),
    );

    const r = await createSessionAction(entree());

    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("Sous-traitant non vérifié");
    expect(mockSessionCreate).not.toHaveBeenCalled();
    expect(mockSessionFormateurCreate).not.toHaveBeenCalled();
  });

  it("accepte le MÊME sous-traitant une fois vérifié — la garde vise la vérification, pas le statut", async () => {
    mockTrainerFindUnique.mockResolvedValue(
      formateurHabilite({
        statut: "sous_traitant",
        sousTraitantVerifieAt: new Date("2026-01-15T00:00:00Z"),
      }),
    );

    const r = await createSessionAction(entree());

    expect("error" in r).toBe(false);
    expect(mockSessionFormateurCreate).toHaveBeenCalled();
  });

  it("refuse un formateur inactif", async () => {
    mockTrainerFindUnique.mockResolvedValue(formateurHabilite({ actif: false }));
    const r = await createSessionAction(entree());
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("inactif");
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it("refuse un formateur inexistant plutôt que d'écrire une FK morte", async () => {
    mockTrainerFindUnique.mockResolvedValue(null);
    const r = await createSessionAction(entree());
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("introuvable");
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  // Les habilitations doivent être lues via la RELATION `TrainerHabilitation`.
  // La colonne legacy `formationsHabilitees` contient des SLUGS en production
  // alors que la garde compare des UUID : s'en servir refuserait tout le monde
  // en silence (constat F11).
  it("lit les habilitations par la relation, jamais par la colonne legacy", async () => {
    await createSessionAction(entree());
    const arg = mockTrainerFindUnique.mock.calls[0]?.[0] as {
      select?: Record<string, unknown>;
    };
    expect(arg?.select).toHaveProperty("habilitations");
    expect(arg?.select).not.toHaveProperty("formationsHabilitees");
  });

  // 🔴 Une habilitation RETIRÉE ne rend plus habilité — verrou posé au rebase
  // du 2026-08-18 sur la migration `trainer_habilitation_retrait` (2026-08-17).
  //
  // Dé-habiliter ne SUPPRIME plus la ligne, cela la DATE (`retireAt`), pour que
  // la preuve de conformité d'une session déjà animée survive au retrait
  // (ind. 21/22). La ligne reste donc en base, et une garde qui lit les
  // habilitations sans filtre lit l'HISTORIQUE : elle déclarerait habilité un
  // formateur que le registre affiche comme retiré. Le correctif du 2026-08-17
  // avait filtré `listTrainers` et `getFormationIdsHabilites`, jamais les
  // lectures `prisma.trainer` en direct — celle-ci en est une.
  it("ne compte QUE les habilitations actives — une habilitation retirée ne vaut plus", async () => {
    await createSessionAction(entree());
    const arg = mockTrainerFindUnique.mock.calls[0]?.[0] as {
      select?: { habilitations?: { where?: { retireAt?: null } } };
    };
    expect(arg?.select?.habilitations?.where).toEqual({ retireAt: null });
  });
});

describe("createSessionAction — le formateur reste FACULTATIF", () => {
  // 🔑 Contre-test essentiel. Sans lui, une garde qui rendrait le champ
  // obligatoire satisferait tous les tests précédents tout en cassant le cas
  // majoritaire : planifier une session avant de savoir qui l'animera.
  it("crée la session sans aucun formateur", async () => {
    const r = await createSessionAction(entree({ trainerId: undefined }));

    expect(r).toEqual({ data: { id: SESSION_ID, numero: "AXI-SESS-2026-001" } });
    expect(mockSessionCreate).toHaveBeenCalled();
    // La FK n'est même pas posée à `null` : le spread conditionnel laisse la
    // colonne à son défaut, comme pour `clientId` et `devisId`.
    expect(donneesSessionCreee()).not.toHaveProperty("formateurPrincipalId");
    // Et surtout : aucune ligne d'affectation fantôme.
    expect(mockSessionFormateurCreate).not.toHaveBeenCalled();
  });

  it("n'interroge même pas le registre des formateurs quand aucun n'est fourni", async () => {
    await createSessionAction(entree({ trainerId: undefined }));
    expect(mockTrainerFindUnique).not.toHaveBeenCalled();
  });

  it("journalise `null` — « aucun formateur » est un fait d'audit, pas un champ omis", async () => {
    await createSessionAction(entree({ trainerId: undefined }));
    const arg = vi.mocked(logQualiopiActivity).mock.calls[0]?.[0] as {
      changes?: Record<string, unknown>;
    };
    expect(arg?.changes).toHaveProperty("formateurPrincipalId", null);
  });
});
