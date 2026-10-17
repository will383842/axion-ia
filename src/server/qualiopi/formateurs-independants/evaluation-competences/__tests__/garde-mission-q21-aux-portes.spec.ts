// @vitest-environment node

/**
 * Qualiopi ind. 21 — la garde d'habilitation COMPOSÉE aux portes (`controlerGardeMission`),
 * sur une base doublée :
 *
 *   · 🔴 mode « avertir » (ancien stock, activation antérieure au contrôle) : aucune
 *     décision d'habilitation = REFUS, jamais un simple avertissement — comme la
 *     suspension au registre ; les autres manques gardent leur mode ;
 *   · 🔴 révocation après acceptation : habilité sur A et B, mission sur B, puis
 *     « non habilité » sur B → la garde jugée sur la session de la mission refuse,
 *     alors que le contrôle général (aucune mission précise) passerait encore.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { VERSION_CONFIGURATION_EVALUATION } from "../configuration";
import {
  MANQUE_MISSION_FORMATION_INCONNUE,
  MANQUE_MISSION_HABILITATION,
  type LigneEvaluationLue,
} from "../regles";

const h = vi.hoisted(() => {
  const etat = {
    settings: new Map<string, unknown>(),
    lignes: [] as unknown[],
    formationDeSession: new Map<string, string>(),
  };
  const prisma = {
    setting: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        etat.settings.has(where.key) ? { value: etat.settings.get(where.key) } : null,
      ),
    },
    trainer: {
      findUnique: vi.fn(async () => ({
        statut: "sous_traitant",
        actif: true,
        siret: "12345678900011",
        sousTraitantVerifieAt: new Date("2026-10-10T10:00:00Z"),
        sousTraitantNda: "84380000000",
        sousTraitantContratSigneAt: new Date("2026-09-01T10:00:00Z"),
        finCollaborationAt: null,
        activationValideeSource: "anterieure_au_controle",
        documents: [],
      })),
    },
    documentGenere: {
      findFirst: vi.fn(async () => ({
        metadata: {
          renderData: { gabaritVersion: 99, data: { sousTraitant: { siret: "12345678900011" } } },
        },
        signatures: [{ signeAt: new Date("2026-09-01T10:00:00Z") }],
      })),
    },
    trainerStatement: { findMany: vi.fn(async () => []) },
    evaluationCompetenceFormateur: { findMany: vi.fn(async () => etat.lignes) },
    trainingSession: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const formationId = etat.formationDeSession.get(where.id);
        return formationId === undefined ? null : { formationId };
      }),
    },
  };
  return { etat, prisma };
});
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));

import { controlerGardeMission } from "../../garde-mission-portes";

const MAINTENANT = new Date("2026-10-17T10:00:00Z");

let n = 0;
const decision = (formationId: string, d: string): LigneEvaluationLue => {
  n += 1;
  return {
    id: `d${n}`,
    nature: "decision_habilitation",
    formationId,
    notes: null,
    decision: d,
    motif: "m",
    dateSuivie: null,
    version: VERSION_CONFIGURATION_EVALUATION,
    createdAt: new Date(Date.UTC(2026, 9, 1, 0, n)),
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.etat.settings.clear();
  h.etat.settings.set("formateurs.garde_mission_portes", { actif: true });
  h.etat.settings.set("formateurs.garde_mission", { valeur: "avertir" });
  h.etat.lignes = [];
  h.etat.formationDeSession = new Map([
    ["s-a", "f-a"],
    ["s-b", "f-b"],
  ]);
});

describe("ind. 21 aux portes : l'habilitation n'est jamais un simple avertissement", () => {
  it("🔴 niveau « avertir », source antérieure au contrôle, aucune décision → refus", async () => {
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s-b" });
    expect(r.mode).toBe("refuser");
    expect(r.refus).toContain(MANQUE_MISSION_HABILITATION);
    expect(r.avertissements).not.toContain(MANQUE_MISSION_HABILITATION);
  });

  it("sans mission précise non plus : aucune formation habilitée → refus, même en « avertir »", async () => {
    const r = await controlerGardeMission("t-1", MAINTENANT);
    expect(r.refus).toEqual([MANQUE_MISSION_HABILITATION]);
  });

  it("habilité sur la formation : le manque disparaît, les autres gardent le mode « avertir »", async () => {
    h.etat.lignes = [decision("f-b", "habilite")];
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s-b" });
    expect(r.refus).not.toContain(MANQUE_MISSION_HABILITATION);
    expect(r.avertissements).not.toContain(MANQUE_MISSION_HABILITATION);
  });

  it("portes coupées : rien n'est lu, rien n'est refusé (module gelé)", async () => {
    h.etat.settings.delete("formateurs.garde_mission_portes");
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s-b" });
    expect(r).toEqual({ mode: "coupee", refus: [], avertissements: [] });
    expect(h.prisma.evaluationCompetenceFormateur.findMany).not.toHaveBeenCalled();
  });
});

describe("ind. 21 : révocation APRÈS l'acceptation (moteur de la mission)", () => {
  it("🔴 habilité sur A et B, mission sur B, puis « non habilité » sur B → refus sur B", async () => {
    h.etat.lignes = [decision("f-a", "habilite"), decision("f-b", "habilite")];
    const avant = await controlerGardeMission("t-1", MAINTENANT, undefined, { sessionId: "s-b" });
    expect(avant.refus).not.toContain(MANQUE_MISSION_HABILITATION);

    h.etat.lignes = [...h.etat.lignes, decision("f-b", "non_habilite")];
    const apres = await controlerGardeMission("t-1", MAINTENANT, undefined, { sessionId: "s-b" });
    expect(apres.mode).toBe("refuser");
    expect(apres.refus).toContain(MANQUE_MISSION_HABILITATION);
    expect(h.prisma.trainingSession.findUnique).toHaveBeenCalledWith({
      where: { id: "s-b" },
      select: { formationId: true },
    });

    // Le contrôle général (aucune mission) passerait encore grâce à A : c'est
    // précisément ce que le moteur ne doit plus utiliser.
    const general = await controlerGardeMission("t-1", MAINTENANT);
    expect(general.refus).not.toContain(MANQUE_MISSION_HABILITATION);
  });

  it("session de la mission introuvable : refus (garde fermée)", async () => {
    h.etat.lignes = [decision("f-a", "habilite")];
    const r = await controlerGardeMission("t-1", MAINTENANT, undefined, { sessionId: "s-x" });
    expect(r.mode).toBe("refuser");
    expect(r.refus).toEqual([MANQUE_MISSION_FORMATION_INCONNUE]);
  });
});
