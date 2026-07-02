/**
 * Test d'EXHAUSTIVITÉ des libellés FR admin (2026-07-02).
 *
 * Itère les VRAIES valeurs des enums Prisma (`$Enums` runtime) et vérifie que
 * CHAQUE valeur possède un libellé FR + une tonalité — et qu'aucun slug/enum
 * technique anglais ne « fuit » à l'écran (pas d'underscore, jamais égal au slug).
 * Si un enum gagne une valeur sans libellé → ce test échoue (détection de drift).
 */

import { describe, it, expect } from "vitest";
import {
  ContentType,
  ContentGenJobStatus,
  IndexationTier,
  ReviewStatus,
} from "../../../../../prisma/generated/client";
import {
  CONTENT_TYPE_LABELS_FR,
  JOB_STATUS_LABELS_FR,
  JOB_STATUS_TONE,
  REVIEW_STATUS_LABELS_FR,
  REVIEW_STATUS_TONE,
  INDEXATION_TIER_LABELS_FR,
  INDEXATION_TIER_HELP_FR,
  ARTICLE_STATUS_LABELS_FR,
  contentTypeLabelFr,
  articleStatusLabelFr,
  articlePublicationBadge,
} from "../admin-labels";

// Un libellé « propre » : non vide, différent du slug, sans underscore (artefact
// d'enum brut), et pas un mot anglais technique évident.
function expectCleanFrLabel(label: string, slug: string): void {
  expect(label, `libellé manquant pour "${slug}"`).toBeTruthy();
  expect(label.trim().length, `libellé vide pour "${slug}"`).toBeGreaterThan(1);
  expect(label, `libellé = slug brut pour "${slug}"`).not.toBe(slug);
  expect(label.includes("_"), `underscore (slug brut) dans "${label}"`).toBe(false);
}

describe("admin-labels — exhaustivité enums Prisma", () => {
  it("CONTENT_TYPE_LABELS_FR couvre toutes les valeurs ContentType", () => {
    const values = Object.values(ContentType);
    expect(values.length).toBeGreaterThanOrEqual(22);
    for (const v of values) {
      expectCleanFrLabel(CONTENT_TYPE_LABELS_FR[v], v);
    }
  });

  it("JOB_STATUS_LABELS_FR + tone couvrent toutes les valeurs ContentGenJobStatus", () => {
    const values = Object.values(ContentGenJobStatus);
    expect(values.length).toBeGreaterThanOrEqual(14);
    for (const v of values) {
      expectCleanFrLabel(JOB_STATUS_LABELS_FR[v], v);
      expect(JOB_STATUS_TONE[v], `tone manquant pour job status "${v}"`).toBeTruthy();
    }
  });

  it("REVIEW_STATUS_LABELS_FR + tone couvrent toutes les valeurs ReviewStatus", () => {
    const values = Object.values(ReviewStatus);
    expect(values.length).toBeGreaterThanOrEqual(5);
    for (const v of values) {
      expectCleanFrLabel(REVIEW_STATUS_LABELS_FR[v], v);
      expect(REVIEW_STATUS_TONE[v], `tone manquant pour review status "${v}"`).toBeTruthy();
    }
  });

  it("INDEXATION_TIER_LABELS_FR + help couvrent toutes les valeurs IndexationTier", () => {
    const values = Object.values(IndexationTier);
    expect(values.length).toBe(3);
    for (const v of values) {
      expectCleanFrLabel(INDEXATION_TIER_LABELS_FR[v], v);
      expect(INDEXATION_TIER_HELP_FR[v]?.length ?? 0, `help manquant pour "${v}"`).toBeGreaterThan(
        20,
      );
    }
  });
});

describe("admin-labels — spot-checks métier", () => {
  it("statuts d'article publics traduits", () => {
    expect(ARTICLE_STATUS_LABELS_FR["published"]).toBe("Publié");
    expect(ARTICLE_STATUS_LABELS_FR["draft"]).toBe("Brouillon");
    expect(ARTICLE_STATUS_LABELS_FR["archived"]).toBe("Archivé");
  });

  it("libellés clés lisibles (pas de jargon)", () => {
    expect(CONTENT_TYPE_LABELS_FR.blog_from_rss).toBe("Article depuis une actu (RSS)");
    expect(CONTENT_TYPE_LABELS_FR.landing_ville).toBe("Page ville");
    expect(INDEXATION_TIER_LABELS_FR.tier_1_indexable).toBe("Visible sur Google");
    expect(REVIEW_STATUS_LABELS_FR.promoted_t1).toBe("Publié (indexable)");
    expect(JOB_STATUS_LABELS_FR.needs_review).toBe("À relire");
  });

  it("contentTypeLabelFr : repli sûr sur slug inconnu", () => {
    expect(contentTypeLabelFr("blog_article")).toBe("Article de blog");
    expect(contentTypeLabelFr("type_inexistant_xyz")).toBe("type_inexistant_xyz");
  });

  it("articleStatusLabelFr : repli sûr", () => {
    expect(articleStatusLabelFr("published")).toBe("Publié");
    expect(articleStatusLabelFr("inconnu")).toBe("inconnu");
  });

  it("articlePublicationBadge : badges métier limpides", () => {
    expect(articlePublicationBadge("published")).toEqual({ label: "🟢 En ligne", tone: "success" });
    expect(articlePublicationBadge("draft").tone).toBe("warning");
    expect(articlePublicationBadge("archived").tone).toBe("neutral");
    expect(articlePublicationBadge("published").label).toContain("En ligne");
  });
});
