import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { siteVideo: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

import { viderCacheVideos } from "../lecture";
import {
  THEME_GENERIQUE_VILLES,
  themeDeCategorieBlog,
  themeDuService,
  videoPourEncart,
  videoPourFormation,
} from "../encarts";

const ligne = (slug: string, theme: string, jour: number) => ({
  id: slug,
  slug,
  theme,
  statut: "publiee",
  version: 1,
  titre: `Titre ${slug}`,
  description: "d",
  resume: "r",
  aRetenir: [],
  questions: [],
  chapitres: [],
  fichiers: {},
  transcription: null,
  dureeSecondes: 60,
  serieSlug: null,
  serieTitre: null,
  serieRang: null,
  lienType: "service",
  lienChemin: "/fr/audit",
  iaVoixGeneree: false,
  iaDoubleNumerique: false,
  williamsALImage: false,
  publieeLe: new Date(`2026-11-${String(jour).padStart(2, "0")}T10:00:00Z`),
  modifieeLe: new Date(`2026-11-${String(jour).padStart(2, "0")}T10:00:00Z`),
});

beforeEach(() => {
  viderCacheVideos();
  findMany.mockReset();
  findMany.mockResolvedValue([
    ligne("recente", "audit-ia", 9),
    ligne("ancienne", "audit-ia", 2),
    ligne("autre", "automatisation", 5),
  ]);
  vi.stubEnv("VIDEOS_SITE_ENABLED", "true");
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@db.example/x");
  vi.stubEnv("OF_PUBLIC_DISCLOSURE_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());

describe("videoPourEncart", () => {
  it("thème SANS vidéo → null (aucun encart)", async () => {
    expect(await videoPourEncart("sites-web-ia")).toBeNull();
  });

  it("thème avec vidéos → LA PLUS RÉCENTE, une seule", async () => {
    expect((await videoPourEncart("audit-ia"))?.slug).toBe("recente");
  });

  it("jamais deux fois la même vidéo sur une page (exclusion)", async () => {
    expect((await videoPourEncart("audit-ia", ["recente"]))?.slug).toBe("ancienne");
    expect(await videoPourEncart("audit-ia", ["recente", "ancienne"])).toBeNull();
  });

  it("interrupteur éteint → null sans appel à la base", async () => {
    vi.stubEnv("VIDEOS_SITE_ENABLED", "");
    expect(await videoPourEncart("audit-ia")).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("une vidéo retirée n'est jamais proposée (la lecture ne rend que les publiées)", async () => {
    await videoPourEncart("audit-ia");
    expect(findMany.mock.calls[0]![0]).toMatchObject({ where: { statut: "publiee" } });
  });

  it("VILLES : 2 157 rendus du même thème = UNE seule lecture de la base", async () => {
    for (let i = 0; i < 2157; i++) await videoPourEncart(THEME_GENERIQUE_VILLES);
    for (let i = 0; i < 50; i++) await videoPourEncart("automatisation");
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});

describe("formations — soumises au drapeau OF", () => {
  it("divulgation OF éteinte (formation non publique) → aucun encart, même avec des vidéos", async () => {
    vi.stubEnv("OF_PUBLIC_DISCLOSURE_ENABLED", "false");
    expect(await videoPourFormation()).toBeNull();
  });

  it("divulgation OF allumée → la vidéo du thème « formations-ia »", async () => {
    findMany.mockResolvedValue([ligne("formation-1", "formations-ia", 3)]);
    expect((await videoPourFormation())?.slug).toBe("formation-1");
  });
});

describe("correspondances thème", () => {
  it.each([
    ["/formations", "formations-ia"],
    ["/un-a-un", "coaching-ia"],
    ["/audit", "audit-ia"],
    ["/implementation", "automatisation"],
    ["/sites-web-augmentes", "sites-web-ia"],
  ])("service %s → %s", (href, theme) => {
    expect(themeDuService(href)).toBe(theme);
  });

  it("service inconnu → null", () => {
    expect(themeDuService("/contact")).toBeNull();
  });

  it.each([
    ["formations-ia", "formations-ia"],
    ["coaching-1-to-1", "coaching-ia"],
    ["audits-ia", "audit-ia"],
    ["implementation-automatisation", "automatisation"],
    ["sites-web-augmentes", "sites-web-ia"],
    ["actualites-du-mois", null],
    // Comparaison par SEGMENTS de mot, jamais par sous-chaîne.
    ["chacun-a-une-place", null],
    ["un-a-un-premium", "coaching-ia"],
    ["transformation-numerique", null],
    ["webinaire-du-mois", null],
    ["necessite-de-former", null],
    ["visite-d-entreprise", null],
    ["saas-et-web", "sites-web-ia"],
    [null, null],
  ])("catégorie de blog %s → %s", (cat, theme) => {
    expect(themeDeCategorieBlog(cat)).toBe(theme);
  });

  it.each(["jaun-a-unique", "mon-un-a-unite", "tout-1-to-12"])(
    "« %s » : « un-a-un » / « 1-to-1 » se comparent par segments, jamais par sous-chaîne",
    (cat) => {
      expect(themeDeCategorieBlog(cat)).toBeNull();
    },
  );

  it.each(["coaching-un-a-un", "un-a-un", "offre-1-to-1-dirigeants"])(
    "« %s » → coaching-ia (suite de segments)",
    (cat) => {
      expect(themeDeCategorieBlog(cat)).toBe("coaching-ia");
    },
  );

  it("catégorie « formations » : sans divulgation OF, pas de thème (comme videoPourFormation)", () => {
    vi.stubEnv("OF_PUBLIC_DISCLOSURE_ENABLED", "false");
    expect(themeDeCategorieBlog("formations-ia")).toBeNull();
  });

  it("le thème générique des villes existe dans la liste fermée", async () => {
    const { THEME_SLUGS } = await import("@/content/videos/themes");
    expect(THEME_SLUGS).toContain(THEME_GENERIQUE_VILLES);
  });
});
