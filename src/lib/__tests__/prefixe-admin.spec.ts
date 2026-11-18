import { afterEach, describe, expect, it, vi } from "vitest";

import { adminSegment } from "../admin-path";
import { prefixeAdminAttendu, regexConsole } from "../prefixe-admin";

afterEach(() => vi.unstubAllEnvs());

describe("préfixe de la console : refus par défaut en production", () => {
  it.each(["", undefined])("production, variable %j → null, segment sentinelle", (v) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_URL_PREFIX", v as string);
    if (v === undefined) delete process.env["ADMIN_URL_PREFIX"];
    expect(prefixeAdminAttendu()).toBeNull();
    expect(adminSegment()).toBe("console-fermee");
    expect(adminSegment()).not.toContain("admin-dev");
    expect(regexConsole()).toBeNull();
  });

  it("production, variable posée → cette valeur", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_URL_PREFIX", "prefixe-factice-test");
    expect(adminSegment()).toBe("prefixe-factice-test");
    expect(regexConsole()?.test("/fr/prefixe-factice-test/x")).toBe(true);
    expect(regexConsole()?.test("/fr/autre/x")).toBe(false);
  });

  it("hors production, sans variable → repli de développement", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env["ADMIN_URL_PREFIX"];
    expect(prefixeAdminAttendu()).not.toBeNull();
  });
});
