import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
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
      ligne(["https://chat.openai.com/"], 5, 6),
      ligne(["perplexity.ai"], 3, 3),
      ligne(["google.com"], 99, 99),
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
      ligne(["2026-11-02", "chatgpt.com"], 4, 5),
      ligne(["2026-11-09", "chatgpt.com"], 1, 1),
      ligne(["2026-11-09", "bing.com"], 50, 50),
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
    const f = vi.spyOn(globalThis, "fetch");
    const r = await lireVisitesIA();
    expect(r.statut).toBe("indisponible");
    expect(f).not.toHaveBeenCalled();
  });

  it("indisponible au build (stubs), sans appel réseau", async () => {
    process.env.PLAUSIBLE_API_KEY = "cle-de-test";
    process.env.PLAUSIBLE_SITE_ID = "site-test";
    process.env.SKIP_ENV_VALIDATION = "true";
    const f = vi.spyOn(globalThis, "fetch");
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

  it("rend les données depuis des réponses v2 simulées, et met en cache", async () => {
    process.env.PLAUSIBLE_API_KEY = "cle-de-test";
    process.env.PLAUSIBLE_SITE_ID = "site-test";
    delete process.env.SKIP_ENV_VALIDATION;
    const f = vi.spyOn(globalThis, "fetch").mockImplementation(async (_u, init) => {
      const q = JSON.parse(String((init as RequestInit).body));
      const dims: string[] = q.dimensions;
      let results;
      if (dims.includes("time:week")) results = [ligne(["2026-11-09", "claude.ai"], 2, 2)];
      else if (dims.includes("visit:entry_page")) results = [ligne(["/fr/a", "claude.ai"], 2, 2)];
      else results = [ligne(["chatgpt.com"], 7, 8)];
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
    const n = f.mock.calls.length;
    await lireVisitesIA();
    expect(f.mock.calls.length).toBe(n);
    const init = f.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
  });
});
