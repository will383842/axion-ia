/**
 * Qualiopi ind. 21 — la garde de mission AUX PORTES refuse une nouvelle mission quand le
 * suivi qualité l'exige (observation de la 1re mission absente, suspension, réévaluation
 * échue), seulement si `formateurs.suivi_qualite` est allumé, et ÉCHOUE FERMÉE.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const etat = {
    settings: new Map<string, unknown>(),
    trainer: null as Record<string, unknown> | null,
    sessions: [] as Array<Record<string, unknown>>,
  };
  const prisma = {
    setting: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        etat.settings.has(where.key)
          ? { value: etat.settings.get(where.key), updatedAt: new Date("2026-11-01T08:00:00Z") }
          : null,
      ),
    },
    trainer: { findUnique: vi.fn(async () => etat.trainer) },
    trainingSession: { findMany: vi.fn(async () => etat.sessions) },
    documentGenere: { findFirst: vi.fn(async () => null) },
  };
  return { etat, prisma };
});
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("../../vigilance-seuil-lecture", () => ({ lireCumulHonorairesHtCents: async () => 0 }));
vi.mock("../../montant-mission-lecture", () => ({ lireEngagementHtCents: async () => 0 }));
vi.mock("../../contrat-cadre-en-vigueur", () => ({
  lireContratCadreSigne: async () => ({ version: 99, siret: "12345678900011" }),
}));

import { controlerGardeMission } from "../../garde-mission-portes";
import { MANQUES_SUIVI_QUALITE } from "../regles";

const MAINTENANT = new Date("2026-11-20T10:00:00Z");

const session = (id: string, debut: string, fin: string, notes: number[] = []) => ({
  id,
  dateDebut: new Date(`${debut}T08:00:00Z`),
  dateFin: new Date(`${fin}T16:00:00Z`),
  statut: "realisee",
  enrollments: notes.map((n) => ({ questionnaires: [{ noteGlobale: n }] })),
});

beforeEach(() => {
  vi.clearAllMocks();
  h.etat.settings.clear();
  h.etat.settings.set("formateurs.garde_mission_portes", { actif: true });
  h.etat.trainer = {
    statut: "sous_traitant",
    actif: true,
    siret: "12345678900011",
    sousTraitantVerifieAt: new Date("2026-11-10T10:00:00Z"),
    sousTraitantNda: "84380000000",
    sousTraitantContratSigneAt: new Date("2026-09-01T10:00:00Z"),
    finCollaborationAt: null,
    activationValideeSource: "controle",
    documents: [],
    habilitations: [],
    grillesSuiviQualite: [],
    decisionsSuiviQualite: [],
  };
  h.etat.sessions = [session("s1", "2026-11-05", "2026-11-06")];
});

describe("garde de mission × suivi qualité", () => {
  it("interrupteur éteint : rien de plus n'est lu ni refusé (comportement d'avant)", async () => {
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s2" });
    expect(r.refus).toEqual([]);
    expect(h.prisma.trainingSession.findMany).not.toHaveBeenCalled();
  });

  it("allumé : la 2e mission est refusée sans observation de la 1re", async () => {
    h.etat.settings.set("formateurs.suivi_qualite", {
      actif: true,
      allumeLe: "2026-11-01T08:00:00Z",
    });
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s2" });
    expect(r.mode).toBe("refuser");
    expect(r.refus).toContain(MANQUES_SUIVI_QUALITE.observation);
  });

  // Relecture du 2026-10-17 (bloquant 2) : le report passe la forme `nouvelleSession`,
  // sans `sessionId`. La mission reportée est celle que le report remplace : elle ne
  // compte pas comme une « 2e mission » contre son propre formateur.
  const report = (remplaceSessionId?: string) => ({
    nouvelleSession: {
      formationId: null,
      debut: new Date("2026-12-10T08:00:00Z"),
      fin: new Date("2026-12-11T16:00:00Z"),
      distanciel: false,
      ...(remplaceSessionId === undefined ? {} : { remplaceSessionId }),
    },
  });

  it("allumé, REPORT de la 1re mission non observée : la mission reportée ne compte pas contre elle-même", async () => {
    h.etat.settings.set("formateurs.suivi_qualite", {
      actif: true,
      allumeLe: "2026-11-01T08:00:00Z",
    });
    h.etat.sessions = [session("s1", "2026-11-25", "2026-11-26")];
    const r = await controlerGardeMission("t-1", MAINTENANT, report("s1"));
    expect(r.refus).toEqual([]);
  });

  it("allumé, report d'une mission alors qu'une AUTRE n'est pas observée : refusé", async () => {
    h.etat.settings.set("formateurs.suivi_qualite", {
      actif: true,
      allumeLe: "2026-11-01T08:00:00Z",
    });
    h.etat.sessions = [
      session("s1", "2026-11-05", "2026-11-06"),
      session("s2", "2026-11-25", "2026-11-26"),
    ];
    const r = await controlerGardeMission("t-1", MAINTENANT, report("s2"));
    expect(r.refus).toContain(MANQUES_SUIVI_QUALITE.observation);
  });

  it("allumé, CRÉATION d'une session (sans session remplacée) : c'est bien une 2e mission", async () => {
    h.etat.settings.set("formateurs.suivi_qualite", {
      actif: true,
      allumeLe: "2026-11-01T08:00:00Z",
    });
    const r = await controlerGardeMission("t-1", MAINTENANT, report());
    expect(r.refus).toContain(MANQUES_SUIVI_QUALITE.observation);
  });

  it("allumé, acceptation de SA mission (sessionId + missionId) : jamais comptée contre elle-même", async () => {
    h.etat.settings.set("formateurs.suivi_qualite", {
      actif: true,
      allumeLe: "2026-11-01T08:00:00Z",
    });
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s1", missionId: "m1" });
    expect(r.refus).toEqual([]);
  });

  it("allumé, observation favorable : la 2e mission passe", async () => {
    h.etat.settings.set("formateurs.suivi_qualite", {
      actif: true,
      allumeLe: "2026-11-01T08:00:00Z",
    });
    h.etat.trainer = {
      ...h.etat.trainer!,
      grillesSuiviQualite: [
        {
          type: "observation",
          sessionId: "s1",
          favorable: true,
          satisfactionSaisie: null,
          createdAt: MAINTENANT,
        },
      ],
    };
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s2" });
    expect(r.refus).toEqual([]);
  });

  it("allumé, satisfaction < 3 : nouvelles missions suspendues", async () => {
    h.etat.settings.set("formateurs.suivi_qualite", {
      actif: true,
      allumeLe: "2026-11-01T08:00:00Z",
    });
    h.etat.sessions = [session("s1", "2026-11-05", "2026-11-06", [2, 3])];
    h.etat.trainer = {
      ...h.etat.trainer!,
      grillesSuiviQualite: [
        {
          type: "observation",
          sessionId: "s1",
          favorable: true,
          satisfactionSaisie: null,
          createdAt: MAINTENANT,
        },
      ],
    };
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s2" });
    expect(r.refus).toContain(MANQUES_SUIVI_QUALITE.suspension);
  });

  it("garde coupée aux portes : le suivi qualité ne refuse rien non plus", async () => {
    h.etat.settings.delete("formateurs.garde_mission_portes");
    h.etat.settings.set("formateurs.suivi_qualite", {
      actif: true,
      allumeLe: "2026-11-01T08:00:00Z",
    });
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s2" });
    expect(r).toEqual({ mode: "coupee", refus: [], avertissements: [] });
  });

  it("allumé, lecture des missions en échec : refus, jamais « tout va bien »", async () => {
    h.etat.settings.set("formateurs.suivi_qualite", {
      actif: true,
      allumeLe: "2026-11-01T08:00:00Z",
    });
    h.prisma.trainingSession.findMany.mockRejectedValueOnce(new Error("panne"));
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s2" });
    expect(r.refus).toContain(MANQUES_SUIVI_QUALITE.erreur);
  });

  it("ancien stock en « avertir » : le suivi qualité refuse quand même", async () => {
    h.etat.settings.set("formateurs.garde_mission", { valeur: "avertir" });
    h.etat.settings.set("formateurs.suivi_qualite", {
      actif: true,
      allumeLe: "2026-11-01T08:00:00Z",
    });
    h.etat.trainer = { ...h.etat.trainer!, activationValideeSource: "anterieure_au_controle" };
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s2" });
    expect(r.mode).toBe("avertir");
    expect(r.refus).toContain(MANQUES_SUIVI_QUALITE.observation);
  });
});
