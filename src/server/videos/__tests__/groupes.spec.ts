import { describe, expect, it } from "vitest";
import { SEUIL_PAGE_GROUPE, groupesParSerie, groupesParTheme } from "../groupes";
import type { VideoPubliee } from "../lecture";

const v = (
  slug: string,
  theme: string,
  serie: [string, number] | null = null,
  jour = 1,
): VideoPubliee =>
  ({
    slug,
    theme,
    serie: serie ? { slug: serie[0], titre: `Série ${serie[0]}`, rang: serie[1] } : null,
    publieeLe: new Date(`2026-11-${String(jour).padStart(2, "0")}T00:00:00Z`),
  }) as VideoPubliee;

describe("groupes", () => {
  it("le seuil des pages de thème et de série est 3 (D3)", () => {
    expect(SEUIL_PAGE_GROUPE).toBe(3);
  });

  it("par thème : seuls les thèmes non vides, dans l'ordre de la liste fermée", () => {
    const g = groupesParTheme([v("a", "audit-ia"), v("b", "formations-ia")]);
    expect(g.map((x) => x.theme.slug)).toEqual(["formations-ia", "audit-ia"]);
  });

  it("par thème : page seulement à partir de 3 vidéos", () => {
    const deux = groupesParTheme([v("a", "audit-ia"), v("b", "audit-ia")]);
    expect(deux[0]!.aPage).toBe(false);
    const trois = groupesParTheme([v("a", "audit-ia"), v("b", "audit-ia"), v("c", "audit-ia")]);
    expect(trois[0]!.aPage).toBe(true);
  });

  it("par thème : thème hors liste ignoré", () => {
    expect(groupesParTheme([v("a", "cuisine")])).toEqual([]);
  });

  it("par série : épisodes dans l'ordre du rang, page à partir de 3", () => {
    const g = groupesParSerie([
      v("ep3", "audit-ia", ["s", 3]),
      v("ep1", "audit-ia", ["s", 1]),
      v("ep2", "audit-ia", ["s", 2]),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]!.videos.map((x) => x.slug)).toEqual(["ep1", "ep2", "ep3"]);
    expect(g[0]!.aPage).toBe(true);
    expect(
      groupesParSerie([v("a", "audit-ia", ["s", 1]), v("b", "audit-ia", ["s", 2])])[0]!.aPage,
    ).toBe(false);
  });

  it("par série : une vidéo sans série n'appartient à aucun groupe", () => {
    expect(groupesParSerie([v("a", "audit-ia")])).toEqual([]);
  });
});
