import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyMock } = vi.hoisted(() => ({ findManyMock: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { keywordTracking: { findMany: findManyMock } } }));

import {
  chargerCarteRequetes,
  chargerEntreesCarte,
  equipeEditorialeActive,
} from "../carte-requetes-source";

describe("carte-requetes-source", () => {
  beforeEach(() => findManyMock.mockReset());

  it("convertit les lignes : gsc → gsc, autres → suivi, Decimal → nombre", async () => {
    findManyMock.mockResolvedValue([
      {
        keyword: "a",
        targetUrl: "https://axion-ia.com/x",
        position: "4.50",
        impressions: 10,
        source: "gsc",
      },
      {
        keyword: "b",
        targetUrl: "https://axion-ia.com/y",
        position: 2,
        impressions: 0,
        source: "manual",
      },
      {
        keyword: "c",
        targetUrl: "https://axion-ia.com/z",
        position: 9,
        impressions: 1,
        source: "serpapi",
      },
    ]);
    const e = await chargerEntreesCarte();
    expect(e.map((x) => x.source)).toEqual(["gsc", "suivi", "suivi"]);
    expect(e[0]!.position).toBe(4.5);
  });

  it("filtre sur la fraîcheur de syncedAt", async () => {
    findManyMock.mockResolvedValue([]);
    await chargerEntreesCarte();
    const arg = findManyMock.mock.calls[0]![0];
    expect(arg.where.syncedAt.gte).toBeInstanceOf(Date);
  });

  it("table vide : carte vide", async () => {
    findManyMock.mockResolvedValue([]);
    expect((await chargerCarteRequetes()).carte.size).toBe(0);
  });

  it('interrupteur : actif seulement si exactement "true"', () => {
    delete process.env.CONTENT_EQUIPE_EDITORIALE;
    expect(equipeEditorialeActive()).toBe(false);
    process.env.CONTENT_EQUIPE_EDITORIALE = "TRUE";
    expect(equipeEditorialeActive()).toBe(false);
    process.env.CONTENT_EQUIPE_EDITORIALE = "true";
    expect(equipeEditorialeActive()).toBe(true);
    delete process.env.CONTENT_EQUIPE_EDITORIALE;
  });
});
