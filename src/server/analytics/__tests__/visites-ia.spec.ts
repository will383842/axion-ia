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

// Liste littérale attendue (ne dépend pas de SOURCES_PLAUSIBLE) ; ordre = ordre des IA.
const SOURCES_ATTENDUES = [
  "ChatGPT",
  "chatgpt.com",
  "chat.openai.com",
  "Perplexity",
  "perplexity.ai",
  "pplx.ai",
  "Copilot",
  "Microsoft Copilot",
  "copilot.microsoft.com",
  "copilot.com",
  "Gemini",
  "Google Gemini",
  "gemini.google.com",
  "bard.google.com",
  "Mistral",
  "chat.mistral.ai",
  "mistral.ai",
  "Claude",
  "claude.ai",
  "DeepSeek",
  "chat.deepseek.com",
  "deepseek.com",
  "You.com",
  "you.com",
  "Phind",
  "phind.com",
];

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
    process.env.NEXT_PHASE = "phase-production-build";
    const f = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ne doit pas être appelé"));
    expect((await lireVisitesIA()).statut).toBe("indisponible");
    expect(f).not.toHaveBeenCalled();
  });

  it("SKIP_ENV_VALIDATION seule (exécution, hors build) n'éteint pas la mesure", async () => {
    process.env.PLAUSIBLE_API_KEY = "cle-de-test";
    process.env.PLAUSIBLE_SITE_ID = "site-test";
    process.env.SKIP_ENV_VALIDATION = "true";
    delete process.env.NEXT_PHASE;
    process.env.DATABASE_URL = "postgresql://u:p@db.example:5432/x";
    const f = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify({ results: [] }), { status: 200 }),
      );
    expect((await lireVisitesIA()).statut).toBe("ok");
    expect(f).toHaveBeenCalled();
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
    const sources = SOURCES_ATTENDUES;
    for (const q of corps) {
      expect(q.site_id).toBe("site-test");
      const [ou, [filtreSource, filtreBing]] = (q.filters as unknown[][])[0] as [
        string,
        unknown[][],
      ];
      expect(ou).toBe("or");
      expect(filtreSource).toEqual(["is", "visit:source", sources]);
      expect(filtreBing).toEqual([
        "contains",
        "visit:referrer",
        [
          "chatgpt.com",
          "chat.openai.com",
          "perplexity.ai",
          "copilot.microsoft.com",
          "gemini.google.com",
          "bard.google.com",
          "chat.mistral.ai",
          "mistral.ai",
          "claude.ai",
          "chat.deepseek.com",
          "you.com",
          "phind.com",
          "bing.com/chat",
        ],
      ]);
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
    const sources = SOURCES_ATTENDUES;
    const v1 = urls
      .filter((u) => u.includes("/api/v1/stats/breakdown"))
      .map((u) => new URL(u).searchParams);
    expect(v1.map((p) => p.get("period")).sort()).toEqual(["30d", "30d", "7d", "7d"]);
    expect(v1).toHaveLength(4);
    for (const p of v1) {
      expect(p.get("site_id")).toBe("site-test");
      const parSource = p.get("property") === "visit:source";
      expect(p.get("filters")).toBe(
        parSource
          ? `visit:source==${sources.join("|")}`
          : `visit:referrer=~gemini\\.google\\.com|bard\\.google\\.com;visit:source!=${sources.join("|")}`,
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

// ─── Plausible simulé avec des valeurs RÉELLES (v3.0.1, version de production) ──────────
// Valeurs lues dans `lib/plausible/ingestion/source.ex` + `priv/ref_inspector/referers.yml` :
// un référent est d'abord rangé par RefInspector, sous-domaines compris (`gemini.google.com`
// → source « Google ») ; un `utm_source` est stocké tel quel.
// Chaque ligne : [visit:source, visit:referrer, IA attendue (écrite en dur), visiteurs].
const REELLES: Array<[string, string, string | null, number]> = [
  ["chatgpt.com", "chatgpt.com", "chatgpt", 1],
  ["Perplexity", "perplexity.ai", "perplexity", 1],
  ["copilot.microsoft.com", "copilot.microsoft.com", "copilot", 1],
  ["Google", "gemini.google.com", "gemini", 1],
  ["Bing", "bing.com/chat", "copilot", 1],
  ["claude.ai", "claude.ai", "claude", 1],
  ["chat.mistral.ai", "chat.mistral.ai", "mistral", 1],
  ["chat.deepseek.com", "chat.deepseek.com", "deepseek", 1],
  ["you.com", "you.com", "you", 1],
  ["phind.com", "phind.com", "phind", 1],
  // Variantes de nommage des versions plus récentes de Plausible.
  ["Google Gemini", "gemini.google.com", "gemini", 1],
  ["Microsoft Copilot", "copilot.microsoft.com", "copilot", 1],
  // Bruit : jamais compté.
  ["Google", "google.com", null, 50],
  ["Bing", "bing.com", null, 50],
  ["Direct / None", "", null, 50],
];

type Ligne = [string, string, string | null, number];
const champ = (l: Ligne, p: string) => (p === "visit:source" ? l[0] : l[1]);

/** Évalue un filtre v2 (`or`, `is`, `contains`) comme Plausible. */
function v2Retient(f: unknown[], l: Ligne): boolean {
  const [op, a, b] = f as [string, unknown, unknown];
  if (op === "or") return (a as unknown[][]).some((x) => v2Retient(x, l));
  const v = champ(l, a as string);
  if (op === "is") return (b as string[]).includes(v);
  if (op === "contains") return (b as string[]).some((s) => v.includes(s));
  throw new Error(`opérateur inconnu ${op}`);
}

/** Évalue un filtre v1 (`prop==a|b`, `prop=~re`, `prop!=a|b`, séparés par `;`). */
function v1Retient(filtre: string, l: Ligne): boolean {
  return filtre.split(";").every((c) => {
    const m = /^(visit:[a-z_]+)(==|=~|!=)(.*)$/.exec(c)!;
    const v = champ(l, m[1]!);
    if (m[2] === "==") return m[3]!.split("|").includes(v);
    if (m[2] === "!=") return !m[3]!.split("|").includes(v);
    return new RegExp(m[3]!).test(v);
  });
}

describe("Plausible simulé : toutes les IA arrivent jusqu'au décompte (v2 puis repli v1)", () => {
  const sauve = { ...process.env };
  beforeEach(() => {
    _viderCacheVisitesIA();
    vi.restoreAllMocks();
    process.env.PLAUSIBLE_API_KEY = "cle-de-test";
    process.env.PLAUSIBLE_SITE_ID = "site-test";
    delete process.env.SKIP_ENV_VALIDATION;
  });
  afterEach(() => {
    process.env = { ...sauve };
  });
  const attendu = (ids: string[]) =>
    REELLES.filter((l) => l[2] && ids.includes(l[2])).reduce((s, l) => s + l[3], 0);

  it("v2 : le filtre demandé retient chaque ligne IA réelle, et elle est comptée", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_u, init) => {
      const q = JSON.parse(String((init as RequestInit).body));
      const dims: string[] = q.dimensions;
      const results = REELLES.filter((l) => v2Retient(q.filters[0], l)).map((l) => ({
        dimensions: dims.map((d) =>
          d === "visit:source" ? l[0] : d === "visit:referrer" ? l[1] : "/x",
        ),
        metrics: [l[3], l[3]],
      }));
      return new Response(JSON.stringify({ results }), { status: 200 });
    });
    const r = await lireVisitesIA();
    if (r.statut !== "ok") throw new Error("attendu ok");
    const tous = [
      "chatgpt",
      "perplexity",
      "copilot",
      "gemini",
      "claude",
      "mistral",
      "deepseek",
      "you",
      "phind",
    ];
    expect(r.sept.parIA.map((x) => x.id).sort()).toEqual([...tous].sort());
    expect(r.sept.visiteurs).toBe(attendu(tous));
    expect(r.sept.parIA.find((x) => x.id === "gemini")?.visiteurs).toBe(2);
    expect(r.sept.parIA.find((x) => x.id === "copilot")?.visiteurs).toBe(3);
  });

  it("repli v1 : Gemini (source « Google ») est aussi compté", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (u) => {
      const url = String(u);
      if (url.includes("/api/v2/query")) return new Response("{}", { status: 404 });
      const p = new URL(url).searchParams;
      const prop = p.get("property")!;
      const cle = prop.replace("visit:", "");
      const m = new Map<string, number>();
      for (const l of REELLES) {
        if (!v1Retient(p.get("filters")!, l)) continue;
        m.set(champ(l, prop), (m.get(champ(l, prop)) ?? 0) + l[3]);
      }
      const results = [...m].map(([v, n]) => ({ [cle]: v, visitors: n, visits: n }));
      return new Response(JSON.stringify({ results }), { status: 200 });
    });
    const r = await lireVisitesIA();
    if (r.statut !== "ok") throw new Error("attendu ok");
    expect(r.serieHebdo).toBe(false);
    expect(r.sept.parIA.find((x) => x.id === "gemini")?.visiteurs).toBe(2);
    // Pas de double compte : la v1 ne peut compter Bing/chat (copilot) que par la source.
    const tous = [
      "chatgpt",
      "perplexity",
      "copilot",
      "gemini",
      "claude",
      "mistral",
      "deepseek",
      "you",
      "phind",
    ];
    expect(r.sept.visiteurs).toBe(attendu(tous) - 1); // tout sauf la ligne Bing/chat
  });
});

// Point 3 : valeurs réelles écrites en dur → IA attendue ; chacune doit être retenue
// par le filtre ET classée (la liste n'est pas comparée à elle-même).
describe("valeurs réelles de Plausible → IA", () => {
  const CAS: Array<[string, string, string]> = [
    ["chatgpt.com", "", "chatgpt"],
    ["Perplexity", "", "perplexity"],
    ["copilot.microsoft.com", "", "copilot"],
    ["Google", "gemini.google.com", "gemini"],
    ["Bing", "bing.com/chat", "copilot"],
    ["claude.ai", "", "claude"],
    ["chat.mistral.ai", "", "mistral"],
    ["chat.deepseek.com", "", "deepseek"],
    ["you.com", "", "you"],
    ["phind.com", "", "phind"],
    ["Google Gemini", "", "gemini"],
    ["Microsoft Copilot", "", "copilot"],
  ];
  it.each(CAS)("%s / %s → %s", async (source, referent, ia) => {
    process.env.PLAUSIBLE_API_KEY = "cle";
    process.env.PLAUSIBLE_SITE_ID = "s";
    delete process.env.SKIP_ENV_VALIDATION;
    _viderCacheVisitesIA();
    const demandes: unknown[][] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_u, init) => {
      demandes.push(JSON.parse(String((init as RequestInit).body)).filters[0]);
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });
    await lireVisitesIA();
    const ligne2: Ligne = [source, referent, ia, 1];
    expect(v2Retient(demandes[0]!, ligne2)).toBe(true);
    expect(agregerParIA([{ dimensions: [source, referent], metrics: [1, 1] }]).parIA[0]?.id).toBe(
      ia,
    );
  });
});
