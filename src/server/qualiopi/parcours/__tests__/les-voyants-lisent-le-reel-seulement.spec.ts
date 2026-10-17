/**
 * QNC L12 — le chargeur ne lit que du RÉEL, et un lot absent ne verdit jamais.
 * (Les prédicats sont couverts par `les-voyants-exigent-une-trace-reelle.spec.ts`.)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ sessions: vi.fn(), enrollments: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: h.sessions },
    enrollment: { findMany: h.enrollments },
    remiseRetour: { findMany: vi.fn().mockResolvedValue([]) },
    activityLog: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    setting: { findUnique: vi.fn().mockResolvedValue(null) },
    questionnaireCadrage: { findMany: vi.fn().mockResolvedValue([]) },
    moyenPedagogique: { count: vi.fn().mockResolvedValue(0) },
    trainerHabilitation: { findFirst: vi.fn().mockResolvedValue(null) },
    sessionFormateur: { findMany: vi.fn().mockResolvedValue([]) },
    trainer: { findMany: vi.fn().mockResolvedValue([]) },
    verificationRegistreSousTraitance: { findMany: vi.fn().mockResolvedValue([]) },
    revueDirection: { count: vi.fn().mockResolvedValue(0) },
    partenariat: { count: vi.fn().mockResolvedValue(0) },
    $queryRaw: vi.fn().mockResolvedValue([{ existe: false }]),
  },
}));
vi.mock("../../config/site-settings", () => ({ getQualiopiConfig: async () => "" }));

import { chargerTracesVoyants } from "../charger-traces-voyants";
import { construireVoyants } from "../voyants-indicateurs";

const NOW = new Date("2026-12-01T07:00:00Z");

beforeEach(() => {
  h.sessions.mockReset().mockResolvedValue([]);
  h.enrollments.mockReset().mockResolvedValue([]);
});

describe("chargerTracesVoyants", () => {
  it("n'interroge que les sessions réelles (essai exclu à la requête)", async () => {
    await chargerTracesVoyants(["e1"], NOW);
    expect(h.sessions.mock.calls[0]![0].where).toMatchObject({ estTestInterne: false });
  });

  it("une session d'essai n'a aucune entrée de trace : rien n'est lu pour elle", async () => {
    expect((await chargerTracesVoyants(["e1"], NOW)).size).toBe(0);
    expect(h.enrollments).not.toHaveBeenCalled();
  });

  it("les inscriptions lues excluent l'essai et les sortis", async () => {
    h.sessions.mockResolvedValue([
      {
        id: "s1",
        formationId: "f",
        modalite: "presentiel",
        dateDebut: NOW,
        dateFin: NOW,
        formateurPrincipalId: null,
        projetId: null,
        estTestInterne: false,
      },
    ]);
    await chargerTracesVoyants(["s1"], NOW);
    const where = h.enrollments.mock.calls[0]![0].where;
    expect(where).toMatchObject({ estTestInterne: false, session: { estTestInterne: false } });
    expect(where.statut).toEqual({ notIn: ["abandon", "exclu"] });
  });

  it("L04 (temps 2) et L09 (étapes de réclamation) ne sont pas sur main : jamais verts", async () => {
    h.sessions.mockResolvedValue([
      {
        id: "s1",
        formationId: "f",
        modalite: "presentiel",
        dateDebut: new Date("2026-11-10T08:00:00Z"),
        dateFin: new Date("2026-11-12T17:00:00Z"),
        formateurPrincipalId: null,
        projetId: null,
        estTestInterne: false,
      },
    ]);
    const t = (await chargerTracesVoyants(["s1"], NOW)).get("s1")!;
    expect(t.i6).toEqual({ lecture: "lot_absent" });
    expect(t.i31).toEqual({ lecture: "lot_absent" });
    const vs = construireVoyants(t, {
      dateDebut: NOW,
      dateFin: NOW,
      estTestInterne: false,
      maintenant: NOW,
    });
    expect(vs.find((v) => v.indicateur === 6)!.etat).toBe("non_evalue");
    expect(vs.find((v) => v.indicateur === 31)!.etat).toBe("non_evalue");
  });

  it("lots éteints (interrupteur absent) : recueil et moyens « non évalués », jamais verts", async () => {
    h.sessions.mockResolvedValue([
      {
        id: "s1",
        formationId: "f",
        modalite: "presentiel",
        dateDebut: NOW,
        dateFin: NOW,
        formateurPrincipalId: null,
        projetId: null,
        estTestInterne: false,
      },
    ]);
    const t = (await chargerTracesVoyants(["s1"], NOW)).get("s1")!;
    expect(t.i4).toEqual({ lecture: "lot_eteint" });
    expect(t.i17).toEqual({ lecture: "lot_eteint" });
  });
});
