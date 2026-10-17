// @vitest-environment node

/**
 * Qualiopi ind. 21 — les seuils de l'évaluation des compétences sont des RÉGLAGES
 * (`/qualiopi/config`, clés `evaluation_competences_*`), comme ceux de l'ind. 27 :
 *   · défauts inchangés, exposés au registre avec la même valeur ;
 *   · une valeur réglée change le verdict de « habilité » ;
 *   · absente, illisible, hors bornes ou base en panne : le défaut, jamais plus permissif ;
 *   · la décision versée garde la copie des seuils RÉELLEMENT appliqués.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  config: new Map<string, unknown>(),
  panne: false,
  trainer: { statut: "sous_traitant" },
  formation: { id: "ffffffff-ffff-4fff-8fff-ffffffffffff" },
  lignes: [] as unknown[],
  create: vi.fn(),
  journal: vi.fn(),
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async (k: string) => {
    if (h.panne) throw new Error("base injoignable");
    const { QUALIOPI_CONFIG_REGISTRY } = await import("@/server/qualiopi/config/registry");
    return h.config.has(k)
      ? h.config.get(k)
      : QUALIOPI_CONFIG_REGISTRY[k as keyof typeof QUALIOPI_CONFIG_REGISTRY].default;
  }),
}));
vi.mock("@/lib/prisma", () => {
  const client = {
    trainer: { findUnique: vi.fn(async () => h.trainer) },
    formation: { findUnique: vi.fn(async () => h.formation) },
    evaluationCompetenceFormateur: { findMany: vi.fn(async () => h.lignes), create: h.create },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(client)),
  };
  return { prisma: client };
});
vi.mock("@/server/journal/journaliser", () => ({ journaliser: h.journal }));

import { QUALIOPI_CONFIG_REGISTRY } from "@/server/qualiopi/config/registry";

import { BLOCS_MISE_EN_SITUATION, CRITERES_ENTRETIEN } from "../configuration";
import { verserEvaluation } from "../ecriture";
import { REGLAGES_EVALUATION, reglagesEvaluation } from "../reglages";
import { lireReglagesEvaluation } from "../reglages-lecture";
import { seuilsEntretien, seuilsMiseEnSituation, validerDecision } from "../regles";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = { userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role: "admin" };
const notes = (c: ReadonlyArray<{ code: string }>, n: number) =>
  Object.fromEntries(c.map((x) => [x.code, n]));

beforeEach(() => {
  vi.clearAllMocks();
  h.config.clear();
  h.panne = false;
  h.lignes = [
    {
      id: "e1",
      nature: "entretien",
      formationId: null,
      notes: notes(CRITERES_ENTRETIEN, 3),
      decision: null,
      motif: null,
      dateSuivie: null,
      version: 1,
      createdAt: new Date("2026-10-10T10:00:00Z"),
    },
    {
      id: "m1",
      nature: "mise_en_situation",
      formationId: null,
      notes: notes(BLOCS_MISE_EN_SITUATION, 3),
      decision: null,
      motif: null,
      dateSuivie: null,
      version: 1,
      createdAt: new Date("2026-10-11T10:00:00Z"),
    },
  ];
  h.create.mockResolvedValue({ id: "nouvelle" });
  h.journal.mockResolvedValue(true);
});

describe("défauts et registre", () => {
  it("les défauts n'ont pas bougé (à valider par Will)", () => {
    expect(REGLAGES_EVALUATION).toEqual({
      entretienMoyenneMin: 3.5,
      entretienNoteCritereMin: 2,
      miseEnSituationNoteBlocMin: 3,
    });
  });

  it("le registre expose chaque seuil avec le défaut pour valeur", () => {
    expect(QUALIOPI_CONFIG_REGISTRY.evaluation_competences_entretien_moyenne_min.default).toBe(3.5);
    expect(QUALIOPI_CONFIG_REGISTRY.evaluation_competences_entretien_note_critere_min.default).toBe(
      2,
    );
    expect(
      QUALIOPI_CONFIG_REGISTRY.evaluation_competences_mise_en_situation_note_bloc_min.default,
    ).toBe(3);
  });
});

describe("reglagesEvaluation — bornes", () => {
  it("illisible, hors bornes ou hors pas : le défaut", () => {
    expect(
      reglagesEvaluation({
        entretienMoyenneMin: "x",
        entretienNoteCritereMin: 0,
        miseEnSituationNoteBlocMin: 2.5,
      }),
    ).toEqual(REGLAGES_EVALUATION);
    expect(
      reglagesEvaluation({
        entretienMoyenneMin: 5.5,
        entretienNoteCritereMin: 6,
        miseEnSituationNoteBlocMin: Number.NaN,
      }),
    ).toEqual(REGLAGES_EVALUATION);
    expect(reglagesEvaluation({} as never)).toEqual(REGLAGES_EVALUATION);
    expect(
      reglagesEvaluation({
        entretienMoyenneMin: 3.333,
        entretienNoteCritereMin: 2,
        miseEnSituationNoteBlocMin: 3,
      }).entretienMoyenneMin,
    ).toBe(3.5);
  });

  it("dans les bornes : la valeur réglée", () => {
    expect(
      reglagesEvaluation({
        entretienMoyenneMin: 3.25,
        entretienNoteCritereMin: 3,
        miseEnSituationNoteBlocMin: 4,
      }),
    ).toEqual({
      entretienMoyenneMin: 3.25,
      entretienNoteCritereMin: 3,
      miseEnSituationNoteBlocMin: 4,
    });
  });
});

describe("lireReglagesEvaluation", () => {
  it("absents : les défauts", async () => {
    expect(await lireReglagesEvaluation()).toEqual(REGLAGES_EVALUATION);
  });

  it("réglés : les valeurs réglées", async () => {
    h.config.set("evaluation_competences_entretien_moyenne_min", 3);
    h.config.set("evaluation_competences_mise_en_situation_note_bloc_min", 2);
    expect(await lireReglagesEvaluation()).toEqual({
      entretienMoyenneMin: 3,
      entretienNoteCritereMin: 2,
      miseEnSituationNoteBlocMin: 2,
    });
  });

  it("illisible : le défaut de CE réglage ; base en panne : tous les défauts", async () => {
    h.config.set("evaluation_competences_entretien_moyenne_min", "trois");
    h.config.set("evaluation_competences_entretien_note_critere_min", 4);
    expect(await lireReglagesEvaluation()).toEqual({
      ...REGLAGES_EVALUATION,
      entretienNoteCritereMin: 4,
    });
    h.panne = true;
    expect(await lireReglagesEvaluation()).toEqual(REGLAGES_EVALUATION);
  });
});

describe("une valeur réglée change le verdict", () => {
  it("moyenne 3 : sous le défaut (3,5), atteinte avec un seuil réglé à 3", () => {
    const n = notes(CRITERES_ENTRETIEN, 3);
    expect(seuilsEntretien(n).atteint).toBe(false);
    expect(seuilsEntretien(n, { ...REGLAGES_EVALUATION, entretienMoyenneMin: 3 }).atteint).toBe(
      true,
    );
    const b = notes(BLOCS_MISE_EN_SITUATION, 3);
    expect(seuilsMiseEnSituation(b).atteint).toBe(true);
    expect(
      seuilsMiseEnSituation(b, { ...REGLAGES_EVALUATION, miseEnSituationNoteBlocMin: 4 }).atteint,
    ).toBe(false);
  });

  it("validerDecision « habilité » : refusé au défaut, accepté au seuil réglé", () => {
    const lignes = h.lignes as Parameters<typeof validerDecision>[0]["lignes"];
    const base = { decision: "habilite", motif: "Grilles revues", lignes };
    expect(validerDecision(base).ok).toBe(false);
    expect(
      validerDecision({ ...base, reglages: { ...REGLAGES_EVALUATION, entretienMoyenneMin: 3 } }).ok,
    ).toBe(true);
  });
});

describe("verserEvaluation — la décision lit le réglage et en garde la copie", () => {
  const demande = {
    nature: "decision_habilitation" as const,
    formationId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    decision: "habilite",
    motif: "Grilles revues ensemble",
  };

  it("sans réglage : « habilité » refusé sous le défaut", async () => {
    const r = await verserEvaluation({ trainerId: ID, session: ADMIN, demande });
    expect(r.ok).toBe(false);
    expect(h.create).not.toHaveBeenCalled();
  });

  it("seuil réglé à 3 : accepté, et `seuilsAppliques` porte 3", async () => {
    h.config.set("evaluation_competences_entretien_moyenne_min", 3);
    const r = await verserEvaluation({ trainerId: ID, session: ADMIN, demande });
    expect(r.ok).toBe(true);
    expect(h.create.mock.calls[0]![0].data.seuilsAppliques).toEqual({
      entretienMoyenneMin: 3,
      entretienNoteCritereMin: 2,
      miseEnSituationNoteBlocMin: 3,
    });
  });

  it("réglage illisible : le défaut s'applique (refus), jamais plus permissif", async () => {
    h.config.set("evaluation_competences_entretien_moyenne_min", "abc");
    const r = await verserEvaluation({ trainerId: ID, session: ADMIN, demande });
    expect(r.ok).toBe(false);
  });

  it("base des réglages en panne : le défaut s'applique (refus)", async () => {
    h.panne = true;
    const r = await verserEvaluation({ trainerId: ID, session: ADMIN, demande });
    expect(r.ok).toBe(false);
  });
});
