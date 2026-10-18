import { describe, expect, it } from "vitest";
import { videosLiees } from "../liees";
import type { VideoPubliee } from "../lecture";

const v = (slug: string, theme: string, serieSlug: string | null, rang = 1): VideoPubliee =>
  ({
    slug,
    theme,
    serie: serieSlug ? { slug: serieSlug, titre: serieSlug, rang } : null,
    publieeLe: new Date("2026-11-01T00:00:00Z"),
  }) as VideoPubliee;

describe("videosLiees", () => {
  it("seule vidéo → aucune liée", () => {
    expect(videosLiees(v("a", "t", null), [v("a", "t", null)])).toEqual([]);
  });

  it("jamais la vidéo elle-même", () => {
    const a = v("a", "t", null);
    expect(videosLiees(a, [a, v("b", "t", null)]).map((x) => x.slug)).toEqual(["b"]);
  });

  it("même série d'abord (dans l'ordre des épisodes), puis même thème", () => {
    const a = v("a", "t", "s", 2);
    const toutes = [
      a,
      v("autre-theme", "x", null),
      v("meme-theme", "t", null),
      v("ep3", "t", "s", 3),
      v("ep1", "t", "s", 1),
    ];
    expect(videosLiees(a, toutes).map((x) => x.slug)).toEqual(["ep1", "ep3", "meme-theme"]);
  });

  it("3 au maximum, et une vidéo d'un autre thème sans série n'est jamais liée", () => {
    const a = v("a", "t", null);
    const toutes = [a, ...["b", "c", "d", "e"].map((s) => v(s, "t", null)), v("z", "autre", null)];
    const r = videosLiees(a, toutes);
    expect(r).toHaveLength(3);
    expect(r.map((x) => x.slug)).not.toContain("z");
  });
});
