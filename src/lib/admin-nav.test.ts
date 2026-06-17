import { describe, it, expect } from "vitest";
import { buildAdminNav, ADMIN_NAV_GROUP_LABELS, ADMIN_NAV_GROUP_ORDER } from "./admin-nav";

describe("buildAdminNav SSOT", () => {
  it("returns 108 items (snapshot count — +5 console chatbot ADR-CB-07, +20 Qualiopi T0-T16, +1 RGPD T19, +1 Formateurs R9, +1 Stagiaires R10, +1 Config Qualiopi, +2 carrières, +6 Documents interventions dont Importer un kit, +3 Coaching 1-to-1, content_gen refonte UX 2026-06-16 = 30 items en 6 pôles, +1 Observatoire IA suivi 2026-06-17 ; /orchestrator et /queue fusionnés → pas d'entrée nav, redirections seules)", () => {
    const items = buildAdminNav("admin-test-prefix");
    expect(items.length).toBe(108);
  });

  it("prefixes all hrefs with /fr/<adminPrefix>", () => {
    const items = buildAdminNav("admin-test-prefix");
    for (const it of items) {
      expect(it.href.startsWith("/fr/admin-test-prefix")).toBe(true);
    }
  });

  it("covers all 11 groups in ADMIN_NAV_GROUP_ORDER", () => {
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
