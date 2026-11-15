/**
 * D7 option C — au build, seules les villes de 100 000 habitants et plus sont
 * prérendues pour les 5 routes par-ville ; les autres passent en ISR.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { SEUIL_PRERENDU_HUB_VILLE, villesPrerenduesAuBuild } from "@/content/villes/prerendu";
import { getVille, isVilleIndexable } from "@/content/villes";
import { buildStaticParams } from "@/components/sections/VilleServicePageTemplate";

// Le gabarit importe des composants qui tirent next-intl / next ; seule
// `buildStaticParams` (pure) est exercée ici.
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
vi.mock("@/i18n/routing", () => ({ routing: { locales: ["fr", "en"] } }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (k: string) => k,
  setRequestLocale: () => {},
}));
vi.mock("next/navigation", () => ({ notFound: () => {}, redirect: () => {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

describe("buildStaticParams — prérendu des 40 grandes villes", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("renvoie au plus 40 villes, toutes >= 100 000 hab. et indexables", () => {
    vi.stubEnv("BUILD_SSG_VILLES_INDEXABLE_ONLY", "true");
    const params = buildStaticParams();
    expect(SEUIL_PRERENDU_HUB_VILLE).toBe(100_000);
    expect(params.length).toBeGreaterThan(0);
    expect(params.length).toBeLessThanOrEqual(40);
    for (const { ville } of params) {
      const v = getVille(ville);
      expect(v, ville).toBeDefined();
      expect(v!.population).toBeGreaterThanOrEqual(100_000);
      expect(isVilleIndexable(ville), ville).toBe(true);
    }
    // Liste complète : aucune grande ville indexable ne doit manquer.
    expect(params.map((p) => p.ville).sort()).toEqual(
      villesPrerenduesAuBuild()
        .filter((v) => isVilleIndexable(v.slug))
        .map((v) => v.slug)
        .sort(),
    );
  });

  it("garde la branche non indexable (dev) : toutes les villes", () => {
    vi.stubEnv("BUILD_SSG_VILLES_INDEXABLE_ONLY", "false");
    expect(buildStaticParams().length).toBeGreaterThan(40);
  });
});
