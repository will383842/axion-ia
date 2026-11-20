/**
 * @vitest-environment node
 *
 * T-5 : snapshot du Score. Seules les réponses `source = score-ia-pme`
 * comptent (décision D-B de Williams, 20/11/2026).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Ligne = Record<string, unknown> & { id: string; source: string | null };

const { etat, upsertMock } = vi.hoisted(() => ({
  etat: { lignes: [] as Array<Record<string, unknown>> },
  upsertMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    barometerResponse: {
      // Simule fidèlement le filtre `where.source`, le curseur et `take`.
      findMany: vi.fn(
        async (args: {
          where?: { source?: string };
          take: number;
          cursor?: { id: string };
          skip?: number;
        }) => {
          let rows = etat.lignes as Ligne[];
          if (args.where?.source !== undefined)
            rows = rows.filter((r) => r.source === args.where!.source);
          rows = [...rows].sort((a, b) => a.id.localeCompare(b.id));
          if (args.cursor) {
            const i = rows.findIndex((r) => r.id === args.cursor!.id);
            rows = rows.slice(i + (args.skip ?? 0));
          }
          return rows.slice(0, args.take);
        },
      ),
    },
    barometerSnapshot: { upsert: upsertMock, findUnique: vi.fn() },
  },
}));

import { calculerSnapshotScore } from "../score-snapshot";
import { calculerScore } from "@/lib/score-ia-pme/formule";

let seq = 0;
function ligne(over: Partial<Record<string, unknown>> = {}): Ligne {
  seq += 1;
  return {
    id: `id-${String(seq).padStart(6, "0")}`,
    source: "score-ia-pme",
    companySize: "PME",
    sector: "industrie",
    maturityLevel: "poc",
    hasStrategy: "in_progress",
    useCases: ["automation"],
    tools: ["chatgpt"],
    teamTrained: "informal",
    timeSavedPerDay: "lt_30min",
    annualBudget: "k1_5",
    ...over,
  } as Ligne;
}
const lots = (n: number, over: Partial<Record<string, unknown>> = {}) =>
  Array.from({ length: n }, () => ligne(over));

async function snapshot() {
  upsertMock.mockClear();
  const p = await calculerSnapshotScore();
  return p;
}

describe("calculerSnapshotScore", () => {
  beforeEach(() => {
    seq = 0;
    etat.lignes = [];
  });

  it("segment de 29 absent, de 30 présent (taille et secteur)", async () => {
    etat.lignes = [
      ...lots(29, { companySize: "TPE", sector: "btp" }),
      ...lots(30, { companySize: "PME", sector: "industrie" }),
    ];
    const p = await snapshot();
    expect(p.parTaille.TPE).toBeUndefined();
    expect(p.parTaille.PME?.n).toBe(30);
    expect(p.parSecteur.btp).toBeUndefined();
    expect(p.parSecteur.industrie?.n).toBe(30);
    expect(p.global?.n).toBe(59);
  });

  it("global absent sous le seuil", async () => {
    etat.lignes = lots(29);
    expect((await snapshot()).global).toBeNull();
  });

  it("aucun effectif par tranche, aucune région, pourcentages entiers", async () => {
    etat.lignes = lots(40);
    const p = await snapshot();
    const txt = JSON.stringify(p);
    expect(txt).not.toMatch(/region/i);
    expect(txt).not.toMatch(/count/i);
    expect(p.global!.pctParTranche).toHaveLength(10);
    for (const v of p.global!.pctParTranche) expect(Number.isInteger(v)).toBe(true);
    expect(p.global!.pctParTranche.reduce((a, b) => a + b, 0)).toBe(100);
    expect(Object.keys(p.global!).sort()).toEqual(["n", "pctParTranche"]);
  });

  it("parité : la tranche vient de calculerScore (même code que le client)", async () => {
    const l = ligne();
    etat.lignes = [l, ...lots(29)];
    const p = await snapshot();
    const s = calculerScore({
      maturityLevel: l.maturityLevel as string,
      hasStrategy: l.hasStrategy as string,
      useCases: l.useCases as string[],
      teamTrained: l.teamTrained as string,
      timeSavedPerDay: l.timeSavedPerDay as string,
      annualBudget: l.annualBudget as string,
      tools: l.tools as string[],
    }).score;
    const t = Math.min(Math.floor(s / 10), 9);
    expect(p.global!.pctParTranche[t]).toBe(100);
  });

  it("D-B : une réponse d'une autre source ne change pas le snapshot", async () => {
    etat.lignes = lots(30);
    const avant = await snapshot();
    const autres = [
      ...lots(200, { source: null, maturityLevel: "scaled", hasStrategy: "formalized" }),
      ...lots(50, { source: "autre-canal" }),
      ...lots(10, { source: null, companySize: "TPE", sector: "btp" }),
    ];
    etat.lignes = [...etat.lignes, ...autres];
    const apres = await snapshot();
    const norm = (p: typeof avant) => ({ ...p, genereLe: "" });
    expect(norm(apres)).toEqual(norm(avant));
  });

  it("pagination par curseur : plus de 5 000 lignes toutes lues", async () => {
    etat.lignes = lots(5001);
    expect((await snapshot()).global!.n).toBe(5001);
  });

  it("écrit uniquement la clé score-ia-pme-v1", async () => {
    etat.lignes = lots(30);
    await snapshot();
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0]![0].where).toEqual({ key: "score-ia-pme-v1" });
  });

  it("secteur « autre » : jamais de comparaison par secteur, même au-dessus du seuil", async () => {
    etat.lignes = lots(40, { sector: "autre" });
    const p = await snapshot();
    expect(p.parSecteur.autre).toBeUndefined();
    expect(p.global?.n).toBe(40);
  });

  it("seuils : 30 pour la comparaison, jamais en dessous du plancher de 5", async () => {
    const { N_MIN_COMPARAISON, N_MIN_STATISTIQUE } = await import("@/lib/score-ia-pme/constantes");
    expect(N_MIN_COMPARAISON).toBe(30);
    expect(N_MIN_STATISTIQUE).toBe(5);
    etat.lignes = lots(5);
    expect((await snapshot()).global).toBeNull();
  });

  it("le plancher du Score est le MÊME que celui des segments de l'Observatoire (§5.2)", async () => {
    const { N_MIN_STATISTIQUE } = await import("@/lib/score-ia-pme/constantes");
    const { MIN_SEGMENT_N } = await import("../snapshot");
    expect(N_MIN_STATISTIQUE).toBe(MIN_SEGMENT_N);
  });
});
