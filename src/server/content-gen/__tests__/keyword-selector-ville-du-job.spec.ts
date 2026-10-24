/**
 * Ville plaquée au hasard (audit blog/RAG du 24/10/2026).
 *
 * Un article « formation IA Strasbourg Grand Est » contenait « Opportunités à
 * Bezons — bien que cet article se concentre sur Strasbourg ». Le vivier donnait
 * un mot-clé qui nomme Strasbourg à un job ancré sur Bezons. Ce test échoue sans
 * le filtre : le sélecteur rendait « formation IA Strasbourg Grand Est ».
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const queryRawMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRawMock(...args),
  },
}));

import { selectKeywordRich, __resetInMemoryCounters } from "../keyword-selector";

const BEZONS = { name: "Bezons", regionName: "Île-de-France", inseeCode: "95063" };

function ligne(term: string) {
  return [{ term, search_intent: null, cluster_id: null }];
}

beforeEach(() => {
  queryRawMock.mockReset();
  __resetInMemoryCounters();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("selectKeywordRich — la ville du mot-clé doit être celle du job", () => {
  it("filtre dans la requête atomique sur city_ids avec le code INSEE du job", async () => {
    queryRawMock.mockResolvedValueOnce(ligne("audit IA pour TPE"));

    await selectKeywordRich({ vertical: "audits", city: BEZONS });

    const requete = queryRawMock.mock.calls[0]?.[0] as { sql: string; values: unknown[] };
    expect(requete.sql).toContain("city_ids");
    expect(requete.values).toContain("95063");
  });

  it("sans code INSEE, aucun prédicat ville n'est ajouté à la requête", async () => {
    queryRawMock.mockResolvedValueOnce(ligne("audit IA pour TPE"));

    await selectKeywordRich({ vertical: "audits", city: { name: "Bezons", regionName: "IDF" } });

    const requete = queryRawMock.mock.calls[0]?.[0] as { sql: string };
    expect(requete.sql).not.toContain("city_ids");
  });

  it("écarte un mot-clé qui nomme une autre ville (filet si city_ids est vide) et passe au suivant", async () => {
    queryRawMock
      .mockResolvedValueOnce(ligne("formation IA Strasbourg Grand Est"))
      .mockResolvedValueOnce(ligne("formation IA équipe commerce de proximité"));

    const r = await selectKeywordRich({ vertical: "interventions_formations", city: BEZONS });

    expect(r?.term).toBe("formation IA équipe commerce de proximité");
    expect(queryRawMock).toHaveBeenCalledTimes(2);
  });

  it("journalise l'écart sans rien écrire d'autre", async () => {
    queryRawMock
      .mockResolvedValueOnce(ligne("audit IA Lyon"))
      .mockResolvedValueOnce(ligne("audit IA pour TPE"));

    await selectKeywordRich({ vertical: "audits", city: BEZONS });

    const log = JSON.parse(String(vi.mocked(console.warn).mock.calls[0]?.[0])) as {
      event: string;
      villeJob: string;
    };
    expect(log.event).toBe("keyword_ville_ecartee");
    expect(log.villeJob).toBe("Bezons");
  });

  it("garde un mot-clé qui nomme la ville du job", async () => {
    queryRawMock.mockResolvedValueOnce(ligne("formation IA Bezons"));

    const r = await selectKeywordRich({ vertical: "interventions_formations", city: BEZONS });

    expect(r?.term).toBe("formation IA Bezons");
  });

  it("sans ville de job, un mot-clé qui nomme une ville reste permis (comportement d'avant)", async () => {
    queryRawMock.mockResolvedValueOnce(ligne("formation IA Strasbourg Grand Est"));

    const r = await selectKeywordRich({ vertical: "interventions_formations" });

    expect(r?.term).toBe("formation IA Strasbourg Grand Est");
  });

  it("s'arrête après 8 essais puis se replie sur un terme de la ville du job", async () => {
    queryRawMock.mockResolvedValue(ligne("formation IA Strasbourg Grand Est"));

    const r = await selectKeywordRich({ vertical: "audits", city: BEZONS, rotationSeed: 0 });

    expect(queryRawMock).toHaveBeenCalledTimes(8);
    expect(r?.term).toContain("Bezons");
  });
});
