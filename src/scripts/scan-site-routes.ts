#!/usr/bin/env tsx
// Script scan-site-routes — Sprint Site Explorer Admin 2026-05-22.
//
// Catalogue UNIQUEMENT les URLs publiques visibles par les visiteurs réels.
// EXCLUSIONS STRICTES (skip au filesystem scan + safety net avant upsert) :
//   - (admin) / [adminPrefix] : routes console admin
//   - (auth) : routes NextAuth
//   - _next / asset routes utilitaires
//   - route.ts / actions.ts : handlers REST + Server Actions
//
// Exécution : pnpm tsx src/scripts/scan-site-routes.ts
// Idempotent : upsert by (pathPattern, pathSlug).

import { readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import type { SiteRouteType, SiteRouteStatus } from "../../prisma/generated/client";

const PROJECT_ROOT = process.cwd();
const APP_DIR = join(PROJECT_ROOT, "src", "app");
const LOCALE = "fr";

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

function walkDir(dir: string, results: string[] = []): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, results);
    } else if (entry.name === "page.tsx") {
      results.push(fullPath);
    }
  }
  return results;
}

function filePathToUrlPattern(filePath: string): string {
  const relPath = relative(APP_DIR, filePath)
    .replace(/\\/g, "/")
    .replace(/\/page\.tsx$/, "");
  return "/" + relPath.replace("[locale]", LOCALE);
}

function detectSection(urlPattern: string): string | null {
  const segments = urlPattern.split("/").filter(Boolean);
  return segments[1] ?? null;
}

function detectVerticales(section: string | null): string[] {
  const map: Record<string, string[]> = {
    audits: ["audits"],
    "interventions-formations": ["interventions_formations"],
    "un-a-un": ["un_a_un"],
    implementations: ["implementations"],
    "sites-web-augmentes": ["sites_web_augmentes"],
  };
  return section ? (map[section] ?? []) : [];
}

function calcDepth(urlPattern: string): number {
  return Math.max(0, urlPattern.split("/").filter(Boolean).length - 1);
}

function scanFilesystem(): Array<{
  pathPattern: string;
  filePath: string;
  type: SiteRouteType;
  section: string | null;
}> {
  const pages = walkDir(APP_DIR);
  const results: Array<{
    pathPattern: string;
    filePath: string;
    type: SiteRouteType;
    section: string | null;
  }> = [];

  for (const pagePath of pages) {
    const relFromApp = relative(APP_DIR, pagePath).replace(/\\/g, "/");
    const segments = relFromApp.split("/");
    if (segments.some((s) => EXCLUDED_SEGMENTS.includes(s) || s.startsWith("_"))) continue;

    const urlPattern = filePathToUrlPattern(pagePath);
    if (!isPublicPath(urlPattern)) {
      console.warn(`[scanner] REJETÉ (safety net) : ${urlPattern}`);
      continue;
    }

    const remainingParams = urlPattern.match(/\[(?!locale)[^\]]+\]/g);
    const type: SiteRouteType =
      remainingParams && remainingParams.length > 0 ? "dynamic_template" : "static";
    const section = detectSection(urlPattern);

    results.push({ pathPattern: urlPattern, filePath: `src/app/${relFromApp}`, type, section });
  }

  return results;
}

async function resolveArticles() {
  const articles = await prisma.article.findMany({
    where: { status: "published" },
    include: { translations: { where: { locale: LOCALE as never }, select: { slug: true } } },
  });

  const routes: Array<{
    pathPattern: string;
    pathRendered: string;
    pathSlug: string;
    type: SiteRouteType;
    section: string;
    editable: boolean;
    editorRoute: string;
    sourceDbTable: string;
    sourceDbId: string;
  }> = [];

  for (const article of articles) {
    const tr = article.translations[0];
    if (!tr?.slug) continue;
    const isGuide = article.templateVariant?.startsWith("guide") || tr.slug.startsWith("guide-");
    const section = isGuide ? "guides" : "blog";
    routes.push({
      pathPattern: `/fr/${section}/[slug]`,
      pathRendered: `/fr/${section}/${tr.slug}`,
      pathSlug: tr.slug,
      type: "dynamic_db",
      section,
      editable: true,
      editorRoute: adminPath("fr", `content-gen/publications/${article.id}/edit`),
      sourceDbTable: "articles",
      sourceDbId: article.id,
    });
  }
  return routes;
}

async function resolveCaseStudies() {
  const items = await prisma.caseStudy.findMany({
    where: { status: "published" },
    include: { translations: { where: { locale: LOCALE as never }, select: { slug: true } } },
  });
  return items
    .filter((cs) => cs.translations[0]?.slug)
    .map((cs) => ({
      pathPattern: `/fr/cas-concrets/[slug]`,
      pathRendered: `/fr/cas-concrets/${cs.translations[0]!.slug}`,
      pathSlug: cs.translations[0]!.slug,
      type: "dynamic_db" as SiteRouteType,
      section: "cas-concrets",
      editable: true,
      editorRoute: adminPath("fr", `case-studies/${cs.id}`),
      sourceDbTable: "case_studies",
      sourceDbId: cs.id,
    }));
}

async function resolveGallery() {
  const items = await prisma.imageAssetTranslation.findMany({
    where: { languageCode: "fr", isPublished: true },
    select: { slug: true, imageId: true },
  });
  return items
    .filter((t) => t.slug)
    .map((t) => ({
      pathPattern: `/fr/galerie/[slug]`,
      pathRendered: `/fr/galerie/${t.slug}`,
      pathSlug: t.slug,
      type: "dynamic_db" as SiteRouteType,
      section: "galerie",
      editable: false,
      editorRoute: null as string | null,
      sourceDbTable: "image_assets",
      sourceDbId: t.imageId,
    }));
}

async function resolveAuthors() {
  const items = await prisma.author.findMany({ select: { id: true, slug: true } });
  return items
    .filter((a) => a.slug)
    .map((a) => ({
      pathPattern: `/fr/equipe/[slug]`,
      pathRendered: `/fr/equipe/${a.slug}`,
      pathSlug: a.slug!,
      type: "dynamic_db" as SiteRouteType,
      section: "equipe",
      editable: false,
      editorRoute: null as string | null,
      sourceDbTable: "authors",
      sourceDbId: a.id,
    }));
}

async function resolveCityRoutes() {
  const cities = await prisma.city.findMany({
    where: { isTargeted: true },
    orderBy: { priority: "asc" },
    take: 200,
    select: { id: true, slug: true, inseeCode: true },
  });
  const verticals = [
    { pattern: `/fr/audits/[ville]`, section: "audits" },
    { pattern: `/fr/interventions-formations/[ville]`, section: "interventions-formations" },
    { pattern: `/fr/un-a-un/[ville]`, section: "un-a-un" },
    { pattern: `/fr/implementations/[ville]`, section: "implementations" },
    { pattern: `/fr/sites-web-augmentes/[ville]`, section: "sites-web-augmentes" },
  ];
  const routes: Array<{
    pathPattern: string;
    pathRendered: string;
    pathSlug: string;
    type: SiteRouteType;
    section: string;
    editable: boolean;
    editorRoute: null;
    sourceDbTable: string;
    sourceDbId: string;
    cityIds: string[];
  }> = [];
  for (const city of cities) {
    for (const v of verticals) {
      routes.push({
        pathPattern: v.pattern,
        pathRendered: v.pattern.replace("[ville]", city.slug),
        pathSlug: city.slug,
        type: "dynamic_db",
        section: v.section,
        editable: false,
        editorRoute: null,
        sourceDbTable: "cities",
        sourceDbId: city.id,
        cityIds: [city.inseeCode],
      });
    }
  }
  return routes;
}

function resolveImplantations(): Array<{
  pathPattern: string;
  pathRendered: string;
  pathSlug: string;
  type: SiteRouteType;
  section: string;
}> {
  const dir = join(PROJECT_ROOT, "src", "data", "villes", "economic-data");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => {
      const slug = f.replace(".ts", "");
      return {
        pathPattern: `/fr/implantations/[ville]`,
        pathRendered: `/fr/implantations/${slug}`,
        pathSlug: slug,
        type: "dynamic_filesystem" as SiteRouteType,
        section: "implantations",
      };
    });
}

async function upsertRoute(data: {
  pathPattern: string;
  pathSlug?: string | null;
  pathRendered?: string | null;
  type: SiteRouteType;
  status?: SiteRouteStatus;
  source: string;
  filePath?: string | null;
  section?: string | null;
  verticales?: string[];
  cityIds?: string[];
  editable?: boolean;
  editorRoute?: string | null;
  sourceDbTable?: string | null;
  sourceDbId?: string | null;
  depth?: number;
}) {
  if (!isPublicPath(data.pathPattern)) {
    console.warn(`[scanner] SKIP upsert (safety net) : ${data.pathPattern}`);
    return null;
  }
  const verticales = data.verticales ?? detectVerticales(data.section ?? null);
  const depth = data.depth ?? calcDepth(data.pathPattern);
  const pathSlug = data.pathSlug ?? null;

  return prisma.siteRoute.upsert({
    where: { pathPattern_pathSlug: { pathPattern: data.pathPattern, pathSlug: pathSlug ?? "" } },
    create: {
      pathPattern: data.pathPattern,
      pathSlug,
      pathRendered: data.pathRendered ?? null,
      type: data.type,
      status: data.status ?? "unknown",
      visibility: "public",
      source: data.source,
      filePath: data.filePath ?? null,
      section: data.section ?? null,
      verticales,
      cityIds: data.cityIds ?? [],
      editable: data.editable ?? false,
      editorRoute: data.editorRoute ?? null,
      sourceDbTable: data.sourceDbTable ?? null,
      sourceDbId: data.sourceDbId ?? null,
      depth,
    },
    update: {
      pathRendered: data.pathRendered ?? null,
      type: data.type,
      source: data.source,
      filePath: data.filePath ?? null,
      section: data.section ?? null,
      verticales,
      cityIds: data.cityIds ?? [],
      editable: data.editable ?? false,
      editorRoute: data.editorRoute ?? null,
      sourceDbTable: data.sourceDbTable ?? null,
      sourceDbId: data.sourceDbId ?? null,
      depth,
    },
  });
}

async function main() {
  console.log("[scanner] Démarrage scan routes publiques…");
  const stats = {
    static: 0,
    dynamic_template: 0,
    dynamic_db: 0,
    dynamic_filesystem: 0,
    skipped: 0,
  };

  const fsRoutes = scanFilesystem();
  for (const r of fsRoutes) {
    const result = await upsertRoute({
      pathPattern: r.pathPattern,
      pathSlug: null,
      type: r.type,
      source: "filesystem",
      filePath: r.filePath,
      section: r.section,
    });
    if (result) stats[r.type]++;
    else stats.skipped++;
  }
  console.log(`[scanner] Filesystem: ${fsRoutes.length} routes`);

  for (const [resolver, source] of [
    [resolveArticles, "prisma:articles"],
    [resolveCaseStudies, "prisma:case_studies"],
    [resolveGallery, "prisma:image_assets"],
    [resolveAuthors, "prisma:authors"],
    [resolveCityRoutes, "prisma:cities"],
  ] as const) {
    try {
      const items = await resolver();
      for (const r of items) {
        const result = await upsertRoute({ ...r, status: "live", source });
        if (result) stats.dynamic_db++;
        else stats.skipped++;
      }
      console.log(`[scanner] ${source}: ${items.length} routes`);
    } catch (e) {
      console.warn(`[scanner] ${source} skip:`, (e as Error).message);
    }
  }

  try {
    const impl = resolveImplantations();
    for (const r of impl) {
      const result = await upsertRoute({ ...r, source: "filesystem:economic-data" });
      if (result) stats.dynamic_filesystem++;
      else stats.skipped++;
    }
    console.log(`[scanner] Implantations: ${impl.length} routes`);
  } catch (e) {
    console.warn("[scanner] Implantations skip:", (e as Error).message);
  }

  const total = stats.static + stats.dynamic_template + stats.dynamic_db + stats.dynamic_filesystem;
  console.log(
    `\n[scanner] TOTAL: ${total} routes publiques (${stats.static} statiques, ${stats.dynamic_db} DB, ${stats.dynamic_template} templates, ${stats.dynamic_filesystem} filesystem, ${stats.skipped} skipped)`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[scanner] ERREUR:", e);
  process.exit(1);
});
