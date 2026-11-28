import { describe, expect, it, vi } from "vitest";

import { chargerCandidats, accesLignes, CLE_DERNIER_PASSAGE } from "../donnees";

const MAINTENANT = new Date("2026-11-27T05:00:00Z");

describe("chargement des candidats", () => {
  it("fusionne routes, impressions et derniers passages (base et Redis), chemins normalisés", async () => {
    const groupBy = vi
      .fn()
      .mockResolvedValueOnce([{ chemin: "/fr/a", _sum: { impressions: 3 } }])
      .mockResolvedValueOnce([{ chemin: "/fr/a", _sum: { impressions: 40 } }]);
    const prisma = {
      siteRoute: {
        findMany: vi.fn().mockResolvedValue([
          {
            pathRendered: "/fr/a/",
            lastModifiedAt: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            isIndexable: true,
          },
          {
            pathRendered: "/fr/a",
            lastModifiedAt: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            isIndexable: true,
          }, // doublon
          {
            pathRendered: "/fr/b",
            lastModifiedAt: new Date("2026-11-27T01:00:00Z"),
            isIndexable: false,
          },
        ]),
      },
      gscPageJour: { groupBy },
      gscInspection: {
        groupBy: vi
          .fn()
          .mockResolvedValue([
            { chemin: "/fr/a", _max: { inspecteLe: new Date("2026-10-01T00:00:00Z") } },
          ]),
      },
    };
    const redis = {
      hgetall: vi
        .fn()
        .mockResolvedValue({ "/fr/a": String(new Date("2026-11-20T00:00:00Z").getTime()) }),
      hset: vi.fn(),
    };
    const r = await chargerCandidats(prisma as never, redis, MAINTENANT);
    expect(redis.hgetall).toHaveBeenCalledWith(CLE_DERNIER_PASSAGE);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      chemin: "/fr/a",
      impressions14: 3,
      impressionsPrecedentes14: 40,
      noindex: false,
      derniereInspection: new Date("2026-11-20T00:00:00Z"),
    });
    expect(r[1]).toMatchObject({
      chemin: "/fr/b",
      cheminRendu: "/fr/b",
      noindex: true,
      derniereInspection: null,
      modifieLe: new Date("2026-11-27T01:00:00Z"),
    });
    // routes retirées et chemins à paramètre exclus dès la requête
    const filtre = prisma.siteRoute.findMany.mock.calls[0]![0].where;
    expect(filtre.removedAt).toBeNull();
    expect(filtre.NOT).toEqual({ pathRendered: { contains: "[" } });
  });

  it("lecture seule : seule la table des inspections et la mémoire de passage sont écrites", async () => {
    const create = vi.fn();
    const hset = vi.fn();
    const acces = accesLignes({ gscInspection: { create, findFirst: vi.fn() } } as never, { hset });
    await acces.ecrireLigne({
      chemin: "/fr/a",
      verdict: "PASS",
      couverture: null,
      canoniqueGoogle: null,
      canoniqueDeclaree: null,
      dernierPassageRobot: null,
    });
    await acces.marquerVue("/fr/a", MAINTENANT);
    expect(create).toHaveBeenCalledTimes(1);
    expect(hset).toHaveBeenCalledWith(CLE_DERNIER_PASSAGE, "/fr/a", String(MAINTENANT.getTime()));
  });
});
