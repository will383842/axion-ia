/**
 * Croisements catalogue ✕ métadonnées d'affichage : chaque durée/gamme utilisée
 * par une formation a bien sa meta + son ISO, et le sur-mesure pointe vers des
 * durées/gammes valides. Empêche un oubli de meta quand on ajoute une formation.
 */

import { describe, it, expect } from "vitest";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import {
  FORMATION_DUREE_ISO,
  FORMATION_DUREES_META,
  FORMATION_GAMMES_META,
  SUR_MESURE,
  formationDureeIso,
  getDureeMeta,
  getDureeMetaBySlug,
  getGammeMeta,
  getGammeMetaBySlug,
  getGammesThematiques,
} from "@/content/formations/catalog-v2-meta";

describe("meta — couverture complète des durées/gammes du catalogue", () => {
  it("chaque durée utilisée par une formation a une meta + un ISO", () => {
    for (const f of FORMATIONS_V2) {
      expect(() => getDureeMeta(f.duree), `durée ${f.duree} (${f.id})`).not.toThrow();
      expect(FORMATION_DUREE_ISO[f.duree], f.duree).toMatch(/^P/);
    }
  });

  it("chaque gamme utilisée par une formation a une meta", () => {
    for (const f of FORMATIONS_V2) {
      expect(() => getGammeMeta(f.gamme), `gamme ${f.gamme} (${f.id})`).not.toThrow();
    }
  });

  it("ISO figés : 4h=PT4H, 1j=PT7H, 2j=P2D, 3j=P3D", () => {
    expect(formationDureeIso("4h")).toBe("PT4H");
    expect(formationDureeIso("1j")).toBe("PT7H");
    expect(formationDureeIso("2j")).toBe("P2D");
    expect(formationDureeIso("3j")).toBe("P3D");
  });

  it("slugs durées et gammes uniques + résolubles", () => {
    const dSlugs = FORMATION_DUREES_META.map((d) => d.slug);
    const gSlugs = FORMATION_GAMMES_META.map((g) => g.slug);
    expect(new Set(dSlugs).size).toBe(dSlugs.length);
    expect(new Set(gSlugs).size).toBe(gSlugs.length);
    expect(getDureeMetaBySlug("4-heures")?.id).toBe("4h");
    expect(getGammeMetaBySlug("claude")?.id).toBe("claude");
    expect(getDureeMetaBySlug("inconnu")).toBeUndefined();
  });

  it("gammes thématiques = Agents + Claude (bloc propre)", () => {
    const them = getGammesThematiques().map((g) => g.id);
    expect(them).toEqual(["agents-automatisations", "claude"]);
  });
});

describe("meta — sur-mesure cohérent", () => {
  it("chaque sur-mesure rattaché pointe vers une durée/gamme valide", () => {
    const durees = new Set(FORMATION_DUREES_META.map((d) => d.id));
    const gammes = new Set(FORMATION_GAMMES_META.map((g) => g.id));
    for (const s of SUR_MESURE) {
      if (s.duree) expect(durees.has(s.duree), s.id).toBe(true);
      if (s.gamme) expect(gammes.has(s.gamme), s.id).toBe(true);
      expect(s.descriptionFr.length, s.id).toBeGreaterThan(0);
    }
  });

  it("une variante sur-mesure par durée + une globale", () => {
    for (const d of ["4h", "1j", "2j", "3j"] as const) {
      expect(
        SUR_MESURE.some((s) => s.duree === d),
        `sur-mesure ${d}`,
      ).toBe(true);
    }
    expect(SUR_MESURE.some((s) => !s.duree && !s.gamme)).toBe(true); // 100 % sur mesure
  });
});
