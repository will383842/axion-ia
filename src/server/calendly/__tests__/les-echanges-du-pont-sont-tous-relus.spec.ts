/**
 * U7-f — la liste figée des échanges du pont = la liste rattachée, chacun avec une
 * issue ou une ligne « à trancher » / « à vérifier ».
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

import {
  DEBUT_DU_PONT,
  empreinteListe,
  etatEchangePont,
  relireEchangesDuPont,
} from "../pont-echanges-formateur";

const MAINTENANT = new Date("2026-10-25T10:00:00Z");
const PASSE = new Date("2026-10-20T10:00:00Z");

describe("etatEchangePont", () => {
  it("dit ce qu'il reste à faire", () => {
    const base = {
      status: "scheduled",
      startTime: PASSE,
      linkedJobApplicationId: "c",
      aUnPoint: false,
    };
    expect(etatEchangePont({ ...base, linkedJobApplicationId: null }, MAINTENANT)).toBe(
      "a_verifier",
    );
    expect(etatEchangePont(base, MAINTENANT)).toBe("a_trancher");
    expect(etatEchangePont({ ...base, aUnPoint: true }, MAINTENANT)).toBe("issue_notee");
    expect(
      etatEchangePont({ ...base, startTime: new Date("2026-10-30T10:00:00Z") }, MAINTENANT),
    ).toBe("a_venir");
    expect(etatEchangePont({ ...base, status: "canceled" }, MAINTENANT)).toBe("annule");
  });
});

describe("relireEchangesDuPont", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fige la liste, relit seulement les échanges sans candidature, puis compare", async () => {
    const avant = [
      { id: "a", status: "scheduled", startTime: PASSE, linkedJobApplicationId: null, suivi: null },
      {
        id: "b",
        status: "scheduled",
        startTime: PASSE,
        linkedJobApplicationId: "c2",
        suivi: { id: "s" },
      },
    ];
    const apres = [{ ...avant[0]!, linkedJobApplicationId: "c1" }, avant[1]!];
    findMany.mockResolvedValueOnce(avant).mockResolvedValueOnce(apres);
    const relire = vi.fn().mockResolvedValue({ ok: true });
    const b = await relireEchangesDuPont(MAINTENANT, relire);
    expect(relire).toHaveBeenCalledTimes(1);
    expect(relire).toHaveBeenCalledWith("a");
    expect(b).toMatchObject({
      avant: { nombre: 2, aVerifier: 1, empreinte: empreinteListe(["b", "a"]) },
      apres: { nombre: 2, aVerifier: 0, aTrancher: 1 },
      relus: 1,
      rattaches: 1,
      plafondAtteint: false,
    });
    expect(findMany.mock.calls[0]![0].where.capturedAt).toEqual({ gte: DEBUT_DU_PONT });
  });

  it("une relecture qui lève laisse la ligne « à vérifier »", async () => {
    const l = [
      { id: "a", status: "scheduled", startTime: PASSE, linkedJobApplicationId: null, suivi: null },
    ];
    findMany.mockResolvedValue(l);
    const b = await relireEchangesDuPont(MAINTENANT, vi.fn().mockRejectedValue(new Error("api")));
    expect(b.apres.aVerifier).toBe(1);
    expect(b.rattaches).toBe(0);
  });
});
