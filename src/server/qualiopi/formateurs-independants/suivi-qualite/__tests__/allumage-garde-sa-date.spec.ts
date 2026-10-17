/**
 * Qualiopi ind. 21 — relecture du 2026-10-17 (bloquant 1). La date d'allumage de
 * `formateurs.suivi_qualite` borne tout le suivi (« missions commencées le jour de
 * l'allumage ou après »). Couper puis rallumer l'interrupteur, ou l'enregistrer de
 * nouveau, ne doit JAMAIS la remettre à aujourd'hui : sinon les suspensions tombent sans
 * décision motivée, l'observation repart de zéro et une réévaluation échue regagne sa
 * grâce.
 *
 * Par le VRAI chemin d'écriture (`basculerFormateursSuiviQualiteAction` → `ecrireSignature`),
 * sur une table `settings` en mémoire dont `updatedAt` se remet à l'heure à chaque
 * écriture, comme le `@updatedAt` de Prisma.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));

const h = vi.hoisted(() => {
  type Ligne = { key: string; value: unknown; updatedAt: Date };
  const etat = {
    settings: new Map<string, Ligne>(),
    trainer: null as Record<string, unknown> | null,
    sessions: [] as Array<Record<string, unknown>>,
  };
  const ecrire = (key: string, value: unknown) => {
    // `@updatedAt` : chaque écriture remet la date à l'heure.
    etat.settings.set(key, { key, value, updatedAt: new Date() });
    return {};
  };
  const setting = {
    findMany: vi.fn(async () => [...etat.settings.values()]),
    findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
      const l = etat.settings.get(where.key);
      return l === undefined ? null : { value: l.value, updatedAt: l.updatedAt };
    }),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { key: string };
        create: { value: unknown };
        update: { value: unknown };
      }) => ecrire(where.key, etat.settings.has(where.key) ? update.value : create.value),
    ),
    update: vi.fn(async ({ where, data }: { where: { key: string }; data: { value: unknown } }) =>
      ecrire(where.key, data.value),
    ),
  };
  const tx = {
    setting,
    activityLog: { create: vi.fn(async () => ({})) },
    $executeRaw: vi.fn(async () => 1),
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    trainer: { findUnique: vi.fn(async () => etat.trainer) },
    trainingSession: { findMany: vi.fn(async () => etat.sessions) },
    documentGenere: { findFirst: vi.fn(async () => null) },
  };
  return { etat, prisma };
});
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
// Qualiopi ind. 21 — la décision d'habilitation de la formation en jeu a sa suite
// (`evaluation-competences/__tests__/`) ; ici, elle est réputée en vigueur.
vi.mock("../../evaluation-competences/garde-mission-q21-lecture", () => ({
  lireManqueHabilitationMission: async () => null,
}));
vi.mock("../../vigilance-seuil-lecture", () => ({ lireCumulHonorairesHtCents: async () => 0 }));
vi.mock("../../montant-mission-lecture", () => ({ lireEngagementHtCents: async () => 0 }));
vi.mock("../../contrat-cadre-en-vigueur", () => ({
  lireContratCadreSigne: async () => ({ version: 99, siret: "12345678900011" }),
}));

import { basculerFormateursSuiviQualiteAction } from "@/server/actions/qualiopi/formateurs-interrupteurs";

import { controlerGardeMission } from "../../garde-mission-portes";
import { lireAllumageSuiviQualite } from "../lecture";
import { MANQUES_SUIVI_QUALITE } from "../regles";

const CLE = "formateurs.suivi_qualite";
const INITIAL = { ok: true as const, message: "" };

async function basculer(actif: boolean, le: string) {
  vi.setSystemTime(new Date(le));
  const f = new FormData();
  f.set("actif", actif ? "1" : "0");
  const r = await basculerFormateursSuiviQualiteAction(INITIAL, f);
  expect(r.ok).toBe(true);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  auth.mockResolvedValue({ user: { id: "u-1", role: "super_admin" } });
  h.etat.settings.clear();
  h.etat.settings.set("formateurs.garde_mission_portes", {
    key: "formateurs.garde_mission_portes",
    value: { actif: true },
    updatedAt: new Date("2026-10-01T08:00:00Z"),
  });
  h.etat.trainer = {
    statut: "sous_traitant",
    actif: true,
    siret: "12345678900011",
    sousTraitantVerifieAt: new Date("2026-11-18T10:00:00Z"),
    sousTraitantNda: "84380000000",
    sousTraitantContratSigneAt: new Date("2026-09-01T10:00:00Z"),
    finCollaborationAt: null,
    activationValideeSource: "controle",
    documents: [],
    habilitations: [],
    // 1re mission observée et favorable : seule la satisfaction (2,5/5) la suspend.
    grillesSuiviQualite: [
      {
        type: "observation",
        sessionId: "s1",
        favorable: true,
        satisfactionSaisie: null,
        createdAt: new Date("2026-11-06T17:00:00Z"),
      },
    ],
    decisionsSuiviQualite: [],
  };
  h.etat.sessions = [
    {
      id: "s1",
      dateDebut: new Date("2026-11-05T08:00:00Z"),
      dateFin: new Date("2026-11-06T16:00:00Z"),
      statut: "realisee",
      enrollments: [2, 3].map((n) => ({ questionnaires: [{ noteGlobale: n }] })),
    },
  ];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formateurs.suivi_qualite — la date du PREMIER allumage ne bouge jamais", () => {
  it("allumer, couper, rallumer : la date reste celle du 1er allumage et la suspension tient", async () => {
    await basculer(true, "2026-11-01T08:00:00Z");
    await basculer(false, "2026-11-10T08:00:00Z");
    await basculer(true, "2026-11-15T08:00:00Z");

    vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
    expect(await lireAllumageSuiviQualite()).toBe("2026-11-01");
    const r = await controlerGardeMission("t-1", new Date(), { sessionId: "s2" });
    expect(r.refus).toContain(MANQUES_SUIVI_QUALITE.suspension);
  });

  it("coupé : la date du 1er allumage reste écrite dans la ligne, mais rien n'est lu", async () => {
    await basculer(true, "2026-11-01T08:00:00Z");
    await basculer(false, "2026-11-10T08:00:00Z");

    expect(h.etat.settings.get(CLE)?.value).toEqual({
      actif: false,
      premierAllumageLe: "2026-11-01T08:00:00.000Z",
    });
    vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
    expect(await lireAllumageSuiviQualite()).toBeNull();
    const r = await controlerGardeMission("t-1", new Date(), { sessionId: "s2" });
    expect(r.refus).toEqual([]);
  });

  it("réenregistrer un interrupteur déjà allumé garde la date", async () => {
    await basculer(true, "2026-11-01T08:00:00Z");
    await basculer(true, "2026-11-15T08:00:00Z");

    expect(await lireAllumageSuiviQualite()).toBe("2026-11-01");
  });

  it("valeur déjà écrite SANS date (`{ actif: true }`) : la date d'écriture d'avant est reprise, puis figée", async () => {
    h.etat.settings.set(CLE, {
      key: CLE,
      value: { actif: true },
      updatedAt: new Date("2026-11-01T08:00:00Z"),
    });
    await basculer(false, "2026-11-10T08:00:00Z");
    await basculer(true, "2026-11-15T08:00:00Z");

    expect(await lireAllumageSuiviQualite()).toBe("2026-11-01");
  });

  it("valeur au format `allumeLe` : reprise comme 1er allumage", async () => {
    h.etat.settings.set(CLE, {
      key: CLE,
      value: { actif: true, allumeLe: "2026-11-01T08:00:00Z" },
      updatedAt: new Date("2026-11-08T08:00:00Z"),
    });
    await basculer(true, "2026-11-15T08:00:00Z");

    expect(await lireAllumageSuiviQualite()).toBe("2026-11-01");
  });

  it("premier allumage, ligne absente : la date du jour", async () => {
    await basculer(true, "2026-11-15T08:00:00Z");

    expect(await lireAllumageSuiviQualite()).toBe("2026-11-15");
  });

  it("une date illisible n'est pas une date : elle ne fait pas remonter l'allumage", async () => {
    h.etat.settings.set(CLE, {
      key: CLE,
      value: { actif: false, premierAllumageLe: "n'importe quoi" },
      updatedAt: new Date("2026-10-01T08:00:00Z"),
    });
    await basculer(true, "2026-11-15T08:00:00Z");

    expect(await lireAllumageSuiviQualite()).toBe("2026-11-15");
  });
});
