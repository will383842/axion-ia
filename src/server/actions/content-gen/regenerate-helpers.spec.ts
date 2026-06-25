import { describe, expect, it } from "vitest";
import {
  buildRegenerationJobData,
  deriveSourceJobFromArticle,
  REGENERABLE_CONTENT_TYPES,
  type RegenSourceJob,
} from "./regenerate-helpers";

const baseSource: RegenSourceJob = {
  contentType: "blog_article",
  targetSearchIntent: "informational",
  targetLocale: "fr",
  anchorVilleSlug: null,
  anchorRegionSlug: null,
  anchorDepartementCode: null,
  templateId: null,
  serviceSector: null,
  campaignId: null,
  primaryProvider: "openai",
  fallbackProvider: "anthropic",
  inputPayload: { primaryKeyword: "audit ia pme", title: "Audit IA en PME" },
};

describe("buildRegenerationJobData", () => {
  it("injecte le marqueur refreshArticleId tout en préservant le payload d'origine", () => {
    const { inputPayload, data } = buildRegenerationJobData({
      articleId: "art-123",
      preservedSlug: "audit-ia-pme",
      sourceJob: baseSource,
      createdBy: "user-1",
      slotMs: 1_700_000_000_000,
    });
    expect(inputPayload.refreshArticleId).toBe("art-123");
    expect(inputPayload.refreshOfSlug).toBe("audit-ia-pme");
    // Le payload d'origine est conservé (le generator reçoit les mêmes params).
    expect(inputPayload.primaryKeyword).toBe("audit ia pme");
    expect(inputPayload.title).toBe("Audit IA en PME");
    expect(data.contentType).toBe("blog_article");
    expect(data.priority).toBe(4);
    expect(data.status).toBe("queued");
    expect(data.createdBy).toBe("user-1");
  });

  it("clé d'idempotence stable dans le même slot 60s, différente entre slots", () => {
    const a = buildRegenerationJobData({
      articleId: "art-123",
      preservedSlug: "s",
      sourceJob: baseSource,
      createdBy: "u",
      slotMs: 1_700_000_000_000,
    });
    const sameSlot = buildRegenerationJobData({
      articleId: "art-123",
      preservedSlug: "s",
      sourceJob: baseSource,
      createdBy: "u",
      slotMs: 1_700_000_000_000 + 5_000, // +5s, même slot 60s
    });
    const nextSlot = buildRegenerationJobData({
      articleId: "art-123",
      preservedSlug: "s",
      sourceJob: baseSource,
      createdBy: "u",
      slotMs: 1_700_000_000_000 + 61_000, // +61s, slot suivant
    });
    expect(a.idempotencyKey).toBe(sameSlot.idempotencyKey);
    expect(a.idempotencyKey).not.toBe(nextSlot.idempotencyKey);
  });

  it("clé d'idempotence différente entre deux articles distincts", () => {
    const a = buildRegenerationJobData({
      articleId: "art-1",
      preservedSlug: null,
      sourceJob: baseSource,
      createdBy: "u",
      slotMs: 1_700_000_000_000,
    });
    const b = buildRegenerationJobData({
      articleId: "art-2",
      preservedSlug: null,
      sourceJob: baseSource,
      createdBy: "u",
      slotMs: 1_700_000_000_000,
    });
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
  });

  it("omet les ancres nulles et propage celles présentes", () => {
    const withAnchor = buildRegenerationJobData({
      articleId: "art-1",
      preservedSlug: null,
      sourceJob: { ...baseSource, anchorVilleSlug: "lyon", templateId: "tpl-9" },
      createdBy: "u",
      slotMs: 1_700_000_000_000,
    });
    expect(withAnchor.data.anchorVilleSlug).toBe("lyon");
    expect(withAnchor.data.templateId).toBe("tpl-9");
    expect("anchorRegionSlug" in withAnchor.data).toBe(false);

    const noAnchor = buildRegenerationJobData({
      articleId: "art-1",
      preservedSlug: null,
      sourceJob: baseSource,
      createdBy: "u",
      slotMs: 1_700_000_000_000,
    });
    expect("anchorVilleSlug" in noAnchor.data).toBe(false);
    expect("templateId" in noAnchor.data).toBe(false);
  });

  it("tolère un inputPayload source absent / non-objet sans throw", () => {
    const r = buildRegenerationJobData({
      articleId: "art-1",
      preservedSlug: null,
      sourceJob: { ...baseSource, inputPayload: null },
      createdBy: "u",
      slotMs: 1_700_000_000_000,
    });
    expect(r.inputPayload.refreshArticleId).toBe("art-1");
  });

  it("le set des types régénérables exclut landing_ville (CLI-only)", () => {
    expect(REGENERABLE_CONTENT_TYPES.has("blog_article")).toBe(true);
    expect(REGENERABLE_CONTENT_TYPES.has("guide_pilier")).toBe(true);
    expect(REGENERABLE_CONTENT_TYPES.has("landing_ville")).toBe(false);
  });
});

describe("deriveSourceJobFromArticle (Option B — job source purgé)", () => {
  it("dérive le primaryKeyword depuis le lead du titre (avant « : »)", () => {
    const s = deriveSourceJobFromArticle({
      searchIntent: "informational",
      title: "Audit IA à Grenoble : Optimisez votre entreprise",
    });
    expect((s.inputPayload as { primaryKeyword: string }).primaryKeyword).toBe(
      "Audit IA à Grenoble",
    );
    expect(s.contentType).toBe("blog_from_keywords");
    expect(s.targetSearchIntent).toBe("informational");
    expect(s.targetLocale).toBe("fr");
  });

  it("titre sans séparateur → mot-clé = titre entier ; intent par défaut si null", () => {
    const s = deriveSourceJobFromArticle({
      searchIntent: null,
      title: "Comparatif des intégrateurs IA",
    });
    expect((s.inputPayload as { primaryKeyword: string }).primaryKeyword).toBe(
      "Comparatif des intégrateurs IA",
    );
    expect(s.targetSearchIntent).toBe("informational");
  });

  it("le job dérivé est toujours d'un type régénérable", () => {
    const s = deriveSourceJobFromArticle({ searchIntent: "local", title: "Sujet" });
    expect(REGENERABLE_CONTENT_TYPES.has(s.contentType)).toBe(true);
  });
});
