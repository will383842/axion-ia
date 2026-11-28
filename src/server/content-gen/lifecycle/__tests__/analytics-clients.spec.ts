import { beforeEach, describe, expect, it, vi } from "vitest";

const gscPageMetricsForUrl = vi.fn();
vi.mock("@/server/content-gen/seo/gsc-client", () => ({ gscPageMetricsForUrl }));
const accesBase = vi.fn();
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    accesBase();
    return {};
  },
}));
const metriquesPageDepuisHistorique = vi.fn();
vi.mock("@/server/seo-pilotage/recalcul", () => ({ metriquesPageDepuisHistorique }));

const { fetchSearchConsoleCtr } = await import("../analytics-clients");
const URL_PAGE = "https://axion-ia.com/fr/blog/a";
const API = { ctr: 0.02, impressions: 500, clicks: 10, position: 7 };

describe("fetchSearchConsoleCtr (P6a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CONTENT_PILOTAGE_SEO;
    process.env.DATABASE_URL = "postgresql://u:p@db:5432/x";
    gscPageMetricsForUrl.mockResolvedValue(API);
  });

  it("interrupteur éteint : ancien chemin (API), la base n'est pas touchée", async () => {
    expect(await fetchSearchConsoleCtr(URL_PAGE, 14)).toEqual(API);
    expect(accesBase).not.toHaveBeenCalled();
    expect(metriquesPageDepuisHistorique).not.toHaveBeenCalled();
  });

  it("allumé et historique suffisant : lit la table, AUCUN appel Google", async () => {
    process.env.CONTENT_PILOTAGE_SEO = "true";
    const h = { ctr: 0.01, impressions: 100, clicks: 1, position: 6 };
    metriquesPageDepuisHistorique.mockResolvedValue(h);
    expect(await fetchSearchConsoleCtr(URL_PAGE, 14)).toEqual(h);
    expect(metriquesPageDepuisHistorique).toHaveBeenCalledWith({}, URL_PAGE, 14);
    expect(gscPageMetricsForUrl).not.toHaveBeenCalled();
  });

  it("allumé mais historique insuffisant (null) : repli sur l'API", async () => {
    process.env.CONTENT_PILOTAGE_SEO = "true";
    metriquesPageDepuisHistorique.mockResolvedValue(null);
    expect(await fetchSearchConsoleCtr(URL_PAGE, 30)).toEqual(API);
    expect(gscPageMetricsForUrl).toHaveBeenCalledTimes(1);
  });

  it("allumé, table absente ou panne : repli sur l'API, sans échec", async () => {
    process.env.CONTENT_PILOTAGE_SEO = "true";
    metriquesPageDepuisHistorique.mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "P2021" }),
    );
    expect(await fetchSearchConsoleCtr(URL_PAGE, 14)).toEqual(API);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    metriquesPageDepuisHistorique.mockRejectedValueOnce(new Error("réseau"));
    expect(await fetchSearchConsoleCtr(URL_PAGE, 14)).toEqual(API);
  });

  it("build stub : ancien chemin", async () => {
    process.env.CONTENT_PILOTAGE_SEO = "true";
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
    expect(await fetchSearchConsoleCtr(URL_PAGE, 14)).toEqual(API);
    expect(metriquesPageDepuisHistorique).not.toHaveBeenCalled();
  });
});
