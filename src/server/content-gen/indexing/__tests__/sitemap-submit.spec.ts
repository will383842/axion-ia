import { beforeEach, describe, expect, it, vi } from "vitest";

const { addMock, getMock } = vi.hoisted(() => ({
  addMock: vi.fn().mockResolvedValue({}),
  getMock: vi.fn(),
}));
vi.mock("bullmq", () => ({ Queue: vi.fn(() => ({ add: addMock })) }));
vi.mock("@/lib/redis", () => ({ redis: { get: getMock, set: vi.fn() } }));

import {
  delaiAvantSoumission,
  planifierSoumissionSitemap,
  SITEMAP_SUBMIT_INTERVALLE_MS,
  SITEMAP_SUBMIT_REGROUPEMENT_MS,
  _resetSitemapSubmitQueueForTest,
} from "../sitemap-submit";
import { gscSoumettreSitemap } from "@/server/content-gen/seo/gsc-client";

beforeEach(() => {
  addMock.mockClear();
  getMock.mockReset().mockResolvedValue(null);
  _resetSitemapSubmitQueueForTest();
  process.env.REDIS_URL = "redis://localhost:6379";
  delete process.env.GSC_SITEMAP_SUBMIT_ENABLED;
});

describe("planification de la soumission du sitemap", () => {
  it("éteinte par défaut : aucun job", async () => {
    expect(await planifierSoumissionSitemap()).toBe(false);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("allumée : un seul job retardé, jobId fixe, sitemap des articles", async () => {
    process.env.GSC_SITEMAP_SUBMIT_ENABLED = "true";
    expect(await planifierSoumissionSitemap(1_000_000)).toBe(true);
    expect(addMock).toHaveBeenCalledWith(
      "submit",
      { sitemap: expect.stringMatching(/\/sitemap-blog\.xml$/) },
      expect.objectContaining({
        jobId: "gsc-sitemap-submit-en-attente",
        delay: SITEMAP_SUBMIT_REGROUPEMENT_MS,
      }),
    );
  });

  it("au plus une fois par heure : délai = reste de l'heure depuis la dernière soumission", () => {
    const now = 10_000_000;
    expect(delaiAvantSoumission(now - 10 * 60_000, now)).toBe(
      SITEMAP_SUBMIT_INTERVALLE_MS - 10 * 60_000,
    );
    expect(delaiAvantSoumission(now - 2 * SITEMAP_SUBMIT_INTERVALLE_MS, now)).toBe(
      SITEMAP_SUBMIT_REGROUPEMENT_MS,
    );
  });
});

describe("gscSoumettreSitemap", () => {
  const env = {
    GSC_PROPERTY_URL: "sc-domain:axion-ia.com",
    GSC_OAUTH_CLIENT_ID: "i",
    GSC_OAUTH_CLIENT_SECRET: "s",
    GSC_OAUTH_REFRESH_TOKEN: "r",
  };
  const fetchPour = (statut: number) =>
    vi.fn(async (url: string | URL | Request) =>
      String(url).includes("oauth2")
        ? new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }))
        : new Response(
            statut === 204 ? null : JSON.stringify({ error: { status: "PERMISSION_DENIED" } }),
            {
              status: statut,
            },
          ),
    ) as unknown as typeof fetch;

  it("PUT sur sites/{site}/sitemaps/{feedpath}", async () => {
    Object.assign(process.env, env);
    const f = fetchPour(204);
    const r = await gscSoumettreSitemap("https://axion-ia.com/sitemap-blog.xml", { fetchImpl: f });
    expect(r.etat).toBe("ok");
    const appel = (f as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => !String(c[0]).includes("oauth2"),
    );
    expect(appel?.[0]).toBe(
      "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aaxion-ia.com/sitemaps/https%3A%2F%2Faxion-ia.com%2Fsitemap-blog.xml",
    );
    expect(appel?.[1]).toMatchObject({ method: "PUT" });
  });

  it("403 → portee_insuffisante (jeton en lecture seule)", async () => {
    Object.assign(process.env, env);
    const r = await gscSoumettreSitemap("https://axion-ia.com/sitemap-blog.xml", {
      fetchImpl: fetchPour(403),
    });
    expect(r.etat).toBe("portee_insuffisante");
  });
});
