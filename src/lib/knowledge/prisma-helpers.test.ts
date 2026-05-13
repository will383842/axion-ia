/**
 * Tests SSOT helpers Knowledge Base.
 * Sprint KB-1 — 15+ tests verts (validation Phase A).
 */

import { describe, expect, it } from "vitest";
import {
  KB_TYPES,
  PUBLIC_KB_TYPES,
  INTERNAL_KB_TYPES,
  CLIENT_KB_TYPES,
  KB_TYPE_TO_JSONLD,
  getKbTypeMeta,
  getJsonLdType,
  isPublicKbType,
} from "@/content/knowledge/types";
import { KB_DOMAINS, getDomainLabel } from "@/content/knowledge/domains";
import {
  KB_AUDIENCES,
  isPublicAudience,
  isClientReadableAudience,
  isTeamOnlyAudience,
} from "@/content/knowledge/audiences";
import {
  KB_CONFIDENTIALITIES,
  isExternalApiAllowed,
  NON_EXTERNAL_CONFIDENTIALITIES,
} from "@/content/knowledge/confidentialities";
import {
  KB_STATUSES,
  KB_PIPELINE_STAGES,
  VISIBLE_STATUSES,
  isVisibleStatus,
  getStatusLabel,
} from "@/content/knowledge/statuses";
import {
  KB_RELATION_KINDS,
  DAG_RELATION_KINDS,
  isDagKind,
} from "@/content/knowledge/relation-kinds";
import {
  KB_PUBLIC_ROUTES,
  KB_HUB_ROUTE,
  KB_CLIENT_HUB_ROUTE,
  buildKbPublicUrl,
} from "@/content/knowledge/routes";
import { getQualityThreshold, getMinWordCount } from "@/content/knowledge/quality-thresholds";
import { getReviewWindowMonths, computeReviewDueAt } from "@/content/knowledge/review-windows";
import {
  isFrontVisible,
  PUBLIC_VISIBLE_WHERE,
  CLIENT_VISIBLE_WHERE,
  buildListWhere,
} from "./prisma-helpers";

describe("KB SSOT — types", () => {
  it("KB_TYPES exposes 16 values", () => {
    expect(KB_TYPES).toHaveLength(16);
  });

  it("PUBLIC_KB_TYPES is a subset of KB_TYPES", () => {
    for (const t of PUBLIC_KB_TYPES) {
      expect(KB_TYPES).toContain(t);
    }
  });

  it("INTERNAL_KB_TYPES + CLIENT_KB_TYPES + PUBLIC_KB_TYPES cover all KB_TYPES", () => {
    const union = new Set<string>([...PUBLIC_KB_TYPES, ...INTERNAL_KB_TYPES, ...CLIENT_KB_TYPES]);
    expect(union.size).toBe(KB_TYPES.length);
  });

  it("isPublicKbType reflects KB_TYPE_META.isPublic", () => {
    expect(isPublicKbType("article")).toBe(true);
    expect(isPublicKbType("doctrine")).toBe(false);
    expect(isPublicKbType("sop")).toBe(false);
  });

  it("getJsonLdType returns proper schema.org @type", () => {
    expect(getJsonLdType("faq")).toBe("FAQPage");
    expect(getJsonLdType("glossary_term")).toBe("DefinedTerm");
    expect(getJsonLdType("guide")).toBe("TechArticle");
    expect(getJsonLdType("sop")).toBe("HowTo");
    expect(getJsonLdType("onboarding_step")).toBe("HowTo");
  });

  it("getKbTypeMeta has labels FR + EN for every type", () => {
    for (const t of KB_TYPES) {
      const meta = getKbTypeMeta(t);
      expect(meta.labelFr).toBeTruthy();
      expect(meta.labelEn).toBeTruthy();
      expect(meta.jsonLd).toBeTruthy();
    }
  });

  it("KB_TYPE_TO_JSONLD has an entry per KbType", () => {
    for (const t of KB_TYPES) {
      expect(KB_TYPE_TO_JSONLD[t]).toBeTruthy();
    }
  });
});

describe("KB SSOT — domains", () => {
  it("exposes 10 domains", () => {
    expect(KB_DOMAINS).toHaveLength(10);
  });

  it("getDomainLabel returns FR + EN strings", () => {
    expect(getDomainLabel("commercial", "fr")).toBe("Commercial");
    expect(getDomainLabel("watch", "fr")).toBe("Veille");
    expect(getDomainLabel("watch", "en")).toBe("Market watch");
  });
});

describe("KB SSOT — audiences", () => {
  it("exposes 4 audiences", () => {
    expect(KB_AUDIENCES).toHaveLength(4);
  });

  it("isPublicAudience is true only for public", () => {
    expect(isPublicAudience("public")).toBe(true);
    expect(isPublicAudience("client")).toBe(false);
    expect(isPublicAudience("team")).toBe(false);
  });

  it("isClientReadableAudience is true for public + client", () => {
    expect(isClientReadableAudience("public")).toBe(true);
    expect(isClientReadableAudience("client")).toBe(true);
    expect(isClientReadableAudience("team")).toBe(false);
    expect(isClientReadableAudience("will_only")).toBe(false);
  });

  it("isTeamOnlyAudience is true for team + will_only", () => {
    expect(isTeamOnlyAudience("team")).toBe(true);
    expect(isTeamOnlyAudience("will_only")).toBe(true);
    expect(isTeamOnlyAudience("public")).toBe(false);
  });
});

describe("KB SSOT — confidentialities", () => {
  it("exposes 4 levels", () => {
    expect(KB_CONFIDENTIALITIES).toHaveLength(4);
  });

  it("isExternalApiAllowed refuses confidential + secret", () => {
    expect(isExternalApiAllowed("public")).toBe(true);
    expect(isExternalApiAllowed("internal")).toBe(true);
    expect(isExternalApiAllowed("confidential")).toBe(false);
    expect(isExternalApiAllowed("secret")).toBe(false);
  });

  it("NON_EXTERNAL_CONFIDENTIALITIES contains exactly confidential + secret", () => {
    expect(NON_EXTERNAL_CONFIDENTIALITIES).toEqual(["confidential", "secret"]);
  });
});

describe("KB SSOT — statuses", () => {
  it("exposes 7 statuses", () => {
    expect(KB_STATUSES).toHaveLength(7);
  });

  it("exposes 9 pipeline stages", () => {
    expect(KB_PIPELINE_STAGES).toHaveLength(9);
  });

  it("VISIBLE_STATUSES contains published + deprecated", () => {
    expect(VISIBLE_STATUSES).toEqual(["published", "deprecated"]);
  });

  it("isVisibleStatus reflects visibility", () => {
    expect(isVisibleStatus("published")).toBe(true);
    expect(isVisibleStatus("deprecated")).toBe(true);
    expect(isVisibleStatus("draft")).toBe(false);
    expect(isVisibleStatus("archived")).toBe(false);
  });

  it("getStatusLabel returns FR + EN", () => {
    expect(getStatusLabel("draft", "fr")).toBe("Brouillon");
    expect(getStatusLabel("draft", "en")).toBe("Draft");
  });
});

describe("KB SSOT — relation kinds", () => {
  it("exposes 7 kinds", () => {
    expect(KB_RELATION_KINDS).toHaveLength(7);
  });

  it("DAG_RELATION_KINDS = replaces, depends_on, supersedes, extends", () => {
    expect(DAG_RELATION_KINDS).toEqual(["replaces", "depends_on", "supersedes", "extends"]);
  });

  it("isDagKind reflects DAG kinds", () => {
    expect(isDagKind("replaces")).toBe(true);
    expect(isDagKind("related_to")).toBe(false);
    expect(isDagKind("cites")).toBe(false);
  });
});

describe("KB SSOT — routes", () => {
  it("KB_PUBLIC_ROUTES has 6 public-typed entries", () => {
    const publicTypes = Object.entries(KB_PUBLIC_ROUTES).filter(([, v]) => v !== null);
    expect(publicTypes).toHaveLength(6);
  });

  it("hub route is /ressources FR + /resources EN", () => {
    expect(KB_HUB_ROUTE).toEqual({ fr: "/ressources", en: "/resources" });
  });

  it("client hub is /mes-ressources FR + /my-resources EN", () => {
    expect(KB_CLIENT_HUB_ROUTE).toEqual({ fr: "/mes-ressources", en: "/my-resources" });
  });

  it("buildKbPublicUrl returns route-specific URL for public types", () => {
    expect(buildKbPublicUrl("article", "fr", "mon-article")).toBe("/blog/mon-article");
    expect(buildKbPublicUrl("article", "en", "my-article")).toBe("/blog/my-article");
    expect(buildKbPublicUrl("case_study", "fr", "cas-1")).toBe("/cas-concrets/cas-1");
    expect(buildKbPublicUrl("case_study", "en", "case-1")).toBe("/case-studies/case-1");
    expect(buildKbPublicUrl("glossary_term", "fr", "rag")).toBe("/glossaire/rag");
  });

  it("buildKbPublicUrl falls back to hub for internal types", () => {
    expect(buildKbPublicUrl("methodology", "fr", "agile")).toBe("/ressources/methodology/agile");
    expect(buildKbPublicUrl("sop", "en", "deploy")).toBe("/resources/sop/deploy");
  });
});

describe("KB SSOT — quality thresholds", () => {
  it("getQualityThreshold returns numbers > 0 for all types", () => {
    for (const type of KB_TYPES) {
      expect(getQualityThreshold(type)).toBeGreaterThan(0);
    }
  });

  it("FAQ + glossary_term have lower min word count", () => {
    expect(getMinWordCount("faq")).toBeLessThan(getMinWordCount("guide"));
    expect(getMinWordCount("glossary_term")).toBeLessThan(getMinWordCount("article"));
  });
});

describe("KB SSOT — review windows", () => {
  it("getReviewWindowMonths returns positive integers", () => {
    for (const type of KB_TYPES) {
      expect(getReviewWindowMonths(type)).toBeGreaterThan(0);
    }
  });

  it("ADR + post_mortem have longer windows than prompt_template", () => {
    expect(getReviewWindowMonths("adr")).toBeGreaterThan(getReviewWindowMonths("prompt_template"));
    expect(getReviewWindowMonths("post_mortem")).toBeGreaterThan(
      getReviewWindowMonths("tool_card"),
    );
  });

  it("computeReviewDueAt adds N months to reviewedAt", () => {
    const reviewedAt = new Date("2026-01-01T00:00:00Z");
    const due = computeReviewDueAt("article", reviewedAt);
    expect(due.getUTCMonth()).toBe(6); // janv + 18 mois = juillet (mois 6) année suivante
    expect(due.getUTCFullYear()).toBe(2027);
  });
});

describe("KB SSOT — prisma helpers", () => {
  it("PUBLIC_VISIBLE_WHERE filters audience+status+alive", () => {
    expect(PUBLIC_VISIBLE_WHERE.audience).toBe("public");
    expect(PUBLIC_VISIBLE_WHERE.deletedAt).toBeNull();
    expect(PUBLIC_VISIBLE_WHERE.status).toEqual({ in: ["published", "deprecated"] });
  });

  it("CLIENT_VISIBLE_WHERE includes public + client audiences", () => {
    expect(CLIENT_VISIBLE_WHERE.audience).toEqual({ in: ["public", "client"] });
  });

  it("isFrontVisible requires published OR deprecated + public", () => {
    expect(isFrontVisible("published", "public")).toBe(true);
    expect(isFrontVisible("deprecated", "public")).toBe(true);
    expect(isFrontVisible("draft", "public")).toBe(false);
    expect(isFrontVisible("published", "team")).toBe(false);
  });

  it("buildListWhere composes filters", () => {
    const where = buildListWhere({
      type: "article",
      audience: "public",
      statuses: ["published"],
      tagSlugs: ["ia"],
    });
    expect(where.type).toBe("article");
    expect(where.audience).toBe("public");
    expect(where.status).toEqual({ in: ["published"] });
    expect(where.tags).toBeDefined();
  });

  it("buildListWhere with audience='all' omits audience filter", () => {
    const where = buildListWhere({ audience: "all" });
    expect(where.audience).toBeUndefined();
  });

  it("buildListWhere includeDeleted=true omits deletedAt filter", () => {
    const where = buildListWhere({ audience: "all", includeDeleted: true });
    expect(where.deletedAt).toBeUndefined();
  });
});
