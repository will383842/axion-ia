/**
 * Filtre de sujets hors cible dans `selectKeywordRich` (audit blog 24/10/2026).
 *
 * Un candidat écarté est déjà réservé par l'UPDATE atomique : il passe en fin de
 * rotation, rien n'est supprimé. On vérifie ici que le sélecteur passe au suivant,
 * s'arrête après un nombre borné d'essais, et ne propose plus de ville interdite.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const queryRawMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRawMock(...args),
  },
}));

import { selectKeywordRich, __resetInMemoryCounters } from "../keyword-selector";
import { evaluerSujetCible } from "../sujet-cible";

function ligne(term: string) {
  return [{ term, search_intent: null, cluster_id: null }];
}

beforeEach(() => {
  queryRawMock.mockReset();
  __resetInMemoryCounters();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("selectKeywordRich — filtre de sujets hors cible", () => {
  it("passe au candidat suivant quand le premier est hors cible", async () => {
    queryRawMock
      .mockResolvedValueOnce(ligne("audit IA stratégique ETI"))
      .mockResolvedValueOnce(ligne("IA pour marque de luxe France"))
      .mockResolvedValueOnce(ligne("audit IA pour TPE"));

    const r = await selectKeywordRich({ vertical: "audits" });

    expect(r?.term).toBe("audit IA pour TPE");
    expect(queryRawMock).toHaveBeenCalledTimes(3);
  });

  it("garde les métadonnées intent + cluster du candidat retenu", async () => {
    queryRawMock
      .mockResolvedValueOnce(ligne("comment devenir formateur en IA"))
      .mockResolvedValueOnce([
        { term: "chatbot pour une PME", search_intent: "aeo", cluster_id: "c-chatbot" },
      ]);

    const r = await selectKeywordRich({ vertical: "implementations" });

    expect(r).toEqual({
      term: "chatbot pour une PME",
      searchIntent: "aeo",
      clusterId: "c-chatbot",
    });
  });

  it("n'interroge pas plus de 8 fois la base si tout est hors cible, puis se replie", async () => {
    queryRawMock.mockResolvedValue(ligne("audit IA stratégique ETI"));

    const r = await selectKeywordRich({ vertical: "audits" });

    expect(queryRawMock).toHaveBeenCalledTimes(8);
    // Repli en mémoire : jamais un sujet hors cible.
    expect(r?.term).toBeTruthy();
    expect(evaluerSujetCible(r?.term ?? "").accepte).toBe(true);
  });

  it("journalise le sujet écarté sans rien écrire d'autre", async () => {
    queryRawMock
      .mockResolvedValueOnce(ligne("audit IA maison mode luxe"))
      .mockResolvedValueOnce(ligne("audit IA pour TPE"));

    await selectKeywordRich({ vertical: "audits" });

    const warn = vi.mocked(console.warn);
    expect(warn).toHaveBeenCalledTimes(1);
    const log = JSON.parse(String(warn.mock.calls[0]?.[0])) as { event: string; raison: string };
    expect(log.event).toBe("keyword_sujet_ecarte");
    expect(log.raison).toBe("luxe");
  });

  it("repli géo : saute le gabarit qui porte une ville interdite", async () => {
    queryRawMock.mockResolvedValue([]);

    const r = await selectKeywordRich({
      vertical: "audits",
      city: { name: "Grenoble", regionName: "Auvergne-Rhône-Alpes" },
      rotationSeed: 0,
    });

    expect(r?.term).toBeTruthy();
    expect(r?.term.toLowerCase()).not.toContain("grenoble");
  });
});
