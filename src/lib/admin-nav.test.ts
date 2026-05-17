import { describe, it, expect } from "vitest";
import { buildAdminNav, ADMIN_NAV_GROUP_LABELS, ADMIN_NAV_GROUP_ORDER } from "./admin-nav";

describe("buildAdminNav SSOT", () => {
  it("returns 36 items (snapshot count)", () => {
    const items = buildAdminNav("admin-test-prefix");
    expect(items.length).toBe(36);
  });

  it("prefixes all hrefs with /fr/<adminPrefix>", () => {
    const items = buildAdminNav("admin-test-prefix");
    for (const it of items) {
      expect(it.href.startsWith("/fr/admin-test-prefix")).toBe(true);
    }
  });

  it("covers all 6 groups in ADMIN_NAV_GROUP_ORDER", () => {
    const items = buildAdminNav("admin-test-prefix");
    const groups = new Set(items.map((it) => it.group));
    for (const g of ADMIN_NAV_GROUP_ORDER) {
      expect(groups.has(g)).toBe(true);
    }
  });

  it("ADMIN_NAV_GROUP_LABELS covers all groups", () => {
    for (const g of ADMIN_NAV_GROUP_ORDER) {
      expect(ADMIN_NAV_GROUP_LABELS[g]).toBeDefined();
    }
  });

  it("has unique hrefs (no drift)", () => {
    const items = buildAdminNav("p");
    const hrefs = items.map((it) => it.href);
    const unique = new Set(hrefs);
    expect(unique.size).toBe(hrefs.length);
  });
});
