/**
 * Qualiopi ind. 21 — les écritures de la console : éteint = refus, IDOR (session d'un
 * autre formateur = introuvable), grille vierge refusée, auteur relu en base (jamais le
 * formulaire), numéro croissant, et trace au journal dans la même transaction.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const etat = {
    allume: true,
    trainer: { statut: "sous_traitant" } as Record<string, unknown> | null,
    session: null as Record<string, unknown> | null,
    dejaSaisies: 0,
    auteur: { name: "Will Jullin" } as { name: string } | null,
  };
  const tx = {
    $queryRaw: vi.fn(async () => []),
    grilleSuiviFormateur: {
      count: vi.fn(async () => etat.dejaSaisies),
      create: vi.fn(async () => ({ id: "44444444-4444-4444-8444-444444444444" })),
    },
    decisionSuiviFormateur: {
      create: vi.fn(async () => ({ id: "55555555-5555-4555-8555-555555555555" })),
    },
    activityLog: { create: vi.fn(async () => ({})) },
  };
  const prisma = {
    setting: {
      findUnique: vi.fn(async () =>
        etat.allume
          ? { value: { actif: true, allumeLe: "2026-11-01T08:00:00Z" }, updatedAt: null }
          : null,
      ),
    },
    trainer: { findUnique: vi.fn(async () => etat.trainer) },
    trainingSession: {
      findFirst: vi.fn(async () => etat.session),
      findMany: vi.fn(async () => (etat.session ? [etat.session] : [])),
    },
    adminUser: { findUnique: vi.fn(async () => etat.auteur) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { etat, prisma, tx, config: new Map<string, unknown>() };
});
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
// Les seuils sont des RÉGLAGES : absents, le défaut du registre.
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async (k: string) => {
    if (h.config.has("__panne__")) throw new Error("base injoignable");
    const { QUALIOPI_CONFIG_REGISTRY } = await import("@/server/qualiopi/config/registry");
    return h.config.has(k)
      ? h.config.get(k)
      : QUALIOPI_CONFIG_REGISTRY[k as keyof typeof QUALIOPI_CONFIG_REGISTRY].default;
  }),
}));

import { GRILLES_SUIVI_QUALITE } from "../reglages";
import { enregistrerDecision, enregistrerGrille } from "../service";

const MAINTENANT = new Date("2026-11-20T10:00:00Z");
const T = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";
const U = "33333333-3333-4333-8333-333333333333";

const notes = (n: number) =>
  Object.fromEntries(GRILLES_SUIVI_QUALITE.evaluation_mission.criteres.map((c) => [c.code, n]));

const saisie = (over: Record<string, unknown> = {}) => ({
  type: "evaluation_mission" as const,
  trainerId: T,
  sessionId: S,
  notes: notes(4),
  conclusion: "Mission conforme, stagiaires engagés.",
  date: new Date("2026-11-19T00:00:00Z"),
  satisfaction: null,
  auteur: { userId: U },
  maintenant: MAINTENANT,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.config.clear();
  h.etat.allume = true;
  h.etat.trainer = {
    statut: "sous_traitant",
    habilitations: [],
    grillesSuiviQualite: [],
    decisionsSuiviQualite: [],
  };
  h.etat.session = {
    id: S,
    dateDebut: new Date("2026-11-05T08:00:00Z"),
    dateFin: new Date("2026-11-06T16:00:00Z"),
    statut: "realisee",
    enrollments: [],
  };
  h.etat.dejaSaisies = 0;
  h.etat.auteur = { name: "Will Jullin" };
});

describe("enregistrerGrille", () => {
  it("éteint : refusé, rien n'est écrit", async () => {
    h.etat.allume = false;
    expect(await enregistrerGrille(saisie())).toEqual({ ok: false, erreur: "eteint" });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("session qui n'est pas une mission de ce formateur : introuvable (IDOR)", async () => {
    h.etat.session = null;
    expect(await enregistrerGrille(saisie())).toEqual({ ok: false, erreur: "introuvable" });
    const where = (
      h.prisma.trainingSession.findFirst.mock.calls[0] as unknown as [
        { where: Record<string, unknown> },
      ]
    )[0].where;
    expect(where).toMatchObject({ id: S });
    expect(JSON.stringify(where)).toContain(T);
  });

  it("un salarié n'a pas de grille d'intervenant externe", async () => {
    h.etat.trainer = { statut: "salarie" };
    expect(await enregistrerGrille(saisie())).toEqual({ ok: false, erreur: "non_concerne" });
  });

  it("grille vierge : refusée", async () => {
    expect(await enregistrerGrille(saisie({ notes: {}, conclusion: " " }))).toEqual({
      ok: false,
      erreur: "vierge",
    });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("grille après mission avant la fin de la mission : trop tôt", async () => {
    expect(
      await enregistrerGrille(
        saisie({
          maintenant: new Date("2026-11-05T12:00:00Z"),
          date: new Date("2026-11-05T00:00:00Z"),
        }),
      ),
    ).toEqual({ ok: false, erreur: "trop_tot" });
  });

  it("réévaluation : jamais rattachée à une session", async () => {
    expect(await enregistrerGrille(saisie({ type: "reevaluation" }))).toEqual({
      ok: false,
      erreur: "introuvable",
    });
  });

  it("complète : écrite AJOUTÉE (numéro suivant), signée par l'auteur lu en base, journalisée", async () => {
    h.etat.dejaSaisies = 1;
    const r = await enregistrerGrille(saisie({ satisfaction: 4 }));
    expect(r).toEqual({ ok: true, id: "44444444-4444-4444-8444-444444444444", numero: 2 });
    const data = (
      h.tx.grilleSuiviFormateur.create.mock.calls[0] as unknown as [
        { data: Record<string, unknown> },
      ]
    )[0].data;
    expect(data).toMatchObject({
      trainerId: T,
      sessionId: S,
      type: "evaluation_mission",
      numero: 2,
      versionGrille: GRILLES_SUIVI_QUALITE.evaluation_mission.version,
      moyenneCentiemes: 400,
      satisfactionSaisie: 4,
      auteurId: U,
      auteurNom: "Will Jullin",
    });
    expect(h.tx.activityLog.create).toHaveBeenCalledTimes(1);
    const log = (
      h.tx.activityLog.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(log).toMatchObject({
      action: "qualiopi.formateur.suivi_qualite_grille",
      adminUserId: U,
      targetId: "44444444-4444-4444-8444-444444444444",
    });
  });

  it("moyenne 4 : favorable au défaut ; seuil réglé à 4,5 : écrite NON favorable ; illisible : le défaut", async () => {
    await enregistrerGrille(saisie());
    h.config.set("suivi_qualite_evaluation_moyenne_min", 4.5);
    await enregistrerGrille(saisie());
    h.config.set("suivi_qualite_evaluation_moyenne_min", "beaucoup");
    await enregistrerGrille(saisie());
    const favorables = (
      h.tx.grilleSuiviFormateur.create.mock.calls as unknown as Array<
        [{ data: { favorable: boolean } }]
      >
    ).map((c) => c[0].data.favorable);
    expect(favorables).toEqual([true, false, true]);
  });

  it("auteur introuvable en base : refusé (une grille non signée n'existe pas)", async () => {
    h.etat.auteur = null;
    expect(await enregistrerGrille(saisie())).toEqual({ ok: false, erreur: "auteur_inconnu" });
  });
});

describe("enregistrerDecision", () => {
  const decision = (over: Record<string, unknown> = {}) => ({
    trainerId: T,
    sessionId: S,
    type: "levee_suspension" as const,
    motif: "Entretien mené le 18/11, plan d'action convenu.",
    auteur: { userId: U },
    maintenant: MAINTENANT,
    ...over,
  });

  it("motif trop court : refusé", async () => {
    expect(await enregistrerDecision(decision({ motif: "ok" }))).toEqual({
      ok: false,
      erreur: "motif_invalide",
    });
  });

  it("motif de 15 caractères : refusé quand le minimum est réglé à 20", async () => {
    h.etat.session = {
      ...h.etat.session!,
      enrollments: [{ questionnaires: [{ noteGlobale: 2 }] }],
    };
    h.config.set("suivi_qualite_texte_min_caracteres", 20);
    expect(await enregistrerDecision(decision({ motif: "Quinze lettres." }))).toEqual({
      ok: false,
      erreur: "motif_invalide",
    });
  });

  it("satisfaction 2 : suspension réglée sous 1,5 → plus rien à lever (sans objet)", async () => {
    h.etat.session = {
      ...h.etat.session!,
      enrollments: [{ questionnaires: [{ noteGlobale: 2 }] }],
    };
    h.config.set("suivi_qualite_satisfaction_suspension_sous", 1.5);
    expect(await enregistrerDecision(decision())).toEqual({ ok: false, erreur: "sans_objet" });
  });

  it("lever une suspension qui n'existe pas : sans objet", async () => {
    expect(await enregistrerDecision(decision())).toEqual({ ok: false, erreur: "sans_objet" });
  });

  it("satisfaction < 3 : la reprise motivée est écrite et journalisée", async () => {
    h.etat.session = {
      ...h.etat.session!,
      enrollments: [{ questionnaires: [{ noteGlobale: 2 }] }],
    };
    expect(await enregistrerDecision(decision())).toEqual({
      ok: true,
      id: "55555555-5555-4555-8555-555555555555",
    });
    expect(h.tx.activityLog.create).toHaveBeenCalledTimes(1);
  });

  it("session d'un autre formateur : introuvable (IDOR)", async () => {
    h.etat.session = null;
    expect(await enregistrerDecision(decision())).toEqual({ ok: false, erreur: "introuvable" });
  });
});
