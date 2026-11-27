import { describe, expect, it, vi } from "vitest";

import {
  fenetreHistorique,
  historiqueDisponible,
  metriquesPageDepuisHistorique,
  recalculerKeywordTracking,
  recalculerSiteRoutes,
  tacheRecalcul,
} from "../recalcul";

vi.mock("@/server/content-gen/indexing/url-builder", () => ({
  buildArticleUrl: ({ slug, isNews }: { slug: string; isNews: boolean }) =>
    `https://axion-ia.com/fr/${isNews ? "actualites" : "blog"}/${slug}`,
}));

type Ligne = Record<string, unknown>;
const jourDate = (j: string) => new Date(`${j}T00:00:00Z`);
const MAINTENANT = () => new Date("2026-12-01T08:00:00Z");
/** Dernier jour final : 2026-11-28 ; fenêtre de 28 jours : 2026-11-01 → 2026-11-28. */
const FIN = "2026-11-28";

function ajouter(j: string, n: number): string {
  const d = jourDate(j);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function egal(a: unknown, b: unknown) {
  return a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
}
function filtre(l: Ligne, where: Ligne | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, c]) => {
    if (c === null || typeof c !== "object" || c instanceof Date) return egal(l[k], c);
    return Object.entries(c as Ligne).every(([op, x]) => {
      const v = l[k];
      if (op === "in") return (x as unknown[]).some((y) => egal(v, y));
      if (op === "gte") return (v as Date | number) >= (x as Date | number);
      if (op === "lte") return (v as Date | number) <= (x as Date | number);
      if (op === "not") return x === null ? v != null : !egal(v, x);
      throw new Error(`opérateur ${op}`);
    });
  });
}
function table(lignes: Ligne[]) {
  return {
    lignes,
    findMany: vi.fn(async ({ where, take }: { where?: Ligne; take?: number } = {}) =>
      lignes
        .filter((l) => filtre(l, where))
        .slice(0, take ?? Infinity)
        .map((l) => ({ ...l })),
    ),
    findUnique: vi.fn(async ({ where }: { where: Ligne }) => {
      const cle = Object.values(where)[0] as Ligne;
      const l = lignes.find((x) => Object.entries(cle).every(([k, v]) => x[k] === v));
      return l ? { ...l } : null;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Ligne }) => {
      const l = lignes.find((x) => x["id"] === where.id);
      if (!l) throw new Error("introuvable");
      Object.assign(l, data);
      return l;
    }),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { keyword_targetUrl: Ligne };
        create: Ligne;
        update: Ligne;
      }) => {
        const l = lignes.find((x) =>
          Object.entries(where.keyword_targetUrl).every(([k, v]) => x[k] === v),
        );
        if (l) Object.assign(l, update);
        else lignes.push({ ...create });
      },
    ),
  };
}

function base(opts: { joursReussis?: number; jourManquant?: string } = {}) {
  const n = opts.joursReussis ?? 28;
  const runs: Ligne[] = [];
  for (let i = 0; i < n; i++) {
    const j = ajouter(FIN, -i);
    if (j === opts.jourManquant) continue;
    runs.push({ jour: jourDate(j), typeRecherche: "web", statut: "reussi" });
  }
  // un jour en échec ne compte pas comme couvert
  runs.push({ jour: jourDate(ajouter(FIN, 1)), typeRecherche: "web", statut: "echec" });
  return {
    gscImportRun: table(runs),
    gscPageJour: table([]),
    gscRequete: table([]),
    gscPageRequeteJour: table([]),
    siteRoute: table([]),
    keywordTracking: table([]),
    article: table([]),
  };
}
type Base = ReturnType<typeof base>;
const prismaDe = (b: Base) => b as never;

function pageJour(b: Base, jour: string, chemin: string, clics: number, imp: number, pos: number) {
  b.gscPageJour.lignes.push({
    date: jourDate(jour),
    typeRecherche: "web",
    chemin,
    clics,
    impressions: imp,
    positionSum: pos * imp,
  });
}

describe("fenetreHistorique", () => {
  it("28 jours réussis consécutifs : fenêtre rendue, bornes incluses", async () => {
    const f = await fenetreHistorique(prismaDe(base()), 28, MAINTENANT);
    expect(f).toEqual({ debut: "2026-11-01", fin: FIN, jours: 28 });
  });

  it("un jour manquant dans la fenêtre : null (jamais une fenêtre trouée)", async () => {
    const b = base({ jourManquant: "2026-11-10" });
    expect(await fenetreHistorique(prismaDe(b), 28, MAINTENANT)).toBeNull();
  });

  it("historique de 20 jours seulement : null", async () => {
    expect(
      await fenetreHistorique(prismaDe(base({ joursReussis: 20 })), 28, MAINTENANT),
    ).toBeNull();
  });

  it("historique périmé (dernier jour final vieux de plus de 5 jours) : null", async () => {
    const tard = () => new Date("2026-12-10T08:00:00Z");
    expect(await fenetreHistorique(prismaDe(base()), 28, tard)).toBeNull();
  });
});

describe("historiqueDisponible", () => {
  const env = (v?: string) => ({
    ...(v ? { CONTENT_PILOTAGE_SEO: v } : {}),
    DATABASE_URL: "postgresql://u:p@db:5432/x",
  });

  it("interrupteur éteint : faux, sans toucher à la base", async () => {
    const b = base();
    expect(await historiqueDisponible(prismaDe(b), { env: env(), maintenant: MAINTENANT })).toBe(
      false,
    );
    expect(await historiqueDisponible(prismaDe(b), { env: env("1"), maintenant: MAINTENANT })).toBe(
      false,
    );
    expect(b.gscImportRun.findMany).not.toHaveBeenCalled();
  });

  it("allumé et historique complet : vrai ; historique court : faux", async () => {
    expect(
      await historiqueDisponible(prismaDe(base()), { env: env("true"), maintenant: MAINTENANT }),
    ).toBe(true);
    expect(
      await historiqueDisponible(prismaDe(base({ joursReussis: 10 })), {
        env: env("true"),
        maintenant: MAINTENANT,
      }),
    ).toBe(false);
  });

  it("table absente (P2021) : faux, sans échec", async () => {
    const b = base();
    b.gscImportRun.findMany.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "P2021" }));
    expect(
      await historiqueDisponible(prismaDe(b), { env: env("true"), maintenant: MAINTENANT }),
    ).toBe(false);
  });

  it("build stub : faux", async () => {
    expect(
      await historiqueDisponible(prismaDe(base()), {
        env: {
          CONTENT_PILOTAGE_SEO: "true",
          DATABASE_URL: "postgresql://stub:stub@stub.invalid/x",
        },
        maintenant: MAINTENANT,
      }),
    ).toBe(false);
  });
});

describe("recalculerSiteRoutes", () => {
  it("mêmes chiffres que l'agrégat de la page sur 28 jours (position pondérée, CTR = clics / impressions)", async () => {
    const b = base();
    pageJour(b, "2026-11-05", "/fr/blog/a", 2, 100, 4);
    pageJour(b, "2026-11-20", "/fr/blog/a", 3, 300, 8);
    // hors fenêtre : jamais compté
    pageJour(b, "2026-10-31", "/fr/blog/a", 50, 5000, 1);
    b.siteRoute.lignes.push({
      id: "r1",
      pathRendered: "/fr/blog/a/",
      visibility: "public",
      removedAt: null,
      isIndexable: true,
    });
    const r = await recalculerSiteRoutes(prismaDe(b), { maintenant: MAINTENANT });
    expect(r).toMatchObject({ issue: "fait", routesMisesAJour: 1 });
    const route = b.siteRoute.lignes[0]!;
    expect(route["gscClicks"]).toBe(5);
    expect(route["gscImpressions"]).toBe(400);
    expect(route["gscCtr"]).toBeCloseTo(5 / 400, 10);
    expect(route["gscPosition"]).toBeCloseTo((4 * 100 + 8 * 300) / 400, 10); // 7
    expect((route["gscDataAt"] as Date).toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });

  it("page sans impression sur une fenêtre complète : zéros vrais, position nulle (pas 0)", async () => {
    const b = base();
    b.siteRoute.lignes.push({
      id: "r1",
      pathRendered: "/fr/blog/jamais",
      visibility: "public",
      removedAt: null,
      isIndexable: true,
    });
    await recalculerSiteRoutes(prismaDe(b), { maintenant: MAINTENANT });
    expect(b.siteRoute.lignes[0]).toMatchObject({
      gscClicks: 0,
      gscImpressions: 0,
      gscCtr: 0,
      gscPosition: null,
    });
  });

  it("route dynamique ([param]) ou hôte étranger : ignorée", async () => {
    const b = base();
    b.siteRoute.lignes.push({
      id: "r1",
      pathRendered: "/fr/blog/[slug]",
      visibility: "public",
      removedAt: null,
      isIndexable: true,
    });
    const r = await recalculerSiteRoutes(prismaDe(b), { maintenant: MAINTENANT });
    expect(r).toMatchObject({ routesMisesAJour: 0 });
    expect(b.siteRoute.update).not.toHaveBeenCalled();
  });

  it("une écriture en échec (route supprimée) ne fait pas tomber les autres", async () => {
    const b = base();
    for (const id of ["r1", "r2"])
      b.siteRoute.lignes.push({
        id,
        pathRendered: `/fr/blog/${id}`,
        visibility: "public",
        removedAt: null,
        isIndexable: true,
      });
    b.siteRoute.update.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "P2025" }));
    const r = await recalculerSiteRoutes(prismaDe(b), { maintenant: MAINTENANT });
    expect(r).toMatchObject({ issue: "fait", routesMisesAJour: 1 });
  });

  it("route EN : ignorée (pas de double comptage avec la page FR)", async () => {
    const b = base();
    pageJour(b, "2026-11-05", "/fr/a-propos", 1, 10, 3);
    b.siteRoute.lignes.push({
      id: "en",
      pathRendered: "/en/about",
      visibility: "public",
      removedAt: null,
      isIndexable: true,
    });
    const r = await recalculerSiteRoutes(prismaDe(b), { maintenant: MAINTENANT });
    expect(r).toMatchObject({ routesMisesAJour: 0 });
    expect(b.siteRoute.lignes[0]).not.toHaveProperty("gscClicks");
  });

  it("historique insuffisant : repli, AUCUNE écriture", async () => {
    const b = base({ joursReussis: 12 });
    b.siteRoute.lignes.push({
      id: "r1",
      pathRendered: "/fr/blog/a",
      visibility: "public",
      removedAt: null,
      isIndexable: true,
    });
    const r = await recalculerSiteRoutes(prismaDe(b), { maintenant: MAINTENANT });
    expect(r).toEqual({ issue: "saute", motif: "historique_insuffisant" });
    expect(b.siteRoute.update).not.toHaveBeenCalled();
    expect(b.siteRoute.findMany).not.toHaveBeenCalled();
  });
});

describe("recalculerKeywordTracking", () => {
  function avecArticle(b: Base) {
    b.article.lignes.push({
      id: "art1",
      status: "published",
      isNews: false,
      templateVariant: null,
      indexationTier: "tier_1_indexable",
      publishedAt: new Date("2026-10-01T00:00:00Z"),
      translations: [{ locale: "fr", slug: "mon-article" }],
    });
    b.gscRequete.lignes.push(
      { id: 1, texte: "formation ia entreprise" },
      { id: 2, texte: "formation ia" },
    );
    const det = (jour: string, requeteId: number, clics: number, imp: number, pos: number) =>
      b.gscPageRequeteJour.lignes.push({
        date: jourDate(jour),
        typeRecherche: "web",
        chemin: "/fr/blog/mon-article",
        requeteId,
        clics,
        impressions: imp,
        positionSum: pos * imp,
      });
    det("2026-11-05", 1, 4, 40, 3);
    det("2026-11-06", 1, 1, 60, 5); // cumul : 5 clics, 100 imp, position 4,2
    det("2026-11-06", 2, 0, 50, 12);
  }

  it("crée les mots-clés depuis l'historique : cumul 28 j, position pondérée, CTR", async () => {
    const b = base();
    avecArticle(b);
    const r = await recalculerKeywordTracking(prismaDe(b), { maintenant: MAINTENANT });
    expect(r).toMatchObject({ issue: "fait", motsCles: 2 });
    const kw = b.keywordTracking.lignes.find((l) => l["keyword"] === "formation ia entreprise")!;
    expect(kw).toMatchObject({
      targetUrl: "https://axion-ia.com/fr/blog/mon-article",
      articleId: "art1",
      clicks: 5,
      impressions: 100,
      source: "gsc",
    });
    expect(kw["position"]).toBeCloseTo((3 * 40 + 5 * 60) / 100, 10);
    expect(kw["ctr"]).toBeCloseTo(0.05, 10);
  });

  it("garde les 10 meilleurs mots-clés par page (clics puis impressions)", async () => {
    const b = base();
    avecArticle(b);
    for (let i = 10; i < 25; i++) {
      b.gscRequete.lignes.push({ id: i, texte: `requete ${i}` });
      b.gscPageRequeteJour.lignes.push({
        date: jourDate("2026-11-07"),
        typeRecherche: "web",
        chemin: "/fr/blog/mon-article",
        requeteId: i,
        clics: 0,
        impressions: i,
        positionSum: 10 * i,
      });
    }
    await recalculerKeywordTracking(prismaDe(b), { maintenant: MAINTENANT });
    expect(b.keywordTracking.lignes).toHaveLength(10);
    expect(b.keywordTracking.lignes[0]!["keyword"]).toBe("formation ia entreprise");
  });

  it("second passage : positionDelta calculé contre la valeur précédente, sans doublon", async () => {
    const b = base();
    avecArticle(b);
    b.keywordTracking.lignes.push({
      keyword: "formation ia entreprise",
      targetUrl: "https://axion-ia.com/fr/blog/mon-article",
      position: 6,
    });
    await recalculerKeywordTracking(prismaDe(b), { maintenant: MAINTENANT });
    const kws = b.keywordTracking.lignes.filter((l) => l["keyword"] === "formation ia entreprise");
    expect(kws).toHaveLength(1);
    expect(kws[0]!["positionDelta"]).toBeCloseTo(4.2 - 6, 10);
  });

  it("mot-clé de plus de 255 caractères ou upsert en échec : ignoré, les autres passent", async () => {
    const b = base();
    avecArticle(b);
    b.gscRequete.lignes[1]!["texte"] = "x".repeat(300);
    b.keywordTracking.upsert.mockRejectedValueOnce(new Error("base"));
    const r = await recalculerKeywordTracking(prismaDe(b), { maintenant: MAINTENANT });
    expect(r).toMatchObject({ issue: "fait", motsCles: 0 });
    const r2 = await recalculerKeywordTracking(prismaDe(b), { maintenant: MAINTENANT });
    expect(r2).toMatchObject({ motsCles: 1 });
  });

  it("requête dont le texte a été purgé : ignorée", async () => {
    const b = base();
    avecArticle(b);
    b.gscRequete.lignes.length = 0;
    const r = await recalculerKeywordTracking(prismaDe(b), { maintenant: MAINTENANT });
    expect(r).toMatchObject({ motsCles: 0 });
  });

  it("historique insuffisant : repli, aucune écriture", async () => {
    const b = base({ joursReussis: 5 });
    avecArticle(b);
    expect(await recalculerKeywordTracking(prismaDe(b), { maintenant: MAINTENANT })).toEqual({
      issue: "saute",
      motif: "historique_insuffisant",
    });
    expect(b.keywordTracking.upsert).not.toHaveBeenCalled();
  });
});

describe("metriquesPageDepuisHistorique (tier-lifecycle)", () => {
  it("même forme que l'ancien appel, sur la fenêtre demandée (14 jours = les 14 derniers)", async () => {
    const b = base();
    pageJour(b, "2026-11-27", "/fr/blog/a", 1, 100, 6); // dans les 14 derniers jours
    pageJour(b, "2026-11-02", "/fr/blog/a", 9, 900, 1); // hors des 14 jours
    const m = await metriquesPageDepuisHistorique(
      prismaDe(b),
      "https://axion-ia.com/fr/blog/a",
      14,
      MAINTENANT,
    );
    expect(m).toEqual({ ctr: 0.01, impressions: 100, clicks: 1, position: 6 });
  });

  it("page sans impression : zéros explicites comme l'ancien chemin", async () => {
    const m = await metriquesPageDepuisHistorique(
      prismaDe(base()),
      "https://axion-ia.com/fr/blog/vide",
      14,
      MAINTENANT,
    );
    expect(m).toEqual({ ctr: 0, impressions: 0, clicks: 0, position: 0 });
  });

  it("historique insuffisant : null (l'appelant retombe sur l'API)", async () => {
    expect(
      await metriquesPageDepuisHistorique(
        prismaDe(base({ joursReussis: 9 })),
        "https://axion-ia.com/fr/blog/a",
        14,
        MAINTENANT,
      ),
    ).toBeNull();
  });

  it("fenêtre de 30 jours alors que seuls 28 sont couverts : null", async () => {
    expect(
      await metriquesPageDepuisHistorique(
        prismaDe(base()),
        "https://axion-ia.com/fr/blog/a",
        30,
        MAINTENANT,
      ),
    ).toBeNull();
  });
});

describe("tacheRecalcul", () => {
  it("regroupe les deux recalculs ; historique court : saute", async () => {
    const court = await tacheRecalcul({
      prisma: prismaDe(base({ joursReussis: 3 })),
      maintenant: MAINTENANT,
    });
    expect(court).toEqual({ issue: "saute", motif: "historique_insuffisant" });
    const ok = await tacheRecalcul({ prisma: prismaDe(base()), maintenant: MAINTENANT });
    expect(ok).toMatchObject({ issue: "fait", routesMisesAJour: 0, motsCles: 0 });
  });
});
