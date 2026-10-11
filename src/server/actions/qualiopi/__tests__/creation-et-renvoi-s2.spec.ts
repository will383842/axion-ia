/**
 * Lot S2 — la CRÉATION d'une session et le RENVOI d'une proposition, exécutés
 * (pas seulement lus) : interrupteur `formateurs.affectation_sure` absent
 * (comportement d'avant) puis allumé.
 *
 *  - N5 : à la création, un indépendant déjà pris est refusé ; un salarié est
 *    créé, le chevauchement est signalé ;
 *  - renvoi : recontrôle de la fiche, et le VRAI rôle de l'affectation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
  assertDossierOuvertSiRegeneration: async () => ({ ok: true, sessionId: null }),
}));

const h = vi.hoisted(() => {
  const etat = { allume: false };
  const m = {
    formationFindUnique: vi.fn(),
    trainerFindUnique: vi.fn(),
    sessionCreate: vi.fn(),
    sessionFindUnique: vi.fn(),
    sessionFormateurFindUnique: vi.fn(),
    conflits: vi.fn(),
    proposer: vi.fn(),
  };
  const prisma: Record<string, unknown> = {
    formation: { findUnique: (...a: unknown[]) => m.formationFindUnique(...a) },
    trainer: { findUnique: (...a: unknown[]) => m.trainerFindUnique(...a) },
    trainingSession: {
      create: (...a: unknown[]) => m.sessionCreate(...a),
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
      findUnique: (...a: unknown[]) => m.sessionFindUnique(...a),
    },
    sessionFormateur: {
      createMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async () => ({})),
      findUnique: (...a: unknown[]) => m.sessionFormateurFindUnique(...a),
    },
    sessionJour: { createMany: vi.fn(async () => ({ count: 0 })) },
    sessionTransition: { create: vi.fn(async () => ({ id: "tr-1" })) },
    setting: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        etat.allume && where.key === "formateurs.affectation_sure"
          ? { value: { actif: true } }
          : null,
      ),
    },
  };
  prisma["$transaction"] = async (fn: unknown) =>
    typeof fn === "function" ? (fn as (tx: unknown) => unknown)(prisma) : fn;
  return { etat, m, prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/qualiopi/formations/transition-helper", () => ({
  writeSessionTransition: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/qualiopi/formations/numbering", () => ({
  allocateSessionNumero: vi.fn().mockResolvedValue("AXI-SESS-2026-050"),
}));
vi.mock("@/features/admin-planning/queries", () => ({
  getTrainerConflicts: (...a: unknown[]) => h.m.conflits(...a),
}));
vi.mock("@/server/qualiopi/trainers/avertissements-affectation", () => ({
  avertissementsAffectation: vi.fn(async () => []),
}));
vi.mock("@/server/qualiopi/trainers/conflits-indisponibilite", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/trainers/conflits-indisponibilite")>()),
  detecterIndisponibiliteFormateur: vi.fn(async () => null),
}));
vi.mock("@/server/qualiopi/trainers/mission-formateur", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/trainers/mission-formateur")>()),
  proposerMissionFormateur: (...a: unknown[]) => h.m.proposer(...a),
}));

import { createSessionAction } from "../sessions";
import { renvoyerPropositionMissionAction } from "../mission-formateur";

const FORMATION_ID = "44444444-4444-4444-8444-444444444444";
const TRAINER_ID = "55555555-5555-4555-8555-555555555555";
const SESSION_ID = "66666666-6666-4666-8666-666666666666";

const CONFLIT = {
  key: "formation:autre",
  titre: "Autre formation",
  debut: new Date("2026-11-04T09:00:00Z"),
  fin: new Date("2026-11-04T17:00:00Z"),
  statut: "planifiee",
};

function formateur(over: Record<string, unknown> = {}) {
  return {
    actif: true,
    statut: "sous_traitant",
    sousTraitantVerifieAt: new Date("2026-01-01T00:00:00Z"),
    tarifJourneeHtCents: 35_000,
    habilitations: [{ formationId: FORMATION_ID }],
    ...over,
  };
}

const entree = () => ({
  formationId: FORMATION_ID,
  dateDebut: new Date("2026-11-04T08:00:00Z"),
  dateFin: new Date("2026-11-04T16:00:00Z"),
  modalite: "presentiel" as const,
  nbParticipantsPrevus: 5,
  montantHtCents: 200_000,
  trainerId: TRAINER_ID,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.etat.allume = false;
  h.m.formationFindUnique.mockResolvedValue({
    id: FORMATION_ID,
    titre: "IA pour bien commencer",
    numero: "AXI-FORM-2026-037",
    dureeHeures: 7,
    objectifsPedagogiques: ["Comprendre"],
    statut: "actif",
    statutGeneration: "publie",
  });
  h.m.sessionCreate.mockResolvedValue({ id: SESSION_ID, numero: "AXI-SESS-2026-050" });
  h.m.conflits.mockResolvedValue([CONFLIT]);
  h.m.proposer.mockResolvedValue({ proposee: true, missionId: "mi-1", emailEnvoye: true });
});

describe("N5 — création d'une session avec un formateur déjà pris", () => {
  it("arrêté : aucun contrôle, la session est créée comme avant S2", async () => {
    h.m.trainerFindUnique.mockResolvedValue(formateur());
    const r = await createSessionAction(entree());
    expect(r, JSON.stringify(r)).toHaveProperty("data");
    expect(h.m.conflits).not.toHaveBeenCalled();
  });

  it("allumé : un indépendant pris ailleurs est refusé, rien n'est créé", async () => {
    h.etat.allume = true;
    h.m.trainerFindUnique.mockResolvedValue(formateur());
    const r = await createSessionAction(entree());
    expect(r).toHaveProperty("error");
    if ("error" in r) expect(r.error).toContain("déjà mobilisé");
    expect(h.m.sessionCreate).not.toHaveBeenCalled();
  });

  it("allumé : un salarié pris ailleurs est créé, et le chevauchement est signalé", async () => {
    h.etat.allume = true;
    h.m.trainerFindUnique.mockResolvedValue(
      formateur({ statut: "salarie", sousTraitantVerifieAt: null }),
    );
    const r = await createSessionAction(entree());
    expect(r).toHaveProperty("data");
    if ("data" in r) {
      expect(r.data.avertissements.some((a) => a.startsWith("Attention : "))).toBe(true);
    }
  });
});

describe("renvoi de proposition — recontrôle et vrai rôle", () => {
  beforeEach(() => {
    h.m.sessionFormateurFindUnique.mockResolvedValue({ id: "sf-1", role: "co_formateur" });
    h.m.sessionFindUnique.mockResolvedValue({ formationId: FORMATION_ID });
  });

  it("arrêté : renvoyé comme « principal », sans recontrôle (comme avant S2)", async () => {
    h.m.trainerFindUnique.mockResolvedValue(formateur({ actif: false }));
    const r = await renvoyerPropositionMissionAction({
      sessionId: SESSION_ID,
      trainerId: TRAINER_ID,
    });
    expect(r).toHaveProperty("data");
    expect(h.m.proposer).toHaveBeenCalledWith(expect.objectContaining({ role: "principal" }));
  });

  it("allumé : une fiche inactive n'est pas relancée", async () => {
    h.etat.allume = true;
    h.m.trainerFindUnique.mockResolvedValue(formateur({ actif: false }));
    const r = await renvoyerPropositionMissionAction({
      sessionId: SESSION_ID,
      trainerId: TRAINER_ID,
    });
    expect(r).toHaveProperty("error");
    expect(h.m.proposer).not.toHaveBeenCalled();
  });

  it("allumé : le co-formateur est relancé comme co-formateur", async () => {
    h.etat.allume = true;
    h.m.trainerFindUnique.mockResolvedValue(formateur());
    const r = await renvoyerPropositionMissionAction({
      sessionId: SESSION_ID,
      trainerId: TRAINER_ID,
    });
    expect(r).toHaveProperty("data");
    expect(h.m.proposer).toHaveBeenCalledWith(expect.objectContaining({ role: "co_formateur" }));
  });
});
