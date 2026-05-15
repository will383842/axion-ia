/**
 * Tests indexing-client — OAuth refresh + Google Indexing API publish.
 *
 * Mock fetch global. Vérifie :
 *  - Skip silencieux si credentials absents (graceful degrade)
 *  - OAuth token request avec bons params
 *  - POST publish urlNotifications avec bon payload + Bearer
 *  - Cache access_token mutualisé (2 publish = 1 refresh + 2 publish)
 *  - Error API 4xx = return false (worker continue sans retry)
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

describe("indexing-client", () => {
  it("retourne false si INDEXING_OAUTH_REFRESH_TOKEN absent", async () => {
    delete process.env["INDEXING_OAUTH_REFRESH_TOKEN"];
    process.env["GSC_OAUTH_CLIENT_ID"] = "id";
    process.env["GSC_OAUTH_CLIENT_SECRET"] = "secret";
    const { indexingPublishUrl, isIndexingApiReady } = await import("../indexing-client");
    expect(isIndexingApiReady()).toBe(false);
    expect(await indexingPublishUrl("https://axion-ia.com/x", "URL_UPDATED")).toBe(false);
  });

  it("publie correctement avec OAuth refresh + Bearer", async () => {
    process.env["GSC_OAUTH_CLIENT_ID"] = "id";
    process.env["GSC_OAUTH_CLIENT_SECRET"] = "secret";
    process.env["INDEXING_OAUTH_REFRESH_TOKEN"] = "rt-indexing";

    const fetchMock = vi.fn();
    // OAuth refresh
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "AT_IDX", expires_in: 3600 }),
    });
    // Publish urlNotifications
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => '{"urlNotificationMetadata":{}}',
    });
    vi.stubGlobal("fetch", fetchMock);

    const { indexingPublishUrl } = await import("../indexing-client");
    const ok = await indexingPublishUrl("https://axion-ia.com/fr/actualites/test", "URL_UPDATED");
    expect(ok).toBe(true);

    // OAuth call
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );

    // Indexing publish call
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://indexing.googleapis.com/v3/urlNotifications:publish",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer AT_IDX" }),
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(body).toEqual({
      url: "https://axion-ia.com/fr/actualites/test",
      type: "URL_UPDATED",
    });
  });

  it("cache access_token entre 2 publish (1 refresh + 2 publish = 3 fetch)", async () => {
    process.env["GSC_OAUTH_CLIENT_ID"] = "id";
    process.env["GSC_OAUTH_CLIENT_SECRET"] = "secret";
    process.env["INDEXING_OAUTH_REFRESH_TOKEN"] = "rt";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "AT", expires_in: 3600 }),
      })
      .mockResolvedValue({
        ok: true,
        text: async () => "{}",
      });
    vi.stubGlobal("fetch", fetchMock);

    const { indexingPublishUrl } = await import("../indexing-client");
    await indexingPublishUrl("https://axion-ia.com/a", "URL_UPDATED");
    await indexingPublishUrl("https://axion-ia.com/b", "URL_DELETED");

    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 OAuth + 2 publish
  });

  it("retourne false si OAuth refresh échoue (graceful)", async () => {
    process.env["GSC_OAUTH_CLIENT_ID"] = "id";
    process.env["GSC_OAUTH_CLIENT_SECRET"] = "secret";
    process.env["INDEXING_OAUTH_REFRESH_TOKEN"] = "bad";

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"error":"invalid_grant"}',
    });
    vi.stubGlobal("fetch", fetchMock);

    const { indexingPublishUrl } = await import("../indexing-client");
    expect(await indexingPublishUrl("https://axion-ia.com/x", "URL_UPDATED")).toBe(false);
  });

  it("retourne false si Indexing publish 403/4xx (graceful)", async () => {
    process.env["GSC_OAUTH_CLIENT_ID"] = "id";
    process.env["GSC_OAUTH_CLIENT_SECRET"] = "secret";
    process.env["INDEXING_OAUTH_REFRESH_TOKEN"] = "rt";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "AT", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => '{"error":{"message":"Permission denied"}}',
      });
    vi.stubGlobal("fetch", fetchMock);

    const { indexingPublishUrl } = await import("../indexing-client");
    expect(await indexingPublishUrl("https://axion-ia.com/x", "URL_UPDATED")).toBe(false);
  });

  it("isIndexingApiReady() true ssi 3 credentials présents", async () => {
    delete process.env["GSC_OAUTH_CLIENT_ID"];
    delete process.env["GSC_OAUTH_CLIENT_SECRET"];
    delete process.env["INDEXING_OAUTH_REFRESH_TOKEN"];
    const mod = await import("../indexing-client");
    expect(mod.isIndexingApiReady()).toBe(false);
    process.env["GSC_OAUTH_CLIENT_ID"] = "x";
    process.env["GSC_OAUTH_CLIENT_SECRET"] = "y";
    process.env["INDEXING_OAUTH_REFRESH_TOKEN"] = "z";
    expect(mod.isIndexingApiReady()).toBe(true);
  });
});
