/**
 * QNC L12 (O13) — l'alerte d'un voyant naît d'une trace ABSENTE, jamais d'un
 * lot non évalué, et jamais d'un essai.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ sessions: vi.fn(), traces: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { trainingSession: { findMany: h.sessions } } }));
vi.mock("../parcours/charger-traces-voyants", () => ({ chargerTracesVoyants: h.traces }));

import { ALERTE_CATALOGUE } from "./catalogue";
import { CODE_VOYANT, regleVoyantsSansTrace } from "./regle-voyants-sans-trace";

const NOW = new Date("2026-12-01T07:00:00Z");
const session = (id: string, estTestInterne = false) => ({
  id,
  numero: `AXI-SESS-${id}`,
  dateDebut: new Date("2026-11-10T08:00:00Z"),
  dateFin: new Date("2026-11-12T17:00:00Z"),
  estTestInterne,
});
const lue = <T extends object>(t: T) => ({ lecture: "lue" as const, ...t });

beforeEach(() => {
  h.sessions.mockReset().mockResolvedValue([session("s1")]);
  h.traces.mockReset();
});

describe("regleVoyantsSansTrace", () => {
  it("chaque code existe au catalogue, avec un guichet", () => {
    for (const { code } of Object.values(CODE_VOYANT)) {
      expect(ALERTE_CATALOGUE[code]?.guichet).toBeTruthy();
    }
  });

  it("alerte quand la trace manque : convocation partie pour 1 stagiaire sur 2", async () => {
    h.traces.mockResolvedValue(
      new Map([
        [
          "s1",
          {
            i9: lue({
              stagiairesActifs: 2,
              convoques: 1,
              derniereConvocation: NOW,
              piecesRemises: 0,
            }),
          },
        ],
      ]),
    );
    const r = await regleVoyantsSansTrace(NOW);
    expect(r.map((a) => a.code)).toEqual(["voyant_ind_09_sans_trace"]);
    expect(r[0]).toMatchObject({ cibleType: "TrainingSession", cibleId: "s1" });
  });

  it("se tait quand la trace existe", async () => {
    h.traces.mockResolvedValue(
      new Map([
        [
          "s1",
          {
            i9: lue({
              stagiairesActifs: 2,
              convoques: 2,
              derniereConvocation: NOW,
              piecesRemises: 2,
            }),
          },
        ],
      ]),
    );
    expect(await regleVoyantsSansTrace(NOW)).toEqual([]);
  });

  it("se tait quand le lot n'écrit rien (non évalué) : on ne sait pas, on n'accuse pas", async () => {
    h.traces.mockResolvedValue(
      new Map([["s1", { i4: { lecture: "lot_eteint" }, i12: { lecture: "lot_absent" } }]]),
    );
    expect(await regleVoyantsSansTrace(NOW)).toEqual([]);
  });

  it("essai exclu : la requête filtre les sessions d'essai et une session d'essai rendue est sans objet", async () => {
    h.sessions.mockResolvedValue([session("e1", true)]);
    h.traces.mockResolvedValue(
      new Map([
        [
          "e1",
          {
            i9: lue({
              stagiairesActifs: 2,
              convoques: 0,
              derniereConvocation: null,
              piecesRemises: 0,
            }),
          },
        ],
      ]),
    );
    expect(await regleVoyantsSansTrace(NOW)).toEqual([]);
    expect(h.sessions.mock.calls[0]![0].where).toMatchObject({ estTestInterne: false });
  });

  it("une session sans entrée de trace (essai écarté par le chargeur) ne produit rien", async () => {
    h.traces.mockResolvedValue(new Map());
    expect(await regleVoyantsSansTrace(NOW)).toEqual([]);
  });

  it("un voyant d'organisme (23) n'est émis qu'une fois, sans cible de session", async () => {
    h.sessions.mockResolvedValue([session("s1"), session("s2")]);
    const t = { i23: lue({ derniereDecisionLe: null }) };
    h.traces.mockResolvedValue(
      new Map([
        ["s1", t],
        ["s2", t],
      ]),
    );
    const r = await regleVoyantsSansTrace(NOW);
    expect(r).toHaveLength(1);
    expect(r[0]!.cibleId).toBeUndefined();
  });
});
