// Énumérateur unifié des URLs publiques — SOURCE DE VÉRITÉ de la découverte.
//
// Remplace la logique dupliquée de `src/scripts/scan-site-routes.ts` (qui
// plafonnait les villes à 200, se trompait de patterns `/fr/audits/[ville]` et
// oubliait connaissances/KB, actualités, glossaire, FAQ, presse, comparaisons,
// stack-ia, implementation/par-fonction). Réutilise les MÊMES fonctions de
// contenu que `src/app/sitemap.ts` pour rester en phase avec ce que le site
// rend réellement. FR canonique uniquement (EN désactivé, cf. AGENTS.md).
//
// Chaque source est isolée dans un try/catch : une source qui throw (DB
// indisponible, fixture cassée) ne fait jamais échouer tout le scan. Sous build
// `stub.invalid`, le Proxy Prisma renvoie [] → les sources DB sont simplement
// vides (les sources fichiers/TS restent découvertes).

import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { SITE_URL } from "@/lib/seo";

import { VILLES, getIndexableVilles } from "@/content/villes";
import { REGIONS } from "@/content/regions";
import {
  getIndexableBlogPosts,
  getAllBlogSectorSlugs,
  getAllBlogCompanySizeSlugs,
  getAllBlogServiceTypeSlugs,
} from "@/content/blog";
import {
  getAllBlogCategorySlugs,
  getAllBlogTagSlugs,
  getAllBlogAuthorSlugs,
  getAllFaqIds,
  getAllHelpSlugs,
  getAllHelpCategorySlugs,
} from "@/content/transversal";
import { getAllComparisonSlugs } from "@/content/comparaisons";
import { getAllSlugs as getAllCaseStudySlugs, getAllIndustrySlugs } from "@/content/case-studies";
import { AUTOMATISATION_SLUGS_FR } from "@/content/automatisations";
import { listGlossaryTermSlugs } from "@/content/glossary-extension";
import { getAllStackToolSlugs } from "@/content/stack-ia-details";
import { PRESS_RELEASES } from "@/content/press";
import {
  buildKnowledgeSitemapChunk,
  countKnowledgePublicEntries,
} from "@/server/exporters/knowledge-sitemap";

import type { SiteRouteType } from "../../../prisma/generated/client";
import type { ArticleIndexationTier } from "./indexability";

const LOCALE = "fr";

/** Route brute découverte (avant enrichissement indexabilité + catégorie). */
export interface EnumeratedRoute {
  pathPattern: string;
  pathRendered: string | null;
  pathSlug: string | null;
  type: SiteRouteType;
  section: string | null;
  source: string;
  filePath?: string | null;
  editable?: boolean;
  editorRoute?: string | null;
  sourceDbTable?: string | null;
  sourceDbId?: string | null;
  cityIds?: string[];
  /** Tier d'indexation (articles DB) — propagé à `computeIndexability`. */
  articleTier?: ArticleIndexationTier | string | null;
}

// ─────────────────────────── Helpers ───────────────────────────

function sectionOf(pathPattern: string): string | null {
  const segments = pathPattern.split("/").filter(Boolean);
  // [0] = locale, [1] = section
  return segments[1] ?? null;
}

function dbRoute(
  pattern: string,
  slug: string,
  partial: Partial<EnumeratedRoute> & { source: string },
): EnumeratedRoute {
  return {
    pathPattern: pattern,
    pathRendered: pattern.replace(/\[[^\]]+\]/, slug),
    pathSlug: slug,
    type: "dynamic_db",
    section: sectionOf(pattern),
    ...partial,
  };
}

function fsListRoute(pattern: string, slug: string, source: string): EnumeratedRoute {
  return {
    pathPattern: pattern,
    pathRendered: pattern.replace(/\[[^\]]+\]/, slug),
    pathSlug: slug,
    type: "dynamic_filesystem",
    section: sectionOf(pattern),
    source,
  };
}

// ─────────────────────────── Filesystem (statiques + templates) ───────────────────────────

const APP_DIR = join(process.cwd(), "src", "app");
const EXCLUDED_SEGMENTS = ["(admin)", "[adminPrefix]", "(auth)", "api", ".well-known"];

function isPublicPath(pathPattern: string): boolean {
  const forbidden = [
    "(admin)",
    "[adminPrefix]",
    "(auth)",
    "/api/",
    "_next",
    "/api",
    "/login",
    "/logout",
  ];
  return !forbidden.some((f) => pathPattern.includes(f));
}

function walkPages(dir: string, results: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkPages(full, results);
    else if (entry.name === "page.tsx") results.push(full);
  }
  return results;
}

function scanFilesystem(): EnumeratedRoute[] {
  const out: EnumeratedRoute[] = [];
  for (const file of walkPages(APP_DIR)) {
    const relFromApp = relative(APP_DIR, file).replace(/\\/g, "/");
    if (relFromApp.split("/").some((s) => EXCLUDED_SEGMENTS.includes(s) || s.startsWith("_")))
      continue;
    const pattern = "/" + relFromApp.replace(/\/page\.tsx$/, "").replace("[locale]", LOCALE);
    if (!isPublicPath(pattern)) continue;
    const params = pattern.match(/\[(?!locale)[^\]]+\]/g);
    out.push({
      pathPattern: pattern,
      pathRendered: params ? null : pattern,
      pathSlug: null,
      type: params && params.length > 0 ? "dynamic_template" : "static",
      section: sectionOf(pattern),
      source: "filesystem",
      filePath: `src/app/${relFromApp}`,
    });
  }
  return out;
}

// ─────────────────────────── Sources DB ───────────────────────────

async function enumArticles(): Promise<EnumeratedRoute[]> {
  const articles = await prisma.article.findMany({
    where: { status: "published" },
    select: {
      id: true,
      isNews: true,
      indexationTier: true,
      templateVariant: true,
      translations: { where: { locale: LOCALE as never }, select: { slug: true } },
    },
  });
  const out: EnumeratedRoute[] = [];
  for (const a of articles) {
    const slug = a.translations[0]?.slug;
    if (!slug) continue;
    const isGuide = a.templateVariant?.startsWith("guide") || slug.startsWith("guide-");
    const section = a.isNews ? "actualites" : isGuide ? "guides" : "blog";
    out.push(
      dbRoute(`/fr/${section}/[slug]`, slug, {
        source: "prisma:articles",
        articleTier: a.indexationTier as string,
        editable: true,
        editorRoute: adminPath("fr", `content-gen/publications/${a.id}/edit`),
        sourceDbTable: "articles",
        sourceDbId: a.id,
      }),
    );
  }
  return out;
}

async function enumCaseStudiesDb(): Promise<EnumeratedRoute[]> {
  const items = await prisma.caseStudy.findMany({
    where: { status: "published" },
    select: {
      id: true,
      translations: { where: { locale: LOCALE as never }, select: { slug: true } },
    },
  });
  return items
    .map((cs) => ({ id: cs.id, slug: cs.translations[0]?.slug }))
    .filter((x): x is { id: string; slug: string } => !!x.slug)
    .map((x) =>
      dbRoute(`/fr/cas-concrets/[slug]`, x.slug, {
        source: "prisma:case_studies",
        editable: true,
        editorRoute: adminPath("fr", `case-studies/${x.id}`),
        sourceDbTable: "case_studies",
        sourceDbId: x.id,
      }),
    );
}

async function enumGallery(): Promise<EnumeratedRoute[]> {
  const items = await prisma.imageAssetTranslation.findMany({
    where: { languageCode: "fr", isPublished: true },
    select: { slug: true, imageId: true },
  });
  const out: EnumeratedRoute[] = [];
  for (const t of items) {
    if (!t.slug) continue;
    out.push(
      dbRoute(`/fr/galerie/[slug]`, t.slug, {
        source: "prisma:image_assets",
        sourceDbTable: "image_assets",
        sourceDbId: t.imageId,
      }),
    );
    out.push(
      dbRoute(`/fr/galerie/[slug]/telecharger`, t.slug, {
        source: "prisma:image_assets",
        sourceDbTable: "image_assets",
        sourceDbId: t.imageId,
      }),
    );
  }
  return out;
}

async function enumAuthors(): Promise<EnumeratedRoute[]> {
  const items = await prisma.author.findMany({ select: { id: true, slug: true } });
  return items
    .filter((a): a is { id: string; slug: string } => !!a.slug)
    .map((a) =>
      dbRoute(`/fr/equipe/[slug]`, a.slug, {
        source: "prisma:authors",
        sourceDbTable: "authors",
        sourceDbId: a.id,
      }),
    );
}

async function enumKnowledge(): Promise<EnumeratedRoute[]> {
  const total = await countKnowledgePublicEntries();
  if (total <= 0) return [];
  const CHUNK = 1000;
  const chunks = Math.ceil(total / CHUNK);
  const out: EnumeratedRoute[] = [];
  const seen = new Set<string>();
  for (let i = 1; i <= chunks; i++) {
    const entries = await buildKnowledgeSitemapChunk(i, CHUNK);
    for (const e of entries) {
      const rendered = e.url.replace(SITE_URL, "");
      if (!rendered.startsWith("/fr/")) continue; // FR canonique uniquement
      if (seen.has(rendered)) continue;
      seen.add(rendered);
      const segments = rendered.split("/").filter(Boolean); // [fr, section, ..., slug]
      if (segments.length < 3) continue;
      const slug = segments[segments.length - 1]!;
      const pattern = segments.slice(0, -1).join("/");
      out.push({
        pathPattern: `/${pattern}/[slug]`,
        pathRendered: rendered,
        pathSlug: slug,
        type: "dynamic_db",
        section: segments[1] ?? null,
        source: "prisma:knowledge",
        sourceDbTable: "knowledge_entries",
      });
    }
  }
  return out;
}

// ─────────────────────────── Villes (hub + 5 verticales) ───────────────────────────

const SERVICE_VILLE_PATHS = [
  {
    key: "audit",
    segment: "audit",
    hasCopy: (v: (typeof VILLES)[number]) => !!v.copy?.services?.audit,
  },
  {
    key: "interventions",
    segment: "interventions",
    hasCopy: (v: (typeof VILLES)[number]) => !!v.copy?.services?.interventions,
  },
  {
    key: "implementation",
    segment: "implementation",
    hasCopy: (v: (typeof VILLES)[number]) => !!v.copy?.services?.implementation,
  },
  {
    key: "un-a-un",
    segment: "un-a-un",
    hasCopy: (v: (typeof VILLES)[number]) => !!v.copy?.services?.unAUn,
  },
  {
    key: "sites-web-augmentes",
    segment: "sites-web-augmentes",
    hasCopy: (v: (typeof VILLES)[number]) => !!v.copy?.services?.sitesWeb,
  },
] as const;

function enumVilles(): EnumeratedRoute[] {
  const out: EnumeratedRoute[] = [];
  // Pages région `/fr/implantations/<region>` (métropole) — l'indexabilité
  // (Corse noindex, etc.) est décidée par computeIndexability.
  for (const region of REGIONS) {
    if (region.type !== "metropole") continue;
    out.push({
      pathPattern: `/fr/implantations/[region]`,
      pathRendered: `/fr/implantations/${region.slug}`,
      pathSlug: region.slug,
      type: "dynamic_filesystem",
      section: "implantations",
      source: "content:regions",
    });
  }
  // Hub ville `/fr/implantations/<region>/<slug>` — toutes les villes AVEC copy
  // (indexables à terme ; le drip décide si index|noindex aujourd'hui).
  for (const ville of getIndexableVilles()) {
    out.push({
      pathPattern: `/fr/implantations/[region]/[ville]`,
      pathRendered: `/fr/implantations/${ville.region}/${ville.slug}`,
      pathSlug: ville.slug,
      type: "dynamic_filesystem",
      section: "implantations",
      source: "content:villes",
      sourceDbTable: "cities",
      cityIds: [ville.inseeCode],
    });
    // Pages ville×service — uniquement si copy.services.<verticale> présent
    // (sinon stub anti-doorway permanent, non catalogué = bruit).
    for (const svc of SERVICE_VILLE_PATHS) {
      if (!svc.hasCopy(ville)) continue;
      out.push({
        pathPattern: `/fr/${svc.segment}/par-ville/[ville]`,
        pathRendered: `/fr/${svc.segment}/par-ville/${ville.slug}`,
        pathSlug: ville.slug,
        type: "dynamic_filesystem",
        section: svc.segment,
        source: "content:villes",
        sourceDbTable: "cities",
        cityIds: [ville.inseeCode],
      });
    }
  }
  return out;
}

// ─────────────────────────── Contenu fixtures (TS) ───────────────────────────

function enumFixtureContent(): EnumeratedRoute[] {
  const out: EnumeratedRoute[] = [];
  const add = (pattern: string, slugs: ReadonlyArray<string>, source: string) => {
    for (const s of slugs) out.push(fsListRoute(pattern, String(s), source));
  };

  // Blog (fixtures FS) + taxonomies
  add(
    `/fr/blog/[slug]`,
    getIndexableBlogPosts().map((p) => p.slug),
    "content:blog",
  );
  add(`/fr/blog/categorie/[slug]`, getAllBlogCategorySlugs(), "content:blog");
  add(`/fr/blog/tag/[slug]`, getAllBlogTagSlugs(), "content:blog");
  add(`/fr/blog/auteur/[slug]`, getAllBlogAuthorSlugs(), "content:blog");
  add(`/fr/blog/secteur/[slug]`, getAllBlogSectorSlugs(), "content:blog");
  add(`/fr/blog/taille/[slug]`, getAllBlogCompanySizeSlugs(), "content:blog");
  add(`/fr/blog/service/[slug]`, getAllBlogServiceTypeSlugs(), "content:blog");

  // Cas concrets (fixtures) + filtres secteur
  add(`/fr/cas-concrets/[slug]`, getAllCaseStudySlugs(), "content:case-studies");
  add(`/fr/cas-concrets/secteur/[slug]`, getAllIndustrySlugs(), "content:case-studies");

  // FAQ + centre d'aide
  add(`/fr/faq/[slug]`, getAllFaqIds(), "content:faq");
  add(`/fr/centre-aide/[slug]`, getAllHelpSlugs(), "content:help");
  add(`/fr/centre-aide/categorie/[slug]`, getAllHelpCategorySlugs(), "content:help");

  // Glossaire, comparaisons, implementation par-fonction, stack-ia
  add(`/fr/glossaire/[slug]`, listGlossaryTermSlugs(), "content:glossary");
  add(`/fr/comparaisons/[slug]`, getAllComparisonSlugs(), "content:comparaisons");
  add(`/fr/implementation/par-fonction/[slug]`, AUTOMATISATION_SLUGS_FR, "content:automatisations");
  add(`/fr/stack-ia/[slug]`, getAllStackToolSlugs(), "content:stack-ia");

  // Presse
  const pressSlugs = (PRESS_RELEASES as ReadonlyArray<{ slug: string }>).map((r) => r.slug);
  add(`/fr/presse/[slug]`, pressSlugs, "content:press");

  return out;
}

// ─────────────────────────── Orchestration ───────────────────────────

/**
 * Énumère TOUTES les URLs publiques (FR canonique). Robuste : chaque source est
 * isolée ; une erreur de source est loguée et la découverte continue.
 */
export async function enumerateAllRoutes(): Promise<EnumeratedRoute[]> {
  const all: EnumeratedRoute[] = [];
  const sync: Array<[string, () => EnumeratedRoute[]]> = [
    ["filesystem", scanFilesystem],
    ["villes", enumVilles],
    ["fixtures", enumFixtureContent],
  ];
  for (const [name, fn] of sync) {
    try {
      all.push(...fn());
    } catch (e) {
      console.warn(`[route-enumerator] source "${name}" failed:`, (e as Error).message);
    }
  }

  const asyncSources: Array<[string, () => Promise<EnumeratedRoute[]>]> = [
    ["articles", enumArticles],
    ["case-studies", enumCaseStudiesDb],
    ["gallery", enumGallery],
    ["authors", enumAuthors],
    ["knowledge", enumKnowledge],
  ];
  for (const [name, fn] of asyncSources) {
    try {
      all.push(...(await fn()));
    } catch (e) {
      console.warn(`[route-enumerator] source "${name}" failed:`, (e as Error).message);
    }
  }

  return all;
}
