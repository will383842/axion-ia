/**
 * Tests du client Search Console « par lot » (P1 du pilotage SEO/GEO).
 * Aucun réseau : `fetch` et l'attente sont injectés. Aucun identifiant réel.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIG_ENV = { ...process.env };
const SECRETS = ["id-factice-xyz", "secret-factice-xyz", "refresh-factice-xyz"];

function poserIdentifiants(): void {
  process.env["GSC_PROPERTY_URL"] = "sc-domain:exemple.test";
  process.env["GSC_OAUTH_CLIENT_ID"] = SECRETS[0];
  process.env["GSC_OAUTH_CLIENT_SECRET"] = SECRETS[1];
  process.env["GSC_OAUTH_REFRESH_TOKEN"] = SECRETS[2];
}

type Rep = { status?: number; body?: unknown; headers?: Record<string, string> };

function reponse({ status = 200, body = {}, headers = {} }: Rep) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? headers[k] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const JETON = { body: { access_token: "AT", expires_in: 3600 } };

function fetchSequence(reps: Rep[]) {
  const f = vi.fn();
  for (const r of reps) f.mockResolvedValueOnce(reponse(r));
  return f;
}

function ligne(n: number) {
  return { keys: [`/p${n}`], clicks: 1, impressions: 10, ctr: 0.1, position: 3 };
}

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIG_ENV };
  poserIdentifiants();
});
afterEach(() => {
  process.env = ORIG_ENV;
});

const attente = () => vi.fn(async (_ms: number): Promise<void> => undefined);

describe("gscSearchAnalytics", () => {
  it("envoie dataState final, byPage et les dimensions demandées", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = fetchSequence([JETON, { body: { rows: [ligne(1)] } }]);
    const r = await gscSearchAnalytics(
      {
        startDate: "2026-11-01",
        endDate: "2026-11-01",
        dimensions: ["date", "page"],
        aggregationType: "byPage",
        dataState: "final",
      },
      { fetchImpl: f as unknown as typeof fetch, attendre: attente() },
    );
    expect(r.etat).toBe("ok");
    expect(r.rows).toHaveLength(1);
    const [url, init] = f.mock.calls[1] as [string, { body: string }];
    expect(url).toContain("sc-domain%3Aexemple.test/searchAnalytics/query");
    const corps = JSON.parse(init.body);
    expect(corps).toMatchObject({
      startDate: "2026-11-01",
      endDate: "2026-11-01",
      dimensions: ["date", "page"],
      aggregationType: "byPage",
      dataState: "final",
      type: "web",
      rowLimit: 25000,
      startRow: 0,
    });
  });

  it("pagine avec startRow et s'arrête sur une page incomplète", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = fetchSequence([
      JETON,
      { body: { rows: [ligne(1), ligne(2)] } },
      { body: { rows: [ligne(3), ligne(4)] } },
      { body: { rows: [ligne(5)] } },
    ]);
    const r = await gscSearchAnalytics(
      { startDate: "2026-11-01", endDate: "2026-11-01", dimensions: ["page"], rowLimit: 2 },
      { fetchImpl: f as unknown as typeof fetch, attendre: attente() },
    );
    expect(r.rows).toHaveLength(5);
    expect(r.complet).toBe(true);
    expect(f).toHaveBeenCalledTimes(4);
    const starts = f.mock.calls
      .slice(1)
      .map((c) => JSON.parse((c[1] as { body: string }).body).startRow);
    expect(starts).toEqual([0, 2, 4]);
  });

  it("s'arrête sur une page vide et respecte le nombre maximal de pages", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = fetchSequence([JETON, { body: { rows: [ligne(1), ligne(2)] } }, { body: {} }]);
    const r = await gscSearchAnalytics(
      { startDate: "2026-11-01", endDate: "2026-11-01", dimensions: ["page"], rowLimit: 2 },
      { fetchImpl: f as unknown as typeof fetch, attendre: attente() },
    );
    expect(r.rows).toHaveLength(2);
    expect(r.complet).toBe(true);

    const g = fetchSequence([
      JETON,
      { body: { rows: [ligne(1)] } },
      { body: { rows: [ligne(2)] } },
    ]);
    vi.resetModules();
    const m = await import("../gsc-client");
    const r2 = await m.gscSearchAnalytics(
      { startDate: "2026-11-01", endDate: "2026-11-01", dimensions: ["page"], rowLimit: 1 },
      { fetchImpl: g as unknown as typeof fetch, attendre: attente(), pagesMax: 2 },
    );
    expect(r2.rows).toHaveLength(2);
    expect(r2.complet).toBe(false);
  });

  it("réessaie sur 429 en respectant Retry-After", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = fetchSequence([
      JETON,
      { status: 429, headers: { "retry-after": "7" } },
      { body: { rows: [ligne(1)] } },
    ]);
    const att = attente();
    const r = await gscSearchAnalytics(
      { startDate: "2026-11-01", endDate: "2026-11-01", dimensions: ["page"] },
      { fetchImpl: f as unknown as typeof fetch, attendre: att },
    );
    expect(r.etat).toBe("ok");
    expect(att).toHaveBeenCalledWith(7000);
  });

  it("rend « quota » après des 429 répétés, avec un délai exponentiel", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = fetchSequence([JETON, { status: 429 }, { status: 429 }, { status: 429 }]);
    const att = attente();
    const r = await gscSearchAnalytics(
      { startDate: "2026-11-01", endDate: "2026-11-01", dimensions: ["page"] },
      { fetchImpl: f as unknown as typeof fetch, attendre: att, essaisMax: 2 },
    );
    expect(r.etat).toBe("quota");
    expect(att.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it("s'arrête net sur 403 quotaExceeded, sans réessai", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = fetchSequence([
      JETON,
      { status: 403, body: { error: { errors: [{ reason: "quotaExceeded" }] } } },
    ]);
    const att = attente();
    const r = await gscSearchAnalytics(
      { startDate: "2026-11-01", endDate: "2026-11-01", dimensions: ["page"] },
      { fetchImpl: f as unknown as typeof fetch, attendre: att },
    );
    expect(r.etat).toBe("quota");
    expect(f).toHaveBeenCalledTimes(2);
    expect(att).not.toHaveBeenCalled();
  });

  it("conserve les lignes déjà lues si une page suivante échoue", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = fetchSequence([JETON, { body: { rows: [ligne(1)] } }, { status: 500 }]);
    const r = await gscSearchAnalytics(
      { startDate: "2026-11-01", endDate: "2026-11-01", dimensions: ["page"], rowLimit: 1 },
      { fetchImpl: f as unknown as typeof fetch, attendre: attente() },
    );
    expect(r.etat).toBe("erreur");
    expect(r.complet).toBe(false);
    expect(r.rows).toHaveLength(1);
  });

  it("refuse des dates invalides sans appel réseau", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = vi.fn();
    const r = await gscSearchAnalytics(
      { startDate: "2026-11-05", endDate: "2026-11-01", dimensions: ["page"] },
      { fetchImpl: f as unknown as typeof fetch, attendre: attente() },
    );
    expect(r.etat).toBe("erreur");
    expect(f).not.toHaveBeenCalled();
  });

  it("rend « identifiants_absents » sans appel réseau", async () => {
    delete process.env["GSC_OAUTH_REFRESH_TOKEN"];
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = vi.fn();
    const r = await gscSearchAnalytics(
      { startDate: "2026-11-01", endDate: "2026-11-01", dimensions: ["page"] },
      { fetchImpl: f as unknown as typeof fetch, attendre: attente() },
    );
    expect(r.etat).toBe("identifiants_absents");
    expect(f).not.toHaveBeenCalled();
  });

  it("n'expose aucun identifiant dans les messages d'erreur", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => null },
      json: async () => ({}),
      text: async () => `invalid_grant ${SECRETS.join(" ")}`,
    });
    const r = await gscSearchAnalytics(
      { startDate: "2026-11-01", endDate: "2026-11-01", dimensions: ["page"] },
      { fetchImpl: f as unknown as typeof fetch, attendre: attente() },
    );
    expect(r.etat).toBe("refus");
    for (const s of SECRETS) expect(JSON.stringify(r)).not.toContain(s);
  });
});

describe("gscDernierJourFinal", () => {
  it("rend le plus récent jour de données finales", async () => {
    const { gscDernierJourFinal } = await import("../gsc-client");
    const f = fetchSequence([
      JETON,
      {
        body: {
          rows: [
            { keys: ["2026-11-20"], clicks: 1, impressions: 5, ctr: 0.2, position: 4 },
            { keys: ["2026-11-24"], clicks: 0, impressions: 3, ctr: 0, position: 6 },
            { keys: ["2026-11-22"], clicks: 0, impressions: 3, ctr: 0, position: 6 },
          ],
        },
      },
    ]);
    const r = await gscDernierJourFinal({
      fetchImpl: f as unknown as typeof fetch,
      attendre: attente(),
      maintenant: () => new Date("2026-11-27T10:00:00Z"),
    });
    expect(r).toEqual({ etat: "ok", jour: "2026-11-24" });
    const corps = JSON.parse((f.mock.calls[1]?.[1] as { body: string }).body);
    expect(corps.dataState).toBe("final");
    expect(corps.dimensions).toEqual(["date"]);
    expect(corps.endDate).toBe("2026-11-27");
    expect(corps.startDate).toBe("2026-11-13");
  });

  it("rend jour null (et non une date inventée) sans donnée", async () => {
    const { gscDernierJourFinal } = await import("../gsc-client");
    const f = fetchSequence([JETON, { body: {} }]);
    const r = await gscDernierJourFinal({
      fetchImpl: f as unknown as typeof fetch,
      attendre: attente(),
    });
    expect(r).toEqual({ etat: "ok", jour: null });
  });
});

describe("gscSonde", () => {
  const deps = (f: unknown) => ({ fetchImpl: f as typeof fetch, attendre: attente() });

  it("ok", async () => {
    const { gscSonde } = await import("../gsc-client");
    const f = fetchSequence([JETON, { body: { rows: [ligne(1)] } }]);
    expect(await gscSonde(deps(f))).toEqual({ etat: "ok" });
  });

  it("identifiants_absents", async () => {
    delete process.env["GSC_PROPERTY_URL"];
    const { gscSonde } = await import("../gsc-client");
    expect(await gscSonde(deps(vi.fn()))).toEqual({ etat: "identifiants_absents" });
  });

  it("refus (403 hors quota)", async () => {
    const { gscSonde } = await import("../gsc-client");
    const f = fetchSequence([
      JETON,
      { status: 403, body: { error: { errors: [{ reason: "forbidden" }] } } },
    ]);
    expect((await gscSonde(deps(f))).etat).toBe("refus");
  });

  it("quota", async () => {
    const { gscSonde } = await import("../gsc-client");
    const f = fetchSequence([
      JETON,
      { status: 403, body: { error: { errors: [{ reason: "quotaExceeded" }] } } },
    ]);
    expect((await gscSonde(deps(f))).etat).toBe("quota");
  });

  it("erreur (réseau en panne), sans lever d'exception", async () => {
    const { gscSonde } = await import("../gsc-client");
    const f = vi.fn().mockRejectedValue(new Error(`panne ${SECRETS[1]}`));
    const r = await gscSonde(deps(f));
    expect(r.etat).toBe("erreur");
    expect(JSON.stringify(r)).not.toContain(SECRETS[1]);
  });
});

describe("gscPageMetricsForUrlDates", () => {
  it("envoie les dates explicites et le filtre page", async () => {
    const { gscPageMetricsForUrlDates } = await import("../gsc-client");
    const f = fetchSequence([
      JETON,
      { body: { rows: [{ keys: [], clicks: 4, impressions: 100, ctr: 0.04, position: 7.5 }] } },
    ]);
    const r = await gscPageMetricsForUrlDates(
      "https://exemple.test/fr/blog/a",
      "2026-10-01",
      "2026-10-28",
      {
        fetchImpl: f as unknown as typeof fetch,
        attendre: attente(),
      },
    );
    expect(r).toEqual({ ctr: 0.04, impressions: 100, clicks: 4, position: 7.5 });
    const corps = JSON.parse((f.mock.calls[1]?.[1] as { body: string }).body);
    expect(corps.startDate).toBe("2026-10-01");
    expect(corps.endDate).toBe("2026-10-28");
    expect(corps.dimensionFilterGroups[0].filters[0]).toEqual({
      dimension: "page",
      operator: "equals",
      expression: "https://exemple.test/fr/blog/a",
    });
  });

  it("zéros explicites sans ligne ; null si l'API échoue (jamais 0 par erreur)", async () => {
    const { gscPageMetricsForUrlDates } = await import("../gsc-client");
    const f = fetchSequence([JETON, { body: {} }]);
    expect(
      await gscPageMetricsForUrlDates("https://exemple.test/x", "2026-10-01", "2026-10-28", {
        fetchImpl: f as unknown as typeof fetch,
        attendre: attente(),
      }),
    ).toEqual({ ctr: 0, impressions: 0, clicks: 0, position: 0 });

    vi.resetModules();
    const m = await import("../gsc-client");
    const g = fetchSequence([JETON, { status: 500 }]);
    expect(
      await m.gscPageMetricsForUrlDates("https://exemple.test/x", "2026-10-01", "2026-10-28", {
        fetchImpl: g as unknown as typeof fetch,
        attendre: attente(),
      }),
    ).toBeNull();
  });
});

describe("gsc-client-lot : corrections de relecture", () => {
  const P = { startDate: "2026-11-01", endDate: "2026-11-01", dimensions: ["page"] as const };
  const mk = (f: unknown, extra = {}) => ({
    fetchImpl: f as typeof fetch,
    attendre: attente(),
    ...extra,
  });

  it("essaisMax NaN : pas de boucle infinie (valeur par défaut)", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = vi
      .fn()
      .mockResolvedValueOnce(reponse(JETON))
      .mockResolvedValue(reponse({ status: 429 }));
    const r = await gscSearchAnalytics({ ...P }, mk(f, { essaisMax: Number.NaN }));
    expect(r.etat).toBe("quota");
    expect(f).toHaveBeenCalledTimes(5);
  });

  it("rowLimit, startRow et pagesMax hors bornes ou NaN sont normalisés", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = fetchSequence([JETON, { body: { rows: [ligne(1)] } }]);
    await gscSearchAnalytics(
      { ...P, rowLimit: 999999, startRow: 10 },
      mk(f, { pagesMax: Number.NaN }),
    );
    const corps = JSON.parse((f.mock.calls[1]?.[1] as { body: string }).body);
    expect(corps.rowLimit).toBe(25000);
    expect(corps.startRow).toBe(10);
    expect(corps).not.toHaveProperty("dataState");
    expect(corps).not.toHaveProperty("aggregationType");
    vi.resetModules();
    const m = await import("../gsc-client");
    const g = fetchSequence([JETON, { body: { rows: [ligne(1)] } }]);
    await m.gscSearchAnalytics({ ...P, rowLimit: Number.NaN, startRow: Number.NaN }, mk(g));
    const c2 = JSON.parse((g.mock.calls[1]?.[1] as { body: string }).body);
    expect(c2.rowLimit).toBe(25000);
    expect(c2.startRow).toBe(0);
  });

  it("401 : refus, puis jeton neuf au prochain appel", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = fetchSequence([JETON, { status: 401 }, JETON, { body: { rows: [] } }]);
    expect((await gscSearchAnalytics({ ...P }, mk(f))).etat).toBe("refus");
    expect((await gscSearchAnalytics({ ...P }, mk(f))).etat).toBe("ok");
    expect(f).toHaveBeenCalledTimes(4);
  });

  it.each([
    [{ error: { errors: [{ reason: "userRateLimitExceeded" }] } }],
    [{ error: { status: "RESOURCE_EXHAUSTED" } }],
  ])("403 de quota reconnu : %j", async (body) => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = fetchSequence([JETON, { status: 403, body }]);
    expect((await gscSearchAnalytics({ ...P }, mk(f))).etat).toBe("quota");
  });

  it("URL vide : refusée sans appel ; la variante rend null", async () => {
    const { gscSearchAnalytics, gscPageMetricsForUrlDates } = await import("../gsc-client");
    const f = vi.fn();
    expect((await gscSearchAnalytics({ ...P, pageEquals: " " }, mk(f))).etat).toBe("erreur");
    expect(await gscPageMetricsForUrlDates("", "2026-10-01", "2026-10-28", mk(f))).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("corps null ou rows non tableau : erreur, sans exception", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = fetchSequence([JETON, { body: null }]);
    expect((await gscSearchAnalytics({ ...P }, mk(f))).etat).toBe("erreur");
    vi.resetModules();
    const m = await import("../gsc-client");
    const g = fetchSequence([JETON, { body: { rows: "x" } }]);
    expect((await m.gscSearchAnalytics({ ...P }, mk(g))).etat).toBe("erreur");
  });

  it("propage premierJourIncomplet", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = fetchSequence([
      JETON,
      { body: { rows: [ligne(1)], metadata: { first_incomplete_date: "2026-11-25" } } },
    ]);
    const r = await gscSearchAnalytics({ ...P, dataState: "all" }, mk(f));
    expect(r.premierJourIncomplet).toBe("2026-11-25");
  });

  it("Retry-After plafonné à 60 s ; format date HTTP : attente exponentielle", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const att = attente();
    const f = fetchSequence([
      JETON,
      { status: 429, headers: { "retry-after": "3600" } },
      { status: 429, headers: { "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" } },
      { body: { rows: [] } },
    ]);
    await gscSearchAnalytics({ ...P }, { fetchImpl: f as unknown as typeof fetch, attendre: att });
    expect(att.mock.calls.map((c) => c[0])).toEqual([60000, 2000]);
  });

  it("sonde sur 429 : quota immédiat, sans attente", async () => {
    const { gscSonde } = await import("../gsc-client");
    const att = attente();
    const f = fetchSequence([JETON, { status: 429 }]);
    expect(await gscSonde({ fetchImpl: f as unknown as typeof fetch, attendre: att })).toEqual({
      etat: "quota",
    });
    expect(att).not.toHaveBeenCalled();
  });

  it("OAuth 5xx : erreur ; date impossible : erreur sans appel", async () => {
    const { gscSearchAnalytics } = await import("../gsc-client");
    const f = fetchSequence([{ status: 503 }]);
    expect((await gscSearchAnalytics({ ...P }, mk(f))).etat).toBe("erreur");
    const g = vi.fn();
    const r = await gscSearchAnalytics(
      { ...P, startDate: "2026-02-30", endDate: "2026-03-01" },
      mk(g),
    );
    expect(r.etat).toBe("erreur");
    expect(g).not.toHaveBeenCalled();
  });
});
