/**
 * Tests gsc-client — OAuth refresh + searchAnalytics query.
 *
 * Mock fetch global (vitest-environment node). On vérifie :
 *  - Skip silencieux si credentials absents (graceful degrade)
 *  - OAuth token request avec bons params
 *  - searchAnalytics query avec bon filter `page`
 *  - Cache access_token (2e appel = pas de re-refresh)
 *  - Error API = retourne null (worker continue)
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  process.env = { ...ORIG_ENV };
});

afterEach(() => {
  process.env = ORIG_ENV;
});

describe("gsc-client", () => {
  it("retourne null si GSC_PROPERTY_URL absent (graceful degrade)", async () => {
    delete process.env["GSC_PROPERTY_URL"];
    const { gscTopKeywordsForUrl } = await import("../gsc-client");
    const r = await gscTopKeywordsForUrl("https://axion-ia.com/fr/x", 28, 10);
    expect(r).toBeNull();
  });

  it("retourne null si OAuth client_id absent (graceful degrade)", async () => {
    process.env["GSC_PROPERTY_URL"] = "sc-domain:axion-ia.com";
    delete process.env["GSC_OAUTH_CLIENT_ID"];
    process.env["GSC_OAUTH_CLIENT_SECRET"] = "secret";
    process.env["GSC_OAUTH_REFRESH_TOKEN"] = "token";

    const { gscTopKeywordsForUrl } = await import("../gsc-client");
    const r = await gscTopKeywordsForUrl("https://axion-ia.com/fr/x", 28, 10);
    expect(r).toBeNull();
  });

  it("fait l'OAuth refresh + query searchAnalytics avec bon filter page", async () => {
    process.env["GSC_PROPERTY_URL"] = "sc-domain:axion-ia.com";
    process.env["GSC_OAUTH_CLIENT_ID"] = "client-id";
    process.env["GSC_OAUTH_CLIENT_SECRET"] = "client-secret";
    process.env["GSC_OAUTH_REFRESH_TOKEN"] = "refresh-token";

    const fetchMock = vi.fn();
    // 1er appel : OAuth refresh
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "AT_FAKE", expires_in: 3600 }),
    });
    // 2e appel : searchAnalytics query
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        rows: [
          { keys: ["audit ia paris"], clicks: 12, impressions: 340, ctr: 0.035, position: 4.2 },
          { keys: ["cabinet ia"], clicks: 7, impressions: 220, ctr: 0.032, position: 6.1 },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { gscTopKeywordsForUrl } = await import("../gsc-client");
    const r = await gscTopKeywordsForUrl("https://axion-ia.com/fr/blog/x", 28, 10);

    expect(r).not.toBeNull();
    expect(r).toHaveLength(2);
    expect(r?.[0]).toEqual({
      keyword: "audit ia paris",
      position: 4.2,
      ctr: 0.035,
      impressions: 340,
      clicks: 12,
    });

    // OAuth call
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        method: "POST",
      }),
    );
    // GSC call
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aaxion-ia.com/searchAnalytics/query",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer AT_FAKE" }),
      }),
    );

    // Vérifier filter page dans body
    const body = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(body.dimensions).toEqual(["query"]);
    expect(body.dimensionFilterGroups[0].filters[0]).toEqual({
      dimension: "page",
      operator: "equals",
      expression: "https://axion-ia.com/fr/blog/x",
    });
    expect(body.rowLimit).toBe(10);
  });

  it("cache l'access_token (2e appel = pas de re-refresh)", async () => {
    process.env["GSC_PROPERTY_URL"] = "sc-domain:axion-ia.com";
    process.env["GSC_OAUTH_CLIENT_ID"] = "id";
    process.env["GSC_OAUTH_CLIENT_SECRET"] = "secret";
    process.env["GSC_OAUTH_REFRESH_TOKEN"] = "rt";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "AT", expires_in: 3600 }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ rows: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { gscTopKeywordsForUrl } = await import("../gsc-client");
    await gscTopKeywordsForUrl("https://axion-ia.com/a", 28, 10);
    await gscTopKeywordsForUrl("https://axion-ia.com/b", 28, 10);
    await gscTopKeywordsForUrl("https://axion-ia.com/c", 28, 10);

    // 1 OAuth refresh + 3 GSC queries = 4 calls (pas 6)
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("retourne null si OAuth refresh échoue (graceful)", async () => {
    process.env["GSC_PROPERTY_URL"] = "sc-domain:axion-ia.com";
    process.env["GSC_OAUTH_CLIENT_ID"] = "id";
    process.env["GSC_OAUTH_CLIENT_SECRET"] = "secret";
    process.env["GSC_OAUTH_REFRESH_TOKEN"] = "bad-token";

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"error":"invalid_grant"}',
    });
    vi.stubGlobal("fetch", fetchMock);

    const { gscTopKeywordsForUrl } = await import("../gsc-client");
    const r = await gscTopKeywordsForUrl("https://axion-ia.com/x", 28, 10);
    expect(r).toBeNull();
  });

  it("retourne null si GSC query 403/5xx (graceful)", async () => {
    process.env["GSC_PROPERTY_URL"] = "sc-domain:axion-ia.com";
    process.env["GSC_OAUTH_CLIENT_ID"] = "id";
    process.env["GSC_OAUTH_CLIENT_SECRET"] = "secret";
    process.env["GSC_OAUTH_REFRESH_TOKEN"] = "rt";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "AT", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => '{"error":{"message":"Insufficient permissions"}}',
      });
    vi.stubGlobal("fetch", fetchMock);

    const { gscTopKeywordsForUrl } = await import("../gsc-client");
    const r = await gscTopKeywordsForUrl("https://axion-ia.com/x", 28, 10);
    expect(r).toBeNull();
  });
});
