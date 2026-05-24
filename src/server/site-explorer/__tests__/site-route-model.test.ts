// Phase A — Tests modèle Prisma SiteRoute
// Sprint Site Explorer Admin 2026-05-22

import { describe, it, expect } from "vitest";
import type {
  SiteRouteType,
  SiteRouteStatus,
  SiteRouteVisibility,
} from "../../../../prisma/generated/client";

// --- Helpers purs (pas de Prisma réel) pour valider les types/contraintes ---

type SiteRouteShape = {
  id: string;
  pathPattern: string;
  pathRendered: string | null;
  pathSlug: string | null;
  type: SiteRouteType;
  status: SiteRouteStatus;
  visibility: SiteRouteVisibility;
  source: string;
  filePath: string | null;
  parentRouteId: string | null;
  depth: number;
  section: string | null;
  editable: boolean;
  editorRoute: string | null;
  sourceDbTable: string | null;
  sourceDbId: string | null;
};

function makeRoute(overrides: Partial<SiteRouteShape> = {}): SiteRouteShape {
  return {
    id: "cuid_test",
    pathPattern: "/fr/blog/[slug]",
    pathRendered: null,
    pathSlug: null,
    type: "static",
    status: "unknown",
    visibility: "public",
    source: "filesystem",
    filePath: "src/app/[locale]/blog/[slug]/page.tsx",
    parentRouteId: null,
    depth: 2,
    section: "blog",
    editable: false,
    editorRoute: null,
    sourceDbTable: null,
    sourceDbId: null,
    ...overrides,
  };
}

describe("SiteRoute — modèle Phase A", () => {
  it("crée une route statique publique avec valeurs par défaut", () => {
    const route = makeRoute({ type: "static", status: "live", visibility: "public" });
    expect(route.visibility).toBe("public");
    expect(route.type).toBe("static");
    expect(route.status).toBe("live");
    expect(route.editable).toBe(false);
  });

  it("route dynamique DB est éditable avec editorRoute", () => {
    const route = makeRoute({
      type: "dynamic_db",
      pathPattern: "/fr/blog/[slug]",
      pathRendered: "/fr/blog/audit-ia-paris-2026",
      pathSlug: "audit-ia-paris-2026",
      editable: true,
      editorRoute: "/fr/admin-dev-x7k2n9/blog/uuid-123/edit",
      sourceDbTable: "articles",
      sourceDbId: "uuid-123",
    });
    expect(route.editable).toBe(true);
    expect(route.sourceDbTable).toBe("articles");
    expect(route.editorRoute).toContain("/blog/uuid-123/edit");
  });

  it("visibilité est toujours 'public' (pas admin ni api_only)", () => {
    const route = makeRoute({ visibility: "public" });
    // SiteRouteVisibility n'a qu'une valeur possible par design
    const allowedValues: SiteRouteVisibility[] = ["public"];
    expect(allowedValues).toContain(route.visibility);
    expect(route.visibility).not.toBe("admin" as unknown);
    expect(route.visibility).not.toBe("api_only" as unknown);
  });

  it("path ne doit pas contenir de segment admin", () => {
    const forbiddenPatterns = ["(admin)", "[adminPrefix]", "/api/", "_next"];
    const route = makeRoute({ pathPattern: "/fr/blog/[slug]" });
    for (const forbidden of forbiddenPatterns) {
      expect(route.pathPattern).not.toContain(forbidden);
    }
  });

  it("hiérarchie parent-enfant : parentRouteId nullable", () => {
    const parent = makeRoute({ id: "parent-1", pathPattern: "/fr/blog", depth: 1 });
    const child = makeRoute({
      id: "child-1",
      pathPattern: "/fr/blog/[slug]",
      parentRouteId: "parent-1",
      depth: 2,
    });
    expect(parent.parentRouteId).toBeNull();
    expect(child.parentRouteId).toBe("parent-1");
    expect(child.depth).toBeGreaterThan(parent.depth);
  });

  it("route dynamique filesystem sans editorRoute (pas d'édition DB)", () => {
    const route = makeRoute({
      type: "dynamic_filesystem",
      pathPattern: "/fr/implantations/[region]/[ville]",
      source: "filesystem:economic-data",
      editable: false,
      editorRoute: null,
      sourceDbTable: null,
    });
    expect(route.editable).toBe(false);
    expect(route.editorRoute).toBeNull();
    expect(route.type).toBe("dynamic_filesystem");
  });
});
