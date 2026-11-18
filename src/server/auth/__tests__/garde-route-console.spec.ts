import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prefixeAdminAttendu, refuserSiHorsConsole } from "../garde-route-console";

const FACTICE = "prefixe-factice-test";

describe("refuserSiHorsConsole", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_URL_PREFIX", FACTICE);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("cas nominal : locale connue et bon préfixe → null", async () => {
    expect(
      await refuserSiHorsConsole(Promise.resolve({ locale: "fr", adminPrefix: FACTICE })),
    ).toBeNull();
  });

  it.each(["videos", "sitemap", "api", "xx"])("locale %s → 404 neutre", async (locale) => {
    const r = await refuserSiHorsConsole(Promise.resolve({ locale, adminPrefix: FACTICE }));
    expect(r?.status).toBe(404);
    expect(r?.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r?.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await r?.text()).toBe("not found");
  });

  it("bon locale, mauvais préfixe → 404", async () => {
    const r = await refuserSiHorsConsole(Promise.resolve({ locale: "fr", adminPrefix: "autre" }));
    expect(r?.status).toBe(404);
  });

  it("production sans préfixe configuré → 404 même avec le repli de développement", async () => {
    vi.stubEnv("ADMIN_URL_PREFIX", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(prefixeAdminAttendu()).toBeNull();
    const r = await refuserSiHorsConsole(
      Promise.resolve({ locale: "fr", adminPrefix: "admin-dev-x7k2n9" }),
    );
    expect(r?.status).toBe(404);
  });

  it("hors production sans variable : le repli de développement reste accepté", async () => {
    vi.stubEnv("ADMIN_URL_PREFIX", "");
    vi.stubEnv("NODE_ENV", "test");
    const attendu = prefixeAdminAttendu();
    expect(attendu).not.toBeNull();
    expect(
      await refuserSiHorsConsole(Promise.resolve({ locale: "fr", adminPrefix: attendu as string })),
    ).toBeNull();
  });
});
