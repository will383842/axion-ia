import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SOURCES_PLAUSIBLE,
  LIBELLES_IA,
  plageHebdoParis,
  agregerParIA,
  agregerPagesIA,
  agregerSemainesIA,
  lireVisitesIA,
  _viderCacheVisitesIA,
} from "@/server/analytics/visites-ia";

const ligne = (dimensions: string[], visitors: number, visits: number) => ({
  dimensions,
  metrics: [visitors, visits],
});

describe("parsing des réponses Plausible", () => {
  it("regroupe par IA et ignore les référents non IA", () => {
    const r = agregerParIA([
      ligne(["chatgpt.com"], 10, 12),
      ligne(["ChatGPT"], 5, 6),
      ligne(["perplexity.ai"], 3, 3),
      ligne(["Google"], 99, 99),
    ]);
    expect(r.parIA).toEqual([
      { id: "chatgpt", libelle: "ChatGPT", visiteurs: 15, visites: 18 },
      { id: "perplexity", libelle: "Perplexity", visiteurs: 3, visites: 3 },
    ]);
    expect(r.visiteurs).toBe(18);
    expect(r.visites).toBe(21);
  });

  it("agrège les semaines et les pages d'arrivée (top 10)", () => {
    const s = agregerSemainesIA([
      ligne(["2026-11-02", "claude.ai"], 2, 2),
      ligne(["2026-11-02", "ChatGPT"], 4, 5),
      ligne(["2026-11-09", "chatgpt.com"], 1, 1),
      ligne(["2026-11-09", "Bing"], 50, 50),
    ]);
    expect(s).toEqual([
      { debut: "2026-11-02", visiteurs: 6, visites: 7 },
      { debut: "2026-11-09", visiteurs: 1, visites: 1 },
    ]);
    const rows = Array.from({ length: 14 }, (_, i) =>
      ligne([`/fr/p${i}`, "chatgpt.com"], 20 - i, 20 - i),
    );
    rows.push(ligne(["/fr/p0", "perplexity.ai"], 1, 1), ligne(["/fr/x", "google.com"], 99, 99));
    const p = agregerPagesIA(rows);
    expect(p).toHaveLength(10);
    expect(p[0]).toEqual({ page: "/fr/p0", visiteurs: 21, visites: 21 });
    expect(p.find((x) => x.page === "/fr/x")).toBeUndefined();
  });

  it("tolère des lignes malformées", () => {
    const sale = [{ dimensions: [], metrics: [] }, ligne(["claude.ai"], 1, 1)];
    expect(agregerParIA(sale as never).visiteurs).toBe(1);
    expect(agregerParIA(undefined as never).visiteurs).toBe(0);
  });
});

describe("lireVisitesIA — échec silencieux", () => {
  const sauve = { ...process.env };
  beforeEach(() => {
    _viderCacheVisitesIA();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    process.env = { ...sauve };
  });

  it("indisponible sans clé, sans appel réseau", async () => {
    delete process.env.PLAUSIBLE_API_KEY;
    const f = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ne doit pas être appelé"));
    const r = await lireVisitesIA();
    expect(r.statut).toBe("indisponible");
    expect(f).not.toHaveBeenCalled();
  });

  it("indisponible au build (stubs), sans appel réseau", async () => {
    process.env.PLAUSIBLE_API_KEY = "cle-de-test";
    process.env.PLAUSIBLE_SITE_ID = "site-test";
    process.env.SKIP_ENV_VALIDATION = "true";
    const f = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ne doit pas être appelé"));
    expect((await lireVisitesIA()).statut).toBe("indisponible");
    expect(f).not.toHaveBeenCalled();
  });

  it("indisponible si l'API est injoignable ou répond en erreur", async () => {
    process.env.PLAUSIBLE_API_KEY = "cle-de-test";
    process.env.PLAUSIBLE_SITE_ID = "site-test";
    delete process.env.SKIP_ENV_VALIDATION;
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("réseau"));
    expect((await lireVisitesIA()).statut).toBe("indisponible");
    _viderCacheVisitesIA();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 500 }));
    expect((await lireVisitesIA()).statut).toBe("indisponible");
  });

  it("rend les données depuis des réponses v2 simulées, envoie la bonne requête et met en cache", async () => {
    process.env.PLAUSIBLE_API_KEY = "cle-de-test";
    process.env.PLAUSIBLE_SITE_ID = "site-test";
    delete process.env.SKIP_ENV_VALIDATION;
    const corps: Array<Record<string, unknown>> = [];
    const f = vi.spyOn(globalThis, "fetch").mockImplementation(async (_u, init) => {
      const q = JSON.parse(String((init as RequestInit).body));
      corps.push(q);
      const dims: string[] = q.dimensions;
      let results;
      if (dims.includes("time:week")) results = [ligne(["2026-11-09", "Claude", ""], 2, 2)];
      else if (dims.includes("visit:entry_page")) results = [ligne(["/fr/a", "Claude", ""], 2, 2)];
      else results = [ligne(["ChatGPT", ""], 7, 8)];
      return new Response(JSON.stringify({ results }), { status: 200 });
    });
    const r = await lireVisitesIA();
    expect(r.statut).toBe("ok");
    if (r.statut === "ok") {
      expect(r.sept.visiteurs).toBe(7);
      expect(r.trente.parIA[0]?.id).toBe("chatgpt");
      expect(r.semaines[0]?.visiteurs).toBe(2);
      expect(r.pages[0]?.page).toBe("/fr/a");
    }
    expect(corps).toHaveLength(4);
    const plages = corps.map((q) => q.date_range);
    expect(plages.filter((x) => x === "7d")).toHaveLength(1);
    expect(plages.filter((x) => x === "30d")).toHaveLength(2);
    const hebdo = corps.find((q) => (q.dimensions as string[]).includes("time:week"))!;
    expect(hebdo.dimensions).toEqual(["time:week", "visit:source", "visit:referrer"]);
    const [debut, fin] = hebdo.date_range as [string, string];
    expect(new Date(`${debut}T00:00:00Z`).getUTCDay()).toBe(1); // un lundi
    const jours = (Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86_400_000;
    expect(jours).toBeGreaterThanOrEqual(77); // 11 semaines + le lundi, semaine en cours incluse
    expect(jours).toBeLessThanOrEqual(83);
    const sources = Object.values(SOURCES_PLAUSIBLE).flat();
    for (const q of corps) {
      expect(q.site_id).toBe("site-test");
      const [ou, [filtreSource, filtreBing]] = (q.filters as unknown[][])[0] as [
        string,
        unknown[][],
      ];
      expect(ou).toBe("or");
      expect(filtreSource).toEqual(["is", "visit:source", sources]);
      expect(filtreBing).toEqual(["contains", "visit:referrer", ["bing.com/chat"]]);
      expect(q.dimensions as string[]).toContain("visit:source");
    }
    const n = f.mock.calls.length;
    await lireVisitesIA();
    expect(f.mock.calls.length).toBe(n);
    const init = f.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
  });

  it("repli v1 : 404 sur la v2 → breakdown v1 7d/30d sur visit:source, sans courbe", async () => {
    process.env.PLAUSIBLE_API_KEY = "cle-de-test";
    process.env.PLAUSIBLE_SITE_ID = "site-test";
    delete process.env.SKIP_ENV_VALIDATION;
    const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (u) => {
      const url = String(u);
      urls.push(url);
      if (url.includes("/api/v2/query")) return new Response("{}", { status: 404 });
      return new Response(
        JSON.stringify({ results: [{ source: "ChatGPT", visitors: 4, visits: 5 }] }),
        {
          status: 200,
        },
      );
    });
    const r = await lireVisitesIA();
    expect(r.statut).toBe("ok");
    if (r.statut === "ok") {
      expect(r.serieHebdo).toBe(false);
      expect(r.sept.visiteurs).toBe(4);
      expect(r.semaines).toEqual([]);
      expect(r.pages).toEqual([]);
    }
    const v1 = urls
      .filter((u) => u.includes("/api/v1/stats/breakdown"))
      .map((u) => new URL(u).searchParams);
    expect(v1).toHaveLength(2);
    expect(v1.map((p) => p.get("period")).sort()).toEqual(["30d", "7d"]);
    for (const p of v1) {
      expect(p.get("site_id")).toBe("site-test");
      expect(p.get("property")).toBe("visit:source");
      expect(p.get("filters")).toBe(
        `visit:source==${Object.values(SOURCES_PLAUSIBLE).flat().join("|")}`,
      );
    }
  });

  it("met aussi en cache l'indisponibilité (60 s)", async () => {
    process.env.PLAUSIBLE_API_KEY = "cle-de-test";
    process.env.PLAUSIBLE_SITE_ID = "site-test";
    delete process.env.SKIP_ENV_VALIDATION;
    const f = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("lent"));
    await lireVisitesIA();
    const n = f.mock.calls.length;
    await lireVisitesIA();
    expect(f.mock.calls.length).toBe(n);
  });
});

describe("tables serveur et période hebdomadaire", () => {
  it("chaque IA a un libellé et au moins une source", () => {
    for (const id of Object.keys(LIBELLES_IA)) {
      expect(SOURCES_PLAUSIBLE[id as keyof typeof SOURCES_PLAUSIBLE].length).toBeGreaterThan(0);
    }
  });
  it("plageHebdoParis : lundi d'il y a 11 semaines → aujourd'hui (Paris)", () => {
    // jeudi 19/11/2026 12:00 UTC → lundi 31/08/2026
    expect(plageHebdoParis(new Date("2026-11-19T12:00:00Z"))).toEqual(["2026-08-31", "2026-11-19"]);
    // 23:30 UTC = 00:30 le lendemain à Paris (vendredi 20/11)
    expect(plageHebdoParis(new Date("2026-11-19T23:30:00Z"))[1]).toBe("2026-11-20");
    expect(plageHebdoParis(new Date("2026-11-19T23:30:00Z"))[0]).toBe("2026-08-31");
  });
});
