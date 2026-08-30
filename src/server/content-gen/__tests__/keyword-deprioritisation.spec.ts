/**
 * Dépriorisation du positionnement retiré (2026-08-30, suite de #895).
 *
 * Ce que ces tests verrouillent, et pourquoi chacun existe :
 *
 *  1. La liste est DÉRIVÉE du corpus, pas recopiée — une liste écrite à la main
 *     deviendrait muette au prochain mot-clé ajouté.
 *  2. Elle n'est pas VIDE. Une dérivation qui rend `[]` désactiverait la
 *     dépriorisation en silence, sur les deux chemins, sans rien faire rougir.
 *  3. Le carve-out `artisan`/`commerçant` tient : l'arbitrage retire le PALIER
 *     de taille, pas le métier.
 *  4. LES DEUX CHEMINS mordent — base ET repli in-memory. Le repli ne sert qu'en
 *     base vide ou indisponible, donc un oubli de ce côté serait invisible en
 *     production jusqu'au jour où il compte.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryRawMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: (...args: unknown[]) => queryRawMock(...args) },
}));

import { ALL_KEYWORD_SEEDS } from "@/content/keywords/master";
import { TERMES_DEPRIORISES, ciblUneTailleRetiree } from "@/content/keywords/deprioritized";
import { selectKeyword, selectKeywordRich, __resetInMemoryCounters } from "../keyword-selector";

beforeEach(() => {
  queryRawMock.mockReset();
  __resetInMemoryCounters();
});

describe("dépriorisation — la liste est dérivée, pas recopiée", () => {
  it("n'est pas vide (sinon la dépriorisation est désactivée en silence)", () => {
    expect(TERMES_DEPRIORISES.length).toBeGreaterThan(0);
  });

  it("vaut exactement le corpus filtré par le prédicat", () => {
    const attendu = ALL_KEYWORD_SEEDS.map((s) => s.keyword).filter((t) => ciblUneTailleRetiree(t));
    expect([...TERMES_DEPRIORISES]).toEqual(attendu);
  });

  it("reste une part MINORITAIRE du corpus — sinon le prédicat est trop large", () => {
    expect(TERMES_DEPRIORISES.length).toBeLessThan(ALL_KEYWORD_SEEDS.length * 0.1);
  });

  it("attrape les marqueurs de taille, y compris en minuscules", () => {
    expect(ciblUneTailleRetiree("audit IA pour TPE")).toBe(true);
    expect(ciblUneTailleRetiree("coaching ia dirigeant tpe artisan france")).toBe(true);
    expect(ciblUneTailleRetiree("prestataire audit IA micro-entreprise")).toBe(true);
    expect(ciblUneTailleRetiree("IA pour auto-entrepreneur sans compétences")).toBe(true);
    expect(ciblUneTailleRetiree("aider une très petite entreprise ?")).toBe(true);
  });

  it("NE déprioritise PAS artisan ni commerçant seuls (le métier reste, pas le palier)", () => {
    expect(ciblUneTailleRetiree("IA pour artisan bâtiment")).toBe(false);
    expect(ciblUneTailleRetiree("gains productivité IA pour artisans et commerçants")).toBe(false);
    expect(ciblUneTailleRetiree("audit IA PME")).toBe(false);
    const artisansEncorePrioritaires = ALL_KEYWORD_SEEDS.map((s) => s.keyword).filter(
      (t) => /artisan|commer[çc]ant/i.test(t) && !ciblUneTailleRetiree(t),
    );
    expect(artisansEncorePrioritaires.length).toBeGreaterThan(0);
  });
});

describe("chemin BASE — une clé de tri, pas un filtre", () => {
  it("passe les termes dépriorisés en paramètres de la requête", async () => {
    queryRawMock.mockResolvedValueOnce([{ term: "x", search_intent: null, cluster_id: null }]);
    await selectKeywordRich({ vertical: "audits" });
    const sql = queryRawMock.mock.calls[0]?.[0] as { values: unknown[] };
    expect(sql.values).toEqual(expect.arrayContaining([TERMES_DEPRIORISES[0]]));
  });

  it("les rend toujours sélectionnables — aucun WHERE ne les exclut", async () => {
    queryRawMock.mockResolvedValueOnce([
      { term: TERMES_DEPRIORISES[0], search_intent: null, cluster_id: null },
    ]);
    const r = await selectKeywordRich({ vertical: "audits" });
    expect(r?.term).toBe(TERMES_DEPRIORISES[0]);
  });
});

describe("chemin REPLI in-memory — le jumeau", () => {
  it("ne rend jamais un terme déprioritisé tant qu'il reste des non-dépriorisés", async () => {
    queryRawMock.mockResolvedValue([]); // base vide → repli
    const vus: string[] = [];
    for (let i = 0; i < 60; i++) {
      const t = await selectKeyword({ vertical: "audits" });
      if (t) vus.push(t);
    }
    expect(vus.length).toBeGreaterThan(0);
    expect(vus.filter((t) => ciblUneTailleRetiree(t))).toEqual([]);
  });

  it("le repli couvre bien des mots-clés du corpus (sinon le test ci-dessus est vide)", async () => {
    queryRawMock.mockResolvedValue([]);
    const termes = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const t = await selectKeyword({ vertical: "audits" });
      if (t) termes.add(t);
    }
    expect(termes.size).toBeGreaterThan(5);
  });
});
