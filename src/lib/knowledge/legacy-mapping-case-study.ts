/**
 * KB-5 — Mapping pur `CaseStudy` (+translations) → `KnowledgeEntry` shape.
 *
 * Pattern identique à `legacy-import-mapping.ts` (KB-2) mais pour le type
 * `case_study`. Triple-source body conservée (problem + solution → bodyJson
 * structuré ou body HTML concaténé).
 */

import type {
  CaseStudy,
  CaseStudyTranslation,
  KbStatus,
  KnowledgeEntry,
  Locale,
  PublishStatus,
} from "../../../prisma/generated/client";

export interface CaseStudyWithRelations extends CaseStudy {
  translations: CaseStudyTranslation[];
}

export function mapLegacyStatusToKb(legacy: PublishStatus): KbStatus {
  switch (legacy) {
    case "draft":
      return "draft";
    case "published":
      return "published";
    case "archived":
      return "archived";
    default: {
      const _exhaustive: never = legacy;
      void _exhaustive;
      return "draft";
    }
  }
}

/**
 * Maps Prisma `CaseStudy` → `KnowledgeEntry` shape.
 * - type='case_study', domain='editorial' (cas client publics) ou 'client' (cas privé).
 *   V1 : 'editorial' systématique (case studies legacy étaient tous publics).
 * - audience='public', confidentiality='public'.
 * - slug racine = slug FR (fallback EN, fallback id).
 */
export function mapCaseStudyToEntryInput(
  cs: CaseStudyWithRelations,
): Pick<
  KnowledgeEntry,
  | "type"
  | "domain"
  | "audience"
  | "confidentiality"
  | "status"
  | "pipelineStage"
  | "slug"
  | "publishedAt"
  | "createdAt"
  | "updatedAt"
  | "viewsCount"
> {
  const frTranslation = cs.translations.find((t) => t.locale === "fr");
  const enTranslation = cs.translations.find((t) => t.locale === "en");
  const rootSlug =
    frTranslation?.slug ?? enTranslation?.slug ?? `legacy-case-study-${cs.id.slice(0, 8)}`;

  return {
    type: "case_study",
    domain: "editorial",
    audience: "public",
    confidentiality: "public",
    status: mapLegacyStatusToKb(cs.status),
    pipelineStage:
      cs.status === "published" ? "published" : cs.status === "archived" ? "archived" : "draft",
    slug: rootSlug,
    publishedAt: cs.publishedAt,
    createdAt: cs.createdAt,
    updatedAt: cs.updatedAt,
    viewsCount: 0,
  };
}

/**
 * Maps `CaseStudyTranslation` → `KnowledgeTranslation` shape.
 * Body = concaténation problem + solution (HTML) + bodyText plain.
 * bodyJson Tiptap : prefer problemJson + solutionJson en doc unifié si présents.
 */
export function mapCaseStudyTranslationInput(t: CaseStudyTranslation) {
  const concatBody = `<h2>Problème</h2>${t.problem}<h2>Solution</h2>${t.solution}`;
  const concatText = `Problème\n${t.problemText ?? t.problem}\n\nSolution\n${t.solutionText ?? t.solution}`;

  // bodyJson : si les 2 sources JSON existent, on les wrappe ; sinon null (sera re-généré côté admin).
  let bodyJson: unknown = null;
  if (t.problemJson && t.solutionJson) {
    bodyJson = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Problème" }] },
        ...(extractContent(t.problemJson) ?? []),
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Solution" }] },
        ...(extractContent(t.solutionJson) ?? []),
      ],
    };
  }

  return {
    locale: t.locale as Locale,
    title: t.title,
    slug: t.slug,
    excerpt: null,
    body: concatBody,
    bodyJson,
    bodyText: concatText,
    metaTitle: t.metaTitle,
    metaDescription: t.metaDescription,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

// Extrait le `.content` d'un doc Tiptap, ou null.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractContent(doc: any): unknown[] | null {
  if (!doc || typeof doc !== "object") return null;
  if (Array.isArray(doc.content)) return doc.content;
  return null;
}
