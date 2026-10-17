/**
 * Qualiopi ind. 21 — les alertes internes du suivi qualité des intervenants : éteintes
 * par défaut, levées aux bons délais, une par session en co-animation, et chaque nouvelle
 * alerte tracée au journal (une seule fois).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const etat = {
    allume: true,
    formateurs: [] as Array<Record<string, unknown>>,
    faits: new Map<string, Record<string, unknown>>(),
    sessions: new Map<string, Array<Record<string, unknown>>>(),
    ouvertes: [] as Array<{ code: string; cibleId: string | null }>,
    config: new Map<string, unknown>(),
    configEnPanne: false,
  };
  const prisma = {
    setting: {
      findUnique: vi.fn(async () =>
        etat.allume
          ? { value: { actif: true, allumeLe: "2026-11-01T08:00:00Z" }, updatedAt: null }
          : null,
      ),
    },
    trainer: {
      findMany: vi.fn(async () => etat.formateurs),
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) => etat.faits.get(where.id) ?? null,
      ),
    },
    trainingSession: {
      findMany: vi.fn(
        async ({ where }: { where: { OR: Array<{ formateurPrincipalId?: string }> } }) =>
          etat.sessions.get(where.OR[0]!.formateurPrincipalId!) ?? [],
      ),
    },
    alerteSysteme: { findMany: vi.fn(async () => etat.ouvertes) },
    activityLog: { create: vi.fn(async () => ({})) },
  };
  return { etat, prisma };
});
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
// Les seuils sont des RÉGLAGES : absents, le défaut du registre.
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async (k: string) => {
    if (h.etat.configEnPanne) throw new Error("base injoignable");
    const { QUALIOPI_CONFIG_REGISTRY } = await import("@/server/qualiopi/config/registry");
    return h.etat.config.has(k)
      ? h.etat.config.get(k)
      : QUALIOPI_CONFIG_REGISTRY[k as keyof typeof QUALIOPI_CONFIG_REGISTRY].default;
  }),
}));

import { regleSuiviQualiteFormateurs } from "./regle-suivi-qualite-formateurs";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const S1 = "33333333-3333-4333-8333-333333333333";

const session = (id: string, debut: string, fin: string, notes: number[] = []) => ({
  id,
  dateDebut: new Date(`${debut}T08:00:00Z`),
  dateFin: new Date(`${fin}T16:00:00Z`),
  statut: "realisee",
  enrollments: notes.map((n) => ({ questionnaires: [{ noteGlobale: n }] })),
});

const faits = (over: Record<string, unknown> = {}) => ({
  statut: "sous_traitant",
  habilitations: [],
  grillesSuiviQualite: [],
  decisionsSuiviQualite: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.etat.allume = true;
  h.etat.formateurs = [
    { id: A, nom: "Durand", prenom: "Alex", documents: [] },
    { id: B, nom: "Martin", prenom: "Sam", documents: [] },
  ];
  h.etat.faits = new Map([
    [A, faits()],
    [B, faits()],
  ]);
  h.etat.sessions = new Map([
    [A, [session(S1, "2026-11-05", "2026-11-06")]],
    [B, [session(S1, "2026-11-05", "2026-11-06")]],
  ]);
  h.etat.ouvertes = [];
  h.etat.config.clear();
  h.etat.configEnPanne = false;
});

const codes = (xs: Array<{ code: string }>) => xs.map((x) => x.code).sort();

describe("alertes du suivi qualité", () => {
  it("éteint : aucune alerte, rien n'est lu", async () => {
    h.etat.allume = false;
    expect(await regleSuiviQualiteFormateurs(new Date("2026-11-20T10:00:00Z"))).toEqual([]);
    expect(h.prisma.trainer.findMany).not.toHaveBeenCalled();
  });

  it("J+2 : observation manquante seulement ; J+3 : relance de la grille ; J+7 : alerte", async () => {
    const j2 = await regleSuiviQualiteFormateurs(new Date("2026-11-08T10:00:00Z"));
    expect(codes(j2)).toEqual(["fi_observation_manquante", "fi_observation_manquante"]);
    const j3 = await regleSuiviQualiteFormateurs(new Date("2026-11-09T10:00:00Z"));
    expect(j3.filter((c) => c.code === "fi_evaluation_mission_a_saisir")).toHaveLength(1);
    const j7 = await regleSuiviQualiteFormateurs(new Date("2026-11-13T10:00:00Z"));
    const manquante = j7.filter((c) => c.code === "fi_evaluation_mission_manquante");
    // Co-animation : UNE alerte sur la session, qui nomme les deux formateurs.
    expect(manquante).toHaveLength(1);
    expect(manquante[0]).toMatchObject({ cibleType: "TrainingSession", cibleId: S1 });
    expect(manquante[0]!.message).toContain("Alex Durand");
    expect(manquante[0]!.message).toContain("Sam Martin");
    expect(j7.some((c) => c.code === "fi_evaluation_mission_a_saisir")).toBe(false);
  });

  it("grille saisie et observation favorable : plus rien", async () => {
    const g = (type: string) => ({
      type,
      sessionId: S1,
      favorable: true,
      satisfactionSaisie: null,
      createdAt: new Date("2026-11-07T10:00:00Z"),
    });
    h.etat.faits.set(
      A,
      faits({ grillesSuiviQualite: [g("observation"), g("evaluation_mission")] }),
    );
    h.etat.formateurs = [h.etat.formateurs[0]!];
    expect(await regleSuiviQualiteFormateurs(new Date("2026-11-20T10:00:00Z"))).toEqual([]);
  });

  it("satisfaction < 4 : entretien à prévoir ; < 3 : missions suspendues", async () => {
    h.etat.formateurs = [h.etat.formateurs[0]!];
    h.etat.sessions.set(A, [session(S1, "2026-11-05", "2026-11-06", [3, 4])]);
    const r = await regleSuiviQualiteFormateurs(new Date("2026-11-08T10:00:00Z"));
    expect(codes(r)).toContain("fi_entretien_a_prevoir");
    h.etat.sessions.set(A, [session(S1, "2026-11-05", "2026-11-06", [2, 3])]);
    const s = await regleSuiviQualiteFormateurs(new Date("2026-11-08T10:00:00Z"));
    expect(codes(s)).toContain("fi_missions_suspendues");
    expect(codes(s)).not.toContain("fi_entretien_a_prevoir");
  });

  it("réévaluation : rappel à J-30, puis échue", async () => {
    h.etat.formateurs = [h.etat.formateurs[0]!];
    h.etat.sessions.set(A, []);
    h.etat.faits.set(
      A,
      faits({ habilitations: [{ habiliteAt: new Date("2025-12-10T09:00:00Z") }] }),
    );
    expect(codes(await regleSuiviQualiteFormateurs(new Date("2026-11-20T10:00:00Z")))).toEqual([
      "fi_reevaluation_a_prevoir",
    ]);
    expect(codes(await regleSuiviQualiteFormateurs(new Date("2026-12-11T10:00:00Z")))).toEqual([
      "fi_reevaluation_echue",
    ]);
  });

  it("CV déclaré de plus de 24 mois : alerte", async () => {
    h.etat.formateurs = [
      {
        id: A,
        nom: "Durand",
        prenom: "Alex",
        documents: [{ dateCvDeclaree: new Date("2024-01-01T00:00:00Z"), createdAt: new Date() }],
      },
    ];
    h.etat.sessions.set(A, []);
    expect(codes(await regleSuiviQualiteFormateurs(new Date("2026-11-20T10:00:00Z")))).toEqual([
      "fi_cv_declare_perime",
    ]);
  });

  describe("seuils RÉGLÉS en console", () => {
    const cvDe = (iso: string) => [
      {
        id: A,
        nom: "Durand",
        prenom: "Alex",
        documents: [{ dateCvDeclaree: new Date(iso), createdAt: new Date() }],
      },
    ];

    it("CV de 20 mois : rien au défaut (24), alerte avec un réglage à 18 mois — et le titre le dit", async () => {
      h.etat.formateurs = cvDe("2025-03-01T00:00:00Z");
      h.etat.sessions.set(A, []);
      const maintenant = new Date("2026-11-20T10:00:00Z");
      expect(await regleSuiviQualiteFormateurs(maintenant)).toEqual([]);
      h.etat.config.set("suivi_qualite_cv_declare_max_mois", 18);
      const r = await regleSuiviQualiteFormateurs(maintenant);
      expect(codes(r)).toEqual(["fi_cv_declare_perime"]);
      expect(r[0]!.titre).toContain("18 mois");
    });

    it("réglage illisible ou hors bornes, base en panne : le défaut (24 mois)", async () => {
      h.etat.formateurs = cvDe("2025-03-01T00:00:00Z");
      h.etat.sessions.set(A, []);
      const maintenant = new Date("2026-11-20T10:00:00Z");
      h.etat.config.set("suivi_qualite_cv_declare_max_mois", "dix-huit");
      expect(await regleSuiviQualiteFormateurs(maintenant)).toEqual([]);
      h.etat.config.set("suivi_qualite_cv_declare_max_mois", 0);
      expect(await regleSuiviQualiteFormateurs(maintenant)).toEqual([]);
      h.etat.config.set("suivi_qualite_cv_declare_max_mois", 18);
      h.etat.configEnPanne = true;
      expect(await regleSuiviQualiteFormateurs(maintenant)).toEqual([]);
    });

    it("relance réglée à J+1 : la grille est relancée dès J+1", async () => {
      h.etat.formateurs = [h.etat.formateurs[0]!];
      const j1 = new Date("2026-11-07T10:00:00Z");
      expect(codes(await regleSuiviQualiteFormateurs(j1))).not.toContain(
        "fi_evaluation_mission_a_saisir",
      );
      h.etat.config.set("suivi_qualite_evaluation_relance_jours", 1);
      expect(codes(await regleSuiviQualiteFormateurs(j1))).toContain(
        "fi_evaluation_mission_a_saisir",
      );
    });
  });

  it("chaque NOUVELLE alerte est tracée au journal, une déjà ouverte ne l'est pas deux fois", async () => {
    h.etat.ouvertes = [{ code: "fi_observation_manquante", cibleId: A }];
    await regleSuiviQualiteFormateurs(new Date("2026-11-08T10:00:00Z"));
    expect(h.prisma.activityLog.create).toHaveBeenCalledTimes(1);
    const data = (
      h.prisma.activityLog.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(data).toMatchObject({
      action: "qualiopi.formateur.suivi_qualite_alerte",
      targetType: "Trainer",
      targetId: B,
    });
  });
});
