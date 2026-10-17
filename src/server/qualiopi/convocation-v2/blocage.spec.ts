/**
 * Chantier QNC, L05 — ce qui retient la convocation : convention non signée,
 * adaptation non traitée. Le motif est dit, et journalisé une fois par changement.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const enrollmentFindUnique = vi.fn();
const enrollmentFindMany = vi.fn();
const activityFindFirst = vi.fn();
const activityCreate = vi.fn(async (_a: unknown) => ({}));
const lireEtat = vi.fn(async () => "actif");
const lireCircuit = vi.fn(async (_i: unknown) => new Map());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: {
      findUnique: (a: unknown) => enrollmentFindUnique(a),
      findMany: (a: unknown) => enrollmentFindMany(a),
    },
    activityLog: {
      findFirst: (a: unknown) => activityFindFirst(a),
      create: (a: unknown) => activityCreate(a),
    },
  },
}));
vi.mock("@/server/qualiopi/adaptation/colonne-declaration", () => ({
  colonneDeclarationDisponible: async () => false,
}));
vi.mock("@/server/qualiopi/adaptation/journal-consignation", () => ({
  lireCircuitAdaptation: (i: unknown) => lireCircuit(i),
}));
vi.mock("./interrupteur", async () => ({
  ...(await vi.importActual<object>("./interrupteur")),
  etatConvocationV2: () => lireEtat(),
}));

import {
  ACTION_JOURNAL_CONVOCATION_RETENUE,
  evaluerBlocageConvocation,
  journaliserRetenue,
  lireRetenuesConvocationSession,
} from "./blocage";

const conventionSignee = {
  type: "convention",
  statutSignature: "signee",
  annuleeAt: null,
  clientId: null,
  traineeId: null,
};

function inscription(over: {
  documents?: unknown[];
  situationHandicap?: boolean;
  adaptationsRealisees?: string | null;
  estTestInterne?: boolean;
  sessionEstTest?: boolean;
}) {
  return {
    id: "e1",
    traineeId: "t1",
    clientId: null,
    estTestInterne: over.estTestInterne ?? false,
    adaptationsRealisees: over.adaptationsRealisees ?? null,
    trainee: { situationHandicap: over.situationHandicap ?? false },
    questionnaires: [],
    session: {
      dateFin: new Date("2026-12-10T15:00:00Z"),
      estTestInterne: over.sessionEstTest ?? false,
      documents: over.documents ?? [conventionSignee],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  lireEtat.mockResolvedValue("actif");
  lireCircuit.mockResolvedValue(new Map());
});

describe("evaluerBlocageConvocation", () => {
  it("BLOQUÉ sans convention signée (aucune pièce)", async () => {
    enrollmentFindUnique.mockResolvedValue(inscription({ documents: [] }));
    const r = await evaluerBlocageConvocation("e1");
    expect(r?.decision).toEqual({ autorisee: false, motifs: ["convention_non_signee"] });
  });

  it("BLOQUÉ avec une convention seulement partiellement signée", async () => {
    enrollmentFindUnique.mockResolvedValue(
      inscription({ documents: [{ ...conventionSignee, statutSignature: "partielle" }] }),
    );
    expect((await evaluerBlocageConvocation("e1"))?.decision.motifs).toEqual([
      "convention_non_signee",
    ]);
  });

  it("BLOQUÉ avec une adaptation déclarée et non traitée", async () => {
    enrollmentFindUnique.mockResolvedValue(inscription({ situationHandicap: true }));
    const r = await evaluerBlocageConvocation("e1");
    expect(r?.decision).toEqual({ autorisee: false, motifs: ["adaptation_non_traitee"] });
  });

  it("libéré quand la réponse de l'organisme est consignée", async () => {
    enrollmentFindUnique.mockResolvedValue(
      inscription({
        situationHandicap: true,
        adaptationsRealisees: "Échange avec le bénéficiaire : aucune adaptation nécessaire.",
      }),
    );
    expect((await evaluerBlocageConvocation("e1"))?.decision.autorisee).toBe(true);
  });

  it("une réponse ANTÉRIEURE à la dernière déclaration ne couvre pas le besoin", async () => {
    enrollmentFindUnique.mockResolvedValue(
      inscription({ situationHandicap: true, adaptationsRealisees: "Salle de plain-pied." }),
    );
    lireCircuit.mockResolvedValue(
      new Map([
        [
          "e1",
          {
            consigneeDepuis: new Date("2026-11-01T10:00:00Z"),
            derniereConsignationLe: new Date("2026-11-01T10:00:00Z"),
            derniereDeclarationLe: new Date("2026-11-05T10:00:00Z"),
          },
        ],
      ]),
    );
    expect((await evaluerBlocageConvocation("e1"))?.decision.motifs).toEqual([
      "adaptation_non_traitee",
    ]);
  });

  it("autorisé : convention signée, aucun besoin déclaré", async () => {
    enrollmentFindUnique.mockResolvedValue(inscription({}));
    expect((await evaluerBlocageConvocation("e1"))?.decision).toEqual({
      autorisee: true,
      motifs: [],
    });
    expect(lireCircuit).not.toHaveBeenCalled();
  });

  it("signale le banc d'essai (inscription ou session)", async () => {
    enrollmentFindUnique.mockResolvedValue(inscription({ sessionEstTest: true }));
    expect((await evaluerBlocageConvocation("e1"))?.essai).toBe(true);
  });

  it("inscription introuvable : null", async () => {
    enrollmentFindUnique.mockResolvedValue(null);
    expect(await evaluerBlocageConvocation("x")).toBeNull();
  });
});

describe("journaliserRetenue", () => {
  it("écrit le motif la première fois, avec le drapeau d'essai", async () => {
    activityFindFirst.mockResolvedValue(null);
    await journaliserRetenue("e1", ["convention_non_signee"], true);
    expect(activityCreate).toHaveBeenCalledWith({
      data: {
        action: ACTION_JOURNAL_CONVOCATION_RETENUE,
        targetType: "Enrollment",
        targetId: "e1",
        changes: { motifs: ["convention_non_signee"], essai: true },
      },
    });
  });

  it("n'écrit pas deux fois le même motif (le cron passe chaque jour)", async () => {
    activityFindFirst.mockResolvedValue({
      action: ACTION_JOURNAL_CONVOCATION_RETENUE,
      changes: { motifs: ["convention_non_signee"] },
    });
    await journaliserRetenue("e1", ["convention_non_signee"], false);
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("réécrit quand l'ensemble des motifs change", async () => {
    activityFindFirst.mockResolvedValue({
      action: ACTION_JOURNAL_CONVOCATION_RETENUE,
      changes: { motifs: ["convention_non_signee"] },
    });
    await journaliserRetenue("e1", ["adaptation_non_traitee"], false);
    expect(activityCreate).toHaveBeenCalledTimes(1);
  });

  it("ne lève jamais : un journal en panne ne libère pas la convocation", async () => {
    activityFindFirst.mockRejectedValue(new Error("down"));
    await expect(
      journaliserRetenue("e1", ["convention_non_signee"], false),
    ).resolves.toBeUndefined();
  });
});

describe("lireRetenuesConvocationSession (la console)", () => {
  it("éteint : rien n'est lu, rien n'est affiché", async () => {
    lireEtat.mockResolvedValue("eteint");
    expect(await lireRetenuesConvocationSession("s1")).toEqual({
      actif: false,
      parInscription: {},
    });
    expect(enrollmentFindMany).not.toHaveBeenCalled();
  });

  it("allumé : le motif en clair, par inscription retenue", async () => {
    enrollmentFindMany.mockResolvedValue([
      { id: "e1", estTestInterne: false, session: { estTestInterne: false } },
    ]);
    enrollmentFindUnique.mockResolvedValue(inscription({ documents: [] }));
    const r = await lireRetenuesConvocationSession("s1");
    expect(r.actif).toBe(true);
    expect(r.parInscription["e1"]?.[0]).toMatch(/convention n'est pas entièrement signée/);
  });

  it("essai : les inscriptions hors banc d'essai ne sont ni évaluées ni affichées", async () => {
    lireEtat.mockResolvedValue("essai");
    enrollmentFindMany.mockResolvedValue([
      { id: "reel", estTestInterne: false, session: { estTestInterne: false } },
    ]);
    const r = await lireRetenuesConvocationSession("s1");
    expect(r).toEqual({ actif: true, parInscription: {} });
    expect(enrollmentFindUnique).not.toHaveBeenCalled();
  });

  it("une panne de lecture ne fait pas tomber l'écran", async () => {
    enrollmentFindMany.mockRejectedValue(new Error("down"));
    expect(await lireRetenuesConvocationSession("s1")).toEqual({
      actif: false,
      parInscription: {},
    });
  });
});
