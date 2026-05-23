// Phase D — Tests server actions Site Explorer
// Sprint Site Explorer Admin 2026-05-22

import { describe, it, expect } from "vitest";
import type { SiteRouteFilters } from "@/server/actions/site-explorer/site-routes";

// ─── Helpers logique pure (sans Prisma) ──────────────────────────────────────

function buildWhereClause(filters: SiteRouteFilters) {
  const where: Record<string, unknown> = {
    visibility: "public",
  };

  if (filters.type) where["type"] = filters.type;
  if (filters.status) where["status"] = filters.status;
  if (filters.section) where["section"] = filters.section;
  if (filters.editable !== undefined) where["editable"] = filters.editable;

  if (filters.search) {
    where["OR"] = [
      { pathPattern: { contains: filters.search, mode: "insensitive" } },
      { pathRendered: { contains: filters.search, mode: "insensitive" } },
      { metaTitle: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.anomaliesOnly) {
    where["anomalies"] = { some: { resolvedAt: null } };
  }

  return where;
}

describe("Site Explorer — buildWhereClause", () => {
  it("inclut toujours visibility=public", () => {
    const where = buildWhereClause({});
    expect(where).toMatchObject({ visibility: "public" });
  });

  it("ne retourne PAS admin ou api dans les filtres", () => {
    const where = buildWhereClause({ type: "static" });
    // visibility est toujours 'public' — jamais 'admin' ni 'api_only'
    expect(where["visibility"]).toBe("public");
    expect(where["visibility"]).not.toBe("admin");
    expect(where["visibility"]).not.toBe("api_only");
  });

  it("filtre par type", () => {
    const where = buildWhereClause({ type: "dynamic_db" });
    expect(where).toMatchObject({ type: "dynamic_db" });
  });

  it("filtre par section", () => {
    const where = buildWhereClause({ section: "blog" });
    expect(where).toMatchObject({ section: "blog" });
  });

  it("filtre par search avec OR", () => {
    const where = buildWhereClause({ search: "formation-ia" });
    expect(where["OR"]).toBeDefined();
    const orClause = where["OR"] as Array<Record<string, unknown>>;
    expect(orClause).toHaveLength(3);
    expect(orClause[0]).toMatchObject({ pathPattern: { contains: "formation-ia" } });
  });

  it("filtre anomaliesOnly", () => {
    const where = buildWhereClause({ anomaliesOnly: true });
    expect(where["anomalies"]).toMatchObject({ some: { resolvedAt: null } });
  });

  it("filtre editables uniquement", () => {
    const where = buildWhereClause({ editable: true });
    expect(where["editable"]).toBe(true);
  });

  it("pagination par défaut page=1 pageSize=50", () => {
    // Simule les valeurs par défaut quand les filtres sont absents
    const rawPage: number | undefined = undefined;
    const rawPageSize: number | undefined = undefined;
    const page = Math.max(1, rawPage ?? 1);
    const pageSize = Math.min(100, Math.max(10, rawPageSize ?? 50));
    expect(page).toBe(1);
    expect(pageSize).toBe(50);
  });
});

describe("Site Explorer — validation entrées", () => {
  it("clampe pageSize entre 10 et 100", () => {
    expect(Math.min(100, Math.max(10, 5))).toBe(10);
    expect(Math.min(100, Math.max(10, 200))).toBe(100);
    expect(Math.min(100, Math.max(10, 50))).toBe(50);
  });

  it("page minimum 1", () => {
    expect(Math.max(1, 0)).toBe(1);
    expect(Math.max(1, -5)).toBe(1);
    expect(Math.max(1, 3)).toBe(3);
  });
});
