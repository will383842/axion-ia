import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../ingestion/noms-connus", () => ({
  chargerNomsConnus: vi.fn(async () => ["Elodie Martin"]),
}));

const { agregerSemaines, lundiDe, tacheIngestionBing } = await import("../collecte");

const CLE = "cle-secrete-de-test-0123456789";
const env = { BING_WMT_API_KEY: CLE };
const maintenant = () => new Date("2026-11-27T05:00:00Z"); // vendredi

type Ligne = Record<string, unknown>;
function fauxPrisma() {
  const t = {
    page: new Map<string, Ligne>(),
    requete: new Map<string, Ligne>(),
    explo: new Map<string, Ligne>(),
  };
  const upsert = (m: Map<string, Ligne>, cle: (w: Ligne) => string) =>
    vi.fn(async ({ where, create, update }: { where: Ligne; create: Ligne; update: Ligne }) => {
      const premier = Object.values(where)[0];
      const k = cle(premier instanceof Date ? where : (premier as Ligne));
      m.set(k, m.has(k) ? { ...(m.get(k) as Ligne), ...update } : create);
    });
  const prisma = {
    bingPageSemaine: {
      upsert: upsert(t.page, (w) => `${(w["semaine"] as Date).toISOString()}|${w["chemin"]}`),
    },
    bingRequeteSemaine: {
      upsert: upsert(t.requete, (w) => `${(w["semaine"] as Date).toISOString()}|${w["texte"]}`),
    },
    bingExplorationJour: { upsert: upsert(t.explo, (w) => (w["date"] as Date).toISOString()) },
  };
  return { prisma: prisma as never, t };
}

const d = (ms: number) => `/Date(${ms})/`;
const J = (iso: string) => d(Date.parse(`${iso}T00:00:00Z`));

function api(
  corps: { pages?: Ligne[]; requetes?: Ligne[]; explo?: Ligne[] },
  statuts: Record<string, number> = {},
) {
  return vi.fn(async (url: string) => {
    const m = /\/(Get\w+)\?/.exec(String(url))?.[1] as string;
    const status = statuts[m] ?? 200;
    const d_ =
      m === "GetPageStats" ? corps.pages : m === "GetQueryStats" ? corps.requetes : corps.explo;
    return { ok: status === 200, status, json: async () => ({ d: d_ ?? [] }) } as Response;
  });
}

const page = (url: string, jour: string, clics: number, imp: number, pos: number): Ligne => ({
  Query: url,
  Date: J(jour),
  Clicks: clics,
  Impressions: imp,
  AvgImpressionPosition: pos,
});

describe("agrégation hebdomadaire", () => {
  it("lundiDe : le lundi de la semaine", () => {
    expect(lundiDe("2026-11-27")).toBe("2026-11-23");
    expect(lundiDe("2026-11-23")).toBe("2026-11-23");
    expect(lundiDe("2026-11-29")).toBe("2026-11-23");
  });

  it("somme par semaine, position pondérée, première semaine partielle écartée", () => {
    const r = agregerSemaines(
      [
        { cle: "a", jour: "2026-11-11", clics: 9, impressions: 9, position: 1 }, // semaine partielle (min = mer.)
        { cle: "a", jour: "2026-11-17", clics: 1, impressions: 10, position: 2 },
        { cle: "a", jour: "2026-11-18", clics: 2, impressions: 30, position: 4 },
      ],
      "2026-11-27",
    );
    // la semaine du 09/11 (min = 11/11, pas un lundi) est écartée ; celle du 16/11 est gardée
    expect(r).toEqual([
      { semaine: "2026-11-16", cle: "a", clics: 3, impressions: 40, positionSum: 2 * 10 + 4 * 30 },
    ]);
  });
});

describe("tâche ingestion-bing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clé absente : saute, aucun appel réseau, aucune écriture", async () => {
    const f = vi.fn();
    const { prisma } = fauxPrisma();
    const r = await tacheIngestionBing({ prisma, fetch: f as never, env: {}, maintenant });
    expect(r).toEqual({ issue: "saute", motif: "cle_absente" });
    expect(f).not.toHaveBeenCalled();
    expect(
      (prisma as never as { bingPageSemaine: { upsert: unknown } }).bingPageSemaine.upsert,
    ).not.toHaveBeenCalled();
  });

  it("écrit pages, requêtes filtrées et exploration ; rejouable sans doublon", async () => {
    const f = api({
      pages: [
        page("https://axion-ia.com/fr/blog/", "2026-11-10", 0, 1, 1),
        page("https://axion-ia.com/fr/blog/", "2026-11-16", 1, 10, 3),
        page("https://axion-ia.com/fr/blog/", "2026-11-17", 1, 10, 5),
        page("https://autre-site.example/x", "2026-11-17", 5, 5, 1),
      ],
      requetes: [
        page("formation ia", "2026-11-10", 0, 1, 1),
        page("formation ia", "2026-11-17", 1, 4, 6),
        page("elodie martin avocat", "2026-11-17", 1, 2, 1),
        page("contact jean@exemple.fr", "2026-11-17", 1, 2, 1),
      ],
      explo: [
        {
          Date: J("2026-11-25"),
          CrawledPages: 50,
          CrawlErrors: 3,
          InIndex: 400,
          Code4xx: 2,
          Code5xx: 1,
        },
      ],
    });
    const { prisma, t } = fauxPrisma();
    const r = await tacheIngestionBing({ prisma, fetch: f as never, env, maintenant });
    expect(r).toMatchObject({
      issue: "fait",
      pages: 1,
      requetes: 1,
      jours: 1,
      filtrees: 2,
      isolees: 1,
    });
    expect([...t.page.values()]).toEqual([
      expect.objectContaining({ chemin: "/fr/blog", clics: 2, impressions: 20, positionSum: 80 }),
    ]);
    expect([...t.requete.values()].map((l) => l["texte"])).toEqual(["formation ia"]);
    expect([...t.explo.values()][0]).toMatchObject({
      pagesExplorees: 50,
      erreursExploration: 3,
      pagesIndexees: 400,
    });
    // deuxième passage : mêmes lignes
    await tacheIngestionBing({ prisma, fetch: f as never, env, maintenant });
    expect(t.page.size).toBe(1);
    expect(t.requete.size).toBe(1);
    expect(t.explo.size).toBe(1);
  });

  it("quota (429) : arrêt immédiat, pas d'appel suivant, rien d'écrit après", async () => {
    const f = api({ pages: [] }, { GetPageStats: 429 });
    const { prisma, t } = fauxPrisma();
    const r = await tacheIngestionBing({ prisma, fetch: f as never, env, maintenant });
    expect(r).toEqual({ issue: "saute", motif: "quota" });
    expect(f).toHaveBeenCalledTimes(1);
    expect(t.page.size + t.requete.size + t.explo.size).toBe(0);
  });

  it("au plus trois appels par passage (quota de l'API respecté)", async () => {
    const f = api({});
    const { prisma } = fauxPrisma();
    await tacheIngestionBing({ prisma, fetch: f as never, env, maintenant });
    expect(f.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("une lecture en erreur plus loin n'efface pas ce qui est déjà écrit", async () => {
    const f = api(
      {
        pages: [
          page("https://axion-ia.com/fr", "2026-11-16", 1, 1, 1),
          page("https://axion-ia.com/fr", "2026-11-17", 1, 1, 1),
        ],
      },
      { GetQueryStats: 500 },
    );
    const { prisma, t } = fauxPrisma();
    const r = await tacheIngestionBing({ prisma, fetch: f as never, env, maintenant });
    expect(r).toMatchObject({
      issue: "fait",
      pages: 1,
      requetes: 0,
      erreurs: ["requetes:erreur_http"],
    });
    expect(t.page.size).toBe(1);
  });
});
