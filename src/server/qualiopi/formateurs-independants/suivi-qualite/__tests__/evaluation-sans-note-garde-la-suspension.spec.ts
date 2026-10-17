/**
 * Qualiopi ind. 21 — relecture du 2026-10-17 : la DERNIÈRE note de satisfaction SAISIE fait
 * foi. Une 2e grille `evaluation_mission` sans note (null) n'efface pas la mesure de la 1re,
 * donc la suspension (satisfaction < 3) ne tombe pas sans décision motivée.
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

describe("suivi qualité × grille d'évaluation sans note", () => {
  const grille = (type: string, sat: number | null, createdAt: string) => ({
    type,
    sessionId: "s1",
    favorable: true,
    satisfactionSaisie: sat,
    createdAt: new Date(createdAt),
  });

  it("une 2e grille evaluation_mission SANS note n'efface pas la note de la 1re : suspension maintenue", async () => {
    h.etat.settings.set("formateurs.suivi_qualite", {
      actif: true,
      allumeLe: "2026-11-01T08:00:00Z",
    });
    // Aucun questionnaire à chaud : seule la note saisie en grille mesure la mission.
    h.etat.sessions = [session("s1", "2026-11-05", "2026-11-06")];
    h.etat.trainer = {
      ...h.etat.trainer!,
      grillesSuiviQualite: [
        grille("observation", null, "2026-11-07T08:00:00Z"),
        grille("evaluation_mission", 2, "2026-11-08T08:00:00Z"),
        grille("evaluation_mission", null, "2026-11-09T08:00:00Z"),
      ],
    };
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s2" });
    expect(r.refus).toContain(MANQUES_SUIVI_QUALITE.suspension);
  });

  it("une 2e grille AVEC note fait foi (la dernière note saisie remplace la précédente)", async () => {
    h.etat.settings.set("formateurs.suivi_qualite", {
      actif: true,
      allumeLe: "2026-11-01T08:00:00Z",
    });
    h.etat.sessions = [session("s1", "2026-11-05", "2026-11-06")];
    h.etat.trainer = {
      ...h.etat.trainer!,
      grillesSuiviQualite: [
        grille("observation", null, "2026-11-07T08:00:00Z"),
        grille("evaluation_mission", 2, "2026-11-08T08:00:00Z"),
        grille("evaluation_mission", 4, "2026-11-09T08:00:00Z"),
      ],
    };
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s2" });
    expect(r.refus).not.toContain(MANQUES_SUIVI_QUALITE.suspension);
  });
});
