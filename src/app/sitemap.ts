import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";
import { getAllSlugs as getAllCaseStudySlugs, getAllIndustrySlugs } from "@/content/case-studies";
import {
  getAllBlogCategorySlugs,
  getAllBlogTagSlugs,
  getAllBlogAuthorSlugs,
  getAllFaqIds,
  getAllHelpSlugs,
  getAllHelpCategorySlugs,
} from "@/content/transversal";
import { getAllComparisonSlugs } from "@/content/comparaisons";
import { AUTOMATISATION_SLUGS_FR, AUTOMATISATION_SLUGS_EN } from "@/content/automatisations";
import { getIndexableRegions } from "@/content/regions";
import { getIndexableVilles } from "@/content/villes";
import {
  getIndexableBlogPosts,
  getAllBlogSectorSlugs,
  getAllBlogCompanySizeSlugs,
  getAllBlogServiceTypeSlugs,
} from "@/content/blog";
import {
  buildKnowledgeSitemapChunk,
  countKnowledgePublicEntries,
} from "@/server/exporters/knowledge-sitemap";
import { prisma } from "@/lib/prisma";
// Sprint S+4-A 2026-05-18 — glossary extension (60 termes /glossaire/[slug]).
import { listGlossaryTermSlugs } from "@/content/glossary-extension";
// Sprint S+4-B 2026-05-18 (audit P1-17 TYPE-9-STACK-IA) — pages détail outils.
import { getAllStackToolSlugs } from "@/content/stack-ia-details";
// Sprint S+4-D 2026-05-18 (audit 19-TYPE-8-PRESSE P1-18) — sub-sitemap dédié
// communiqués de presse (`/presse/[slug]` × N locales). Source = PRESS_RELEASES
// (fixtures éditoriales `src/content/press.ts`, lastmod = `publishedAt`).
import { PRESS_RELEASES } from "@/content/press";

// Next.js 16 sitemap-index pattern via `generateSitemaps()`.
//
// Static sub-sitemaps :
//   /sitemap.xml                    = sitemap-index (auto, lists sub-sitemaps)
//   /sitemap/pages.xml              = static routes (excluding [slug] templates + dev shells)
//   /sitemap/blog.xml               = posts + categories + tags + authors (lastModified = publishedAt)
//   /sitemap/help.xml               = centre-aide + faq
//   /sitemap/cas-concrets.xml       = case studies + industry filters
//   /sitemap/comparaisons.xml       = comparison pages
//   /sitemap/implementation.xml     = /par-fonction/[slug] programmatic
//   /sitemap/implantations.xml      = hub + 12 régions indexable (Corse noindex)
//
// Dynamic sub-sitemaps (auto-paginés à 1 000 URLs max — best practice 2026) :
//   /sitemap/villes-<region>.xml         = villes indexables de la région (≤ 1 000 URLs)
//   /sitemap/villes-<region>-<n>.xml     = chunk N quand région > 500 villes indexables
//
// Why split + chunking?
//   - Google hard limit = 50 000 URLs/sitemap, mais qualité crawl dégrade > 1 000 URLs/file
//   - Search Console diagnostics granulaires (problème localisé à 1 chunk de 1K, pas 50K)
//   - Scale 100 K+ URLs sans toucher à ce fichier — `getIndexableVilles()` peut grandir
//     à 2 150 villes (V2 phase 2/3) ou plus, le chunking auto suit
//   - Crawl budget priorisé : Google peut « refresher » `pages` (weekly) sans re-crawler
//     les chunks villes (monthly)
//
// Each entry exposes `alternates.languages` per next-intl pathnames map so
// search engines pick the correct localized URL (Google ignores `priority`
// since 2017 but still uses hreflang + lastmod + changefreq for crawl budget).

/**
 * Best-practice cap par sub-sitemap : 1 000 URLs.
 * Limite hard Google = 50 000. On reste à 2 % du plafond pour garder
 * Search Console lisible et le crawl budget bien alloué.
 */
const SITEMAP_CHUNK_SIZE = 1000;

type StaticSitemapId =
  | "pages"
  | "blog"
  | "faq"
  | "help"
  | "cas-concrets"
  | "comparaisons"
  // Sprint S+3 P0-7 (audit 18-TYPE-7) — hub `/guides` dans son propre sub-sitemap.
  // Les guides individuels restent émis via sub-sitemap `blog` (continuité Articles).
  // Le sub-sitemap `guides` ne contient que le hub lui-même (lastmod = BUILD_TIME).
  | "guides"
  // Sprint S+4-A 2026-05-18 (audit 22-TYPE-11) — sub-sitemap dédié glossaire
  // (hub /glossaire + 60 termes /glossaire/[slug]).
  | "glossaire"
  // Sprint S+4-D 2026-05-18 (audit 19-TYPE-8-PRESSE P1-18) — sub-sitemap dédié
  // communiqués de presse (`/presse/[slug]` × N locales). Le hub `/presse`
  // reste émis via `pages.xml` (statique routing.pathnames).
  | "presse"
  | "implementation"
  | "implantations"
  | "services-villes-audit"
  | "services-villes-interventions"
  | "services-villes-implementation"
  // Sprint S+2 City Domination — 4e verticale `un-a-un` × villes (~2150 routes).
  | "services-villes-un-a-un"
  // Sprint S+4-B City Domination 2026-05-18 (audit P1-17 TYPE-9-STACK-IA) —
  // sub-sitemap dédié pour les 11 pages détail outils `/stack-ia/[tool]`.
  // ~22 URLs V1 (11 outils × 2 locales). Sub-sitemap propre pour isoler le
  // diagnostic Product JSON-LD côté Search Console. Scale prête pour +5
  // outils/trimestre sans refactor.
  | "stack-ia-tools";

type ServiceVillesKey = "audit" | "interventions" | "implementation" | "un-a-un";

type PathnameKey = keyof typeof routing.pathnames;

const EXCLUDED_FROM_INDEX: ReadonlyArray<PathnameKey> = [
  "/design",
  "/components",
  "/sections",
  "/desabonnement",
  "/mes-donnees",
  // Audit méta-cert 2026-05-15 AGENT 13 P1-1 — `/mes-donnees/export` exposait
  // un statut HTML `robots:noindex` mais figurait dans `sitemap/pages.xml`
  // (incohérence Search Console "noindexed URL in sitemap"). Comme la version
  // EN `/my-data/export` partage le même endpoint, on exclut la clé canonique.
  "/mes-donnees/export",
  "/confirmation",
  "/recherche",
  "/preferences-cookies",
  // Audit méta-cert 2026-05-15 AGENT 13 P1-2 — `/reserver` est `Disallow:` dans
  // `robots.ts` (formulaire deposit-gated, pas pertinent SERP). On le retire
  // aussi du sitemap pour cohérence (sinon GSC affiche "no description").
  "/reserver",
];

function isSlugTemplate(key: PathnameKey): boolean {
  return /\[[^\]]+\]/.test(key as string);
}

function localizedHref(key: PathnameKey, locale: (typeof routing.locales)[number]): string {
  const def = routing.pathnames[key];
  if (typeof def === "string") return def;
  return (def as Record<string, string>)[locale] ?? (def as Record<string, string>).fr ?? key;
}

// EN locale désactivé (2026-05-16) → on filtre les EN URLs hors du sitemap
// pour ne pas dépenser de crawl budget Google sur des 301s. Quand EN sera
// réactivé (EN_LOCALE_ENABLED=true), les URLs EN reviennent automatiquement.
// Import dynamique pour éviter import circulaire/Edge runtime issues.
const EN_LOCALE_DISABLED = process.env.EN_LOCALE_ENABLED !== "true";
const effectiveLocales = EN_LOCALE_DISABLED
  ? routing.locales.filter((l) => l !== "en")
  : [...routing.locales];

function alternateLanguages(
  key: PathnameKey,
): Record<(typeof routing.locales)[number] | "x-default", string> {
  const map = Object.fromEntries(
    effectiveLocales.map((alt) => [alt, `${SITE_URL}/${alt}${localizedHref(key, alt)}`]),
  ) as Record<(typeof routing.locales)[number], string>;
  return {
    ...map,
    "x-default": `${SITE_URL}/${routing.defaultLocale}${localizedHref(key, routing.defaultLocale)}`,
  };
}

interface DynamicSlug {
  /** FR-canonical path with `:slug` placeholder. */
  fr: string;
  /** EN mirror path (defaults to FR). */
  en?: string;
  /** FR-canonical slugs. */
  slugs: ReadonlyArray<string>;
  /**
   * Optional EN-translated slugs aligned by index with `slugs`.
   * Use when EN slug is genuinely different (ex: `customer-service` for
   * `service-client` in `/implementation/by-function/`). Defaults to `slugs`.
   */
  slugsEn?: ReadonlyArray<string>;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
  /** Optional per-slug lastModified resolver. Defaults to `now`. */
  lastModFor?: (slug: string) => Date | string;
}

function buildDynamic(entries: ReadonlyArray<DynamicSlug>, now: Date): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = [];
  for (const entry of entries) {
    for (let i = 0; i < entry.slugs.length; i++) {
      const slugFr = entry.slugs[i]!;
      const slugEn = entry.slugsEn?.[i] ?? slugFr;
      const lastMod = entry.lastModFor?.(slugFr) ?? now;
      const frUrl = `${SITE_URL}/fr${entry.fr.replace(":slug", slugFr)}`;
      const enUrl = `${SITE_URL}/en${(entry.en ?? entry.fr).replace(":slug", slugEn)}`;
      out.push({
        url: frUrl,
        lastModified: lastMod,
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
        alternates: {
          languages: {
            fr: frUrl,
            en: enUrl,
            "x-default": frUrl,
          },
        },
      });
      out.push({
        url: enUrl,
        lastModified: lastMod,
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
        alternates: {
          languages: {
            fr: frUrl,
            en: enUrl,
            "x-default": frUrl,
          },
        },
      });
    }
  }
  return out;
}

// Liste stable des IDs villes-<region>[-<chunk>] dérivée de `getIndexableVilles()`.
// L'ordre est déterministe (par regionSlug ascendant + chunkIdx) pour que les IDs
// restent identiques entre builds — Google n'aime pas qu'un sub-sitemap apparaisse
// puis disparaisse sans raison.
function getVillesSitemapIds(): string[] {
  const ids: string[] = [];
  const indexable = getIndexableVilles();
  const regions = [...getIndexableRegions()].sort((a, b) => a.slug.localeCompare(b.slug));

  for (const region of regions) {
    const villesInRegion = indexable.filter((v) => v.region === region.slug);
    if (villesInRegion.length === 0) continue;

    // 2 locales (FR + EN) par ville → multiplie le compte d'URLs par 2
    const totalUrls = villesInRegion.length * 2;
    const chunkCount = Math.ceil(totalUrls / SITEMAP_CHUNK_SIZE);

    if (chunkCount <= 1) {
      ids.push(`villes-${region.slug}`);
    } else {
      for (let i = 1; i <= chunkCount; i++) {
        ids.push(`villes-${region.slug}-${i}`);
      }
    }
  }
  return ids;
}

// `generateSitemaps` — déclare tous les sub-sitemaps (statiques + dynamiques villes + KB).
// Next.js 16 wrap ces IDs dans `/sitemap.xml` (sitemap-index auto) et expose
// chaque enfant à `/sitemap/<id>.xml`.
//
// KB DB-aware (Sprint SEO 2026-05-14) : `knowledge-1`, `knowledge-2`, ... chunkés
// à 1 000 entries/chunk. Le compte vient de `countKnowledgePublicEntries()` qui
// lit la DB (audience='public', status published/deprecated, deletedAt null).
// Bootstrap-safe : 0 chunks si table pas migrée (premier deploy KB).
export async function generateSitemaps(): Promise<Array<{ id: string }>> {
  const staticIds: StaticSitemapId[] = [
    "pages",
    "blog",
    // Audit final P1-12 fix : split sitemap-faq.xml dédié (auparavant bundled
    // `help.xml`). QAPage Speakable distincte.
    //
    // Audit Sitemap+IndexNow 2026-05-15 (AGENT 4 §4.1.3 P0-3) : "news" RETIRÉ
    // d'ici car la convention `MetadataRoute.Sitemap` Next 16 ne supporte pas
    // le namespace `xmlns:news` requis par Google News. Le sitemap-news vit
    // désormais dans `app/sitemap-news.xml/route.ts` (Route Handler XML brut
    // conforme spec, fenêtre 48h stricte, max 1000 URLs). Référencé dans
    // `app/sitemap-index.xml/route.ts` manuellement.
    "faq",
    "help",
    "cas-concrets",
    "comparaisons",
    // Sprint S+3 P0-7 (audit 18-TYPE-7) — sub-sitemap dédié hub /guides.
    "guides",
    // Sprint S+4-A 2026-05-18 (audit 22-TYPE-11) — sub-sitemap glossaire (hub + 60 termes).
    "glossaire",
    // Sprint S+4-D 2026-05-18 (audit 19-TYPE-8-PRESSE P1-18) — sub-sitemap presse
    // (`/presse/[slug]` × N locales, lastmod = `publishedAt` réel par release).
    "presse",
    "implementation",
    "implantations",
    "services-villes-audit",
    "services-villes-interventions",
    "services-villes-implementation",
    // Sprint S+2 City Domination — 4e verticale industrialisation Phase 1.
    "services-villes-un-a-un",
    // Sprint S+4-B City Domination 2026-05-18 (audit P1-17 TYPE-9-STACK-IA) —
    // ~22 URLs V1 (11 outils × 2 locales). Statique.
    "stack-ia-tools",
  ];

  // KB : dériver le nombre de chunks depuis le count DB. Lecture unique au
  // build (puis next-intl SSG fige). Bootstrap-safe (count=0 si P2021).
  const kbCount = await countKnowledgePublicEntries();
  const kbChunkCount = kbCount > 0 ? Math.ceil((kbCount * 2) / SITEMAP_CHUNK_SIZE) : 0;
  const knowledgeIds: string[] = [];
  for (let i = 1; i <= kbChunkCount; i++) knowledgeIds.push(`knowledge-${i}`);

  return [
    ...staticIds.map((id) => ({ id })),
    ...getVillesSitemapIds().map((id) => ({ id })),
    ...knowledgeIds.map((id) => ({ id })),
  ];
}

/**
 * `now` stable au build via `process.env.BUILD_TIME` (injecté par `next.config.ts`).
 *
 * Pourquoi : un `lastModified` qui change à chaque build (cf. `new Date()` runtime)
 * est rapidement disqualifié par Google — il considère que le signal n'est pas
 * fiable et arrête d'en tenir compte pour prioriser le crawl. Un timestamp figé
 * au build (BUILD_TIME ISO) reflète honnêtement la dernière mise en prod, ce
 * qui est la signification utile : « ce contenu a été reconstruit le X ».
 *
 * Fallback `new Date()` en dev local (BUILD_TIME absent) — pas d'impact car les
 * sitemaps de dev ne sont pas crawlés.
 */
function buildTimeOrNow(): Date {
  const iso = process.env.BUILD_TIME;
  if (iso) {
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/**
 * Filtre les entries EN si locale EN désactivé (env EN_LOCALE_ENABLED!=true).
 * Élimine les URLs /en/* du sitemap pour éviter que Googlebot crawle des 301s.
 * Nettoie aussi les `alternates.languages.en` qui pointeraient vers 301.
 */
function filterEnIfDisabled(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  if (!EN_LOCALE_DISABLED) return entries;
  return entries
    .filter((e) => !e.url.includes("/en/") && !e.url.endsWith("/en"))
    .map((e) => {
      const langs = e.alternates?.languages;
      if (!langs) return e;
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(langs)) {
        if (k !== "en" && typeof v === "string") cleaned[k] = v;
      }
      return { ...e, alternates: { languages: cleaned } };
    });
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  const now = buildTimeOrNow();

  // Static IDs
  switch (id) {
    case "pages":
      return filterEnIfDisabled(buildPagesSitemap(now));
    case "blog":
      return filterEnIfDisabled(await buildBlogSitemap(now));
    case "faq":
      return filterEnIfDisabled(buildFaqSitemap(now));
    case "help":
      return filterEnIfDisabled(buildHelpSitemap(now));
    case "cas-concrets":
      return filterEnIfDisabled(buildCasConcretsSitemap(now));
    case "comparaisons":
      return filterEnIfDisabled(buildComparaisonsSitemap(now));
    case "guides":
      return filterEnIfDisabled(buildGuidesHubSitemap(now));
    case "glossaire":
      return filterEnIfDisabled(buildGlossarySitemap(now));
    case "presse":
      return filterEnIfDisabled(buildPresseSitemap(now));
    case "implementation":
      return filterEnIfDisabled(buildImplementationSitemap(now));
    case "implantations":
      return filterEnIfDisabled(buildImplantationsHubSitemap(now));
    case "services-villes-audit":
      return filterEnIfDisabled(buildServicesVillesSitemap(now, "audit"));
    case "services-villes-interventions":
      return filterEnIfDisabled(buildServicesVillesSitemap(now, "interventions"));
    case "services-villes-implementation":
      return filterEnIfDisabled(buildServicesVillesSitemap(now, "implementation"));
    // Sprint S+2 City Domination — 4e verticale un-a-un sitemap dédié.
    case "services-villes-un-a-un":
      return filterEnIfDisabled(buildServicesVillesSitemap(now, "un-a-un"));
    // Sprint S+4-B City Domination 2026-05-18 — pages détail outils stack-ia.
    case "stack-ia-tools":
      return filterEnIfDisabled(buildStackIaToolsSitemap(now));
  }

  // Dynamic IDs : `villes-<regionSlug>` ou `villes-<regionSlug>-<chunkIdx>`.
  // Les regionSlugs ne se terminent jamais par `-<chiffres>` (cf. REGIONS),
  // donc parsing structurel sans ambiguïté.
  if (id.startsWith("villes-")) {
    const rest = id.slice("villes-".length);
    const trailMatch = rest.match(/^(.+)-(\d+)$/);
    if (trailMatch) {
      return filterEnIfDisabled(
        buildVillesByRegionSitemap(trailMatch[1]!, parseInt(trailMatch[2]!, 10), now),
      );
    }
    return filterEnIfDisabled(buildVillesByRegionSitemap(rest, 1, now));
  }

  // KB DB-aware (Sprint SEO 2026-05-14) : `knowledge-<chunkIdx>`.
  // Couvre les entries `audience='public'` publiées via le content-gen V1.
  // Dédup vs slugs déjà émis par les builders TS (blog tier-1, case studies,
  // help, faq, glossaire, guide) pour éviter doublons sitemap-index.
  if (id.startsWith("knowledge-")) {
    const chunkMatch = id.slice("knowledge-".length).match(/^(\d+)$/);
    if (!chunkMatch) return [];
    return filterEnIfDisabled(
      await buildKnowledgeSitemapChunk(
        parseInt(chunkMatch[1]!, 10),
        SITEMAP_CHUNK_SIZE,
        buildExcludeSlugsByType(),
      ),
    );
  }

  return [];
}

/**
 * Dédup KB DB-aware : retourne, par type KB, l'ensemble des slugs déjà émis
 * par les builders TS. Le builder DB sautera ces slugs pour éviter qu'un même
 * article apparaisse 2 fois dans sitemap-index (une fois via TS file, une
 * fois via DB row).
 *
 * Convention : on dédupe sur le tuple (type, slug). Si un blog post tier-1
 * existe dans `@/content/blog/posts/*.ts` ET est aussi en DB (cas migration
 * progressive TS → DB), le builder TS gagne (contenu canonique pré-factory).
 *
 * IMPORTANT : tenir cette map en sync avec les builders. Tout nouveau builder
 * TS qui émet des slugs pour un type KB doit ajouter son set ici.
 */
function buildExcludeSlugsByType(): ReadonlyMap<string, ReadonlySet<string>> {
  const map = new Map<string, Set<string>>();

  // article ← @/content/blog (tier-1 only, déjà filtré par getIndexableBlogPosts)
  map.set("article", new Set(getIndexableBlogPosts().map((p) => p.slug)));

  // case_study ← @/content/case-studies
  map.set("case_study", new Set(getAllCaseStudySlugs()));

  // help_article ← @/content/transversal (centre-aide)
  map.set("help_article", new Set(getAllHelpSlugs()));

  // faq ← @/content/transversal
  map.set("faq", new Set(getAllFaqIds()));

  // glossary_term, guide : pas de fichiers TS aujourd'hui, slugs viennent
  // uniquement de la DB → set vide = aucune exclusion.
  map.set("glossary_term", new Set());
  map.set("guide", new Set());

  return map;
}

// ---------- builders ----------

// Static routes — declared in `routing.pathnames` minus excluded + slug templates.
// Priority 1.0 (home) > 0.8 (depth 2) > 0.6 (depth ≥ 3). changefreq weekly.
function buildPagesSitemap(now: Date): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const key of Object.keys(routing.pathnames) as PathnameKey[]) {
    if (EXCLUDED_FROM_INDEX.includes(key)) continue;
    if (isSlugTemplate(key)) continue;
    for (const locale of effectiveLocales) {
      const url = `${SITE_URL}/${locale}${localizedHref(key, locale)}`;
      entries.push({
        url,
        lastModified: now,
        changeFrequency: "weekly",
        priority: key === "/" ? 1 : (key as string).split("/").length === 2 ? 0.8 : 0.6,
        alternates: { languages: alternateLanguages(key) },
      });
    }
  }
  return entries;
}

// Blog posts use real `publishedAt` for `lastModified` — Google rewards
// accurate lastmod (signal not gameable, used for crawl prioritization).
// Categories / tags / authors stay on `now` (the listing page changes when
// a new post enters the corpus).
async function buildBlogSitemap(now: Date): Promise<MetadataRoute.Sitemap> {
  // Anti-doorway HCU 2024 (Sprint 14.10) : seuls les articles tier-1 (validés
  // qualité + score ≥ 70 + body ≥ 800 mots + faq ≥ 4 + directAnswer 40-80 mots)
  // entrent dans le sitemap. Tier-2 (bulk en attente review) et tier-3 (drafts)
  // restent crawlable mais hors sitemap → crawl budget Google concentré.
  //
  // Audit indexation 2026-05-15 P1-11 — DB-aware : on lit aussi les Article
  // tier-1 indexable publiés via la factory content-gen (table Article) +
  // dédup sur les slugs FS (FS hardcodé prioritaire car contenu éditorial
  // original, DB factory secondaire). Avant ce patch, les articles factory
  // n'apparaissaient PAS dans sitemap-blog si KB_BACKEND_UNIFIED_ARTICLE=false
  // → invisibles pour Googlebot/Bingbot via discovery.
  const fsIndexable = getIndexableBlogPosts();
  const fsSlugs = new Set(fsIndexable.map((p) => p.slug));
  const datesBySlug = new Map<string, string>(fsIndexable.map((p) => [p.slug, p.publishedAt]));

  let dbArticles: Array<{ slug: string; updatedAt: Date | null; publishedAt: Date | null }> = [];
  try {
    const rows = await prisma.article.findMany({
      where: {
        status: "published",
        indexationTier: "tier_1_indexable",
        isNews: false,
      },
      select: {
        publishedAt: true,
        updatedAt: true,
        translations: { where: { locale: "fr" }, take: 1, select: { slug: true } },
      },
      take: 5000,
    });
    dbArticles = rows
      .map((r) => {
        const t = r.translations[0];
        if (!t) return null;
        return { slug: t.slug, updatedAt: r.updatedAt, publishedAt: r.publishedAt };
      })
      .filter((r): r is { slug: string; updatedAt: Date; publishedAt: Date | null } => r !== null);
  } catch {
    // best-effort — DB peut être down au build SSG
    dbArticles = [];
  }

  // Inject DB slugs not already in FS
  for (const a of dbArticles) {
    if (fsSlugs.has(a.slug)) continue;
    const isoDate = (a.updatedAt ?? a.publishedAt ?? now).toISOString().slice(0, 10);
    datesBySlug.set(a.slug, isoDate);
  }

  const indexableSlugs = Array.from(datesBySlug.keys());
  return buildDynamic(
    [
      {
        fr: "/blog/:slug",
        slugs: indexableSlugs,
        changeFrequency: "monthly",
        priority: 0.5,
        lastModFor: (slug) => datesBySlug.get(slug) ?? now,
      },
      {
        fr: "/blog/categorie/:slug",
        en: "/blog/category/:slug",
        slugs: getAllBlogCategorySlugs(),
        changeFrequency: "monthly",
        priority: 0.5,
      },
      {
        fr: "/blog/tag/:slug",
        slugs: getAllBlogTagSlugs(),
        changeFrequency: "monthly",
        priority: 0.4,
      },
      {
        fr: "/blog/auteur/:slug",
        en: "/blog/author/:slug",
        slugs: getAllBlogAuthorSlugs(),
        changeFrequency: "monthly",
        priority: 0.4,
      },
      // Sprint 14.10 — pages taxonomies métier (secteur · taille · service).
      {
        fr: "/blog/secteur/:slug",
        en: "/blog/sector/:slug",
        slugs: [...getAllBlogSectorSlugs()],
        changeFrequency: "monthly",
        priority: 0.5,
      },
      {
        fr: "/blog/taille/:slug",
        en: "/blog/size/:slug",
        slugs: [...getAllBlogCompanySizeSlugs()],
        changeFrequency: "monthly",
        priority: 0.5,
      },
      {
        fr: "/blog/service/:slug",
        slugs: [...getAllBlogServiceTypeSlugs()],
        changeFrequency: "monthly",
        priority: 0.5,
      },
    ],
    now,
  );
}

function buildHelpSitemap(now: Date): MetadataRoute.Sitemap {
  // Audit final P1-12 fix : `/faq/:slug` déplacé dans `buildFaqSitemap`
  // (sub-sitemap dédié `sitemap-faq.xml`). Help reste centre-aide + categories.
  return buildDynamic(
    [
      {
        fr: "/centre-aide/:slug",
        en: "/help/:slug",
        slugs: getAllHelpSlugs(),
        changeFrequency: "monthly",
        priority: 0.6,
      },
      {
        fr: "/centre-aide/categorie/:slug",
        en: "/help/category/:slug",
        slugs: getAllHelpCategorySlugs(),
        changeFrequency: "monthly",
        priority: 0.5,
      },
    ],
    now,
  );
}

/**
 * Audit final P1-12 fix — sub-sitemap dédié FAQ (QAPage Speakable).
 *
 * Auparavant bundled dans `help.xml`. La séparation permet à Google /
 * Bing AI / Perplexity d'isoler les Q/R structurées (QAPage Speakable)
 * du centre-aide rédactionnel. Volume V1 modéré, scale 100+ Q/R post
 * Q/R post-process auto § 29 (commit S6.1 `a2f9638`).
 *
 * V1 = FAQ legacy `getAllFaqIds()` depuis `@/content/transversal.ts`.
 * V1.5+ = Q/R DB-generated tier_1_indexable seulement (filtre Prisma).
 */
function buildFaqSitemap(now: Date): MetadataRoute.Sitemap {
  return buildDynamic(
    [
      {
        fr: "/faq/:slug",
        slugs: getAllFaqIds(),
        changeFrequency: "monthly",
        priority: 0.7,
      },
    ],
    now,
  );
}

// NB : `buildNewsSitemap` retiré 2026-05-15 (audit Sitemap+IndexNow §4.1.3 P0-3).
// Le sitemap-news vit désormais à `src/app/sitemap-news.xml/route.ts` (Route
// Handler XML brut conforme Google News : namespace `xmlns:news`, fenêtre 48h
// stricte, max 1000 URLs). La convention `MetadataRoute.Sitemap` de Next 16 ne
// supporte pas le namespace requis par Google News.

function buildCasConcretsSitemap(now: Date): MetadataRoute.Sitemap {
  return buildDynamic(
    [
      {
        fr: "/cas-concrets/:slug",
        slugs: getAllCaseStudySlugs(),
        changeFrequency: "monthly",
        priority: 0.6,
      },
      {
        fr: "/cas-concrets/secteur/:slug",
        en: "/case-studies/industry/:slug",
        slugs: getAllIndustrySlugs(),
        changeFrequency: "monthly",
        priority: 0.5,
      },
    ],
    now,
  );
}

function buildComparaisonsSitemap(now: Date): MetadataRoute.Sitemap {
  return buildDynamic(
    [
      {
        fr: "/comparaisons/:slug",
        slugs: getAllComparisonSlugs(),
        changeFrequency: "monthly",
        priority: 0.5,
      },
    ],
    now,
  );
}

/**
 * Sub-sitemap `guides` — Sprint S+3 P0-7 (audit 18-TYPE-7-COMPARAISONS-GUIDES §8).
 *
 * Contient UNIQUEMENT le hub `/guides` (1 URL × N locales). Les guides
 * individuels (`/guides/[slug]`) sont déjà émis via le sub-sitemap `blog`
 * (continuité éditoriale Articles : un guide pilier est un Article avec
 * `templateVariant="guide-pilier"`, indexé tier-1 via `buildBlogSitemap`).
 *
 * `lastModified` = max(`publishedAt`) des guides DB ou `BUILD_TIME` fallback —
 * permet à Google de comprendre que le hub change quand un nouveau guide est
 * publié (signal de fraîcheur). Best-effort : si DB down ou stub.invalid au
 * build, fallback `now` propre.
 */
function buildGuidesHubSitemap(now: Date): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const hubKey = "/guides" as const;
  for (const locale of effectiveLocales) {
    const url = `${SITE_URL}/${locale}/guides`;
    entries.push({
      url,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: { languages: alternateLanguages(hubKey) },
    });
  }
  return entries;
}

/**
 * Sub-sitemap `glossaire` — Sprint S+4-A 2026-05-18 (audit 22-TYPE-11 P1-19).
 *
 * Contient :
 *   - le hub `/glossaire` (1 URL × locales effectives) — déjà émis aussi via
 *     `pages.xml` (mapping `routing.pathnames`) mais on le re-déclare ici pour
 *     que Search Console groupe le hub avec ses termes (UX diagnostique).
 *   - 60 termes `/glossaire/[slug]` × locales effectives = ~60 URLs en mode
 *     FR-only (cohérence EN désactivé prod 2026-05-16) ou ~120 URLs si EN réactivé.
 *
 * `lastModified = BUILD_TIME` — un terme glossaire évolue rarement, et même
 * une mise à jour de définition est captée par le BUILD_TIME (chaque deploy
 * regénère le sitemap). Pas de DB-aware ici car la SSOT vit en TS hardcode
 * (`src/content/glossary-extension.ts`).
 *
 * Priority 0.6 (sous les pages stratégiques 0.8, au-dessus des taxonomies 0.4-0.5).
 * ChangeFrequency `monthly` — alignement réaliste avec la cadence d'enrichissement
 * du glossaire (Will valide périodiquement les ajouts).
 */
function buildGlossarySitemap(now: Date): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  // 1) Le hub /glossaire (FR canonique + EN miroir si activé).
  const hubKey = "/glossaire" as PathnameKey;
  for (const locale of effectiveLocales) {
    const url = `${SITE_URL}/${locale}${localizedHref(hubKey, locale)}`;
    entries.push({
      url,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: alternateLanguages(hubKey) },
    });
  }

  // 2) Chaque terme /glossaire/[slug] (FR canonique + EN miroir si activé).
  // Slugs identiques en FR et EN (les termes IA sont des sigles anglo-saxons
  // ou des concepts internationaux — pas de translation des slugs).
  const slugs = listGlossaryTermSlugs();
  for (const slug of slugs) {
    const frUrl = `${SITE_URL}/fr/glossaire/${slug}`;
    const enUrl = `${SITE_URL}/en/glossary/${slug}`;
    const langs = { fr: frUrl, en: enUrl, "x-default": frUrl };
    entries.push({
      url: frUrl,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: langs },
    });
    if (!EN_LOCALE_DISABLED) {
      entries.push({
        url: enUrl,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: { languages: langs },
      });
    }
  }

  return entries;
}

/**
 * Sub-sitemap `presse` — Sprint S+4-D 2026-05-18 (audit 19-TYPE-8-PRESSE P1-18).
 *
 * Contient les pages détail communiqués `/presse/[slug]` × locales effectives.
 * Le hub `/presse` est déjà émis via `pages.xml` (mapping statique `routing.pathnames`).
 *
 * Source de vérité = `PRESS_RELEASES` (fixtures éditoriales TS). `lastModified`
 * = `publishedAt` réel (ISO `YYYY-MM-DD`) → signal de fraîcheur honnête pour
 * Google Discover + Top Stories + AI Overviews citations. Pas de DB-aware
 * V1 (les communiqués sont curated humain, faible volume ~3-30 en V1+V2).
 *
 * Priority 0.7 — entre les pages stratégiques (0.8) et le contenu éditorial
 * récurrent (0.5). Un communiqué annonce un événement précis (lancement,
 * jalon) qui mérite découverte prioritaire les premières semaines.
 * ChangeFrequency `monthly` (un communiqué change rarement après publication,
 * fixes mineurs ratrappés par BUILD_TIME dans `pages.xml`).
 *
 * Slugs FR/EN identiques (les slugs de communiqués sont des identifiants
 * canoniques typés `lancement-plateforme-axion-ia-2026` non traduits — la
 * traduction est dans le titre + body, pas l'URL).
 */
function buildPresseSitemap(_now: Date): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const release of PRESS_RELEASES) {
    const slug = release.slug;
    // ISO date string accepté tel quel par MetadataRoute.Sitemap (Next 16
    // sérialise en lastmod ISO 8601). `publishedAt` est `YYYY-MM-DD`.
    const lastMod = release.publishedAt;
    const frUrl = `${SITE_URL}/fr/presse/${slug}`;
    const enUrl = `${SITE_URL}/en/press/${slug}`;
    const langs = { fr: frUrl, en: enUrl, "x-default": frUrl };
    entries.push({
      url: frUrl,
      lastModified: lastMod,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: langs },
    });
    if (!EN_LOCALE_DISABLED) {
      entries.push({
        url: enUrl,
        lastModified: lastMod,
        changeFrequency: "monthly",
        priority: 0.7,
        alternates: { languages: langs },
      });
    }
  }
  return entries;
}

function buildImplementationSitemap(now: Date): MetadataRoute.Sitemap {
  return buildDynamic(
    [
      {
        fr: "/implementation/par-fonction/:slug",
        en: "/implementation/by-function/:slug",
        slugs: AUTOMATISATION_SLUGS_FR,
        slugsEn: AUTOMATISATION_SLUGS_EN,
        changeFrequency: "monthly",
        priority: 0.6,
      },
    ],
    now,
  );
}

/**
 * Sub-sitemap `stack-ia-tools` — Sprint S+4-B City Domination 2026-05-18
 * (audit P1-17 `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/20-TYPE-9-STACK-IA.md`).
 *
 * Émet les 11 pages détail outils `/stack-ia/[tool]` (FR) +
 * `/ai-stack/[tool]` (EN miroir). Volume V1 ~22 URLs (11 × 2 locales) ;
 * `effectiveLocales` filtre auto EN si désactivé (`EN_LOCALE_ENABLED!=true`).
 *
 * `lastModified` = `BUILD_TIME` (les fiches outils bougent peu — révisées
 * 1-2 fois/trimestre lors des revues stack). `priority` = 0.6 (depth ≥ 3,
 * mais valeur éditoriale supérieure aux pages techniques `/components` etc).
 */
function buildStackIaToolsSitemap(now: Date): MetadataRoute.Sitemap {
  return buildDynamic(
    [
      {
        fr: "/stack-ia/:slug",
        en: "/ai-stack/:slug",
        slugs: getAllStackToolSlugs(),
        changeFrequency: "monthly",
        priority: 0.6,
      },
    ],
    now,
  );
}

// pSEO Implantations — hub + régions indexable seulement.
// Anti-doorway HCU 2024 : seules les régions `noindex: false` entrent ici.
// Les villes sont émises dans des sub-sitemaps dédiés `villes-<region>(-<n>)`
// pour rester sous SITEMAP_CHUNK_SIZE par fichier (best practice 2026).
function buildImplantationsHubSitemap(now: Date): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  // Hub /implantations · /locations
  const hubFr = `${SITE_URL}/fr/implantations`;
  const hubEn = `${SITE_URL}/en/locations`;
  for (const url of [hubFr, hubEn]) {
    entries.push({
      url,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: { languages: { fr: hubFr, en: hubEn, "x-default": hubFr } },
    });
  }

  // Régions indexable (12 métropole en V1, Corse reste noindex)
  for (const region of getIndexableRegions()) {
    const frUrl = `${SITE_URL}/fr/implantations/${region.slug}`;
    const enUrl = `${SITE_URL}/en/locations/${region.slug}`;
    const langs = { fr: frUrl, en: enUrl, "x-default": frUrl };
    entries.push({
      url: frUrl,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: langs },
    });
    entries.push({
      url: enUrl,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: langs },
    });
  }

  return entries;
}

// pSEO Villes — sub-sitemap par région (chunké à SITEMAP_CHUNK_SIZE URLs).
// Anti-doorway HCU 2024 : `getIndexableVilles()` filtre déjà sur `copy` présent
// (V1 = Paris uniquement) → garantie zéro page thin dans le sitemap. Les ~2 280
// stubs structurels SSG existent physiquement mais portent `<meta robots="noindex">`
// côté page et n'apparaissent jamais ici.
//
// Ordre tri par slug ascendant pour que le découpage en chunks soit déterministe
// — un nouveau ville indexable change le contenu d'1 chunk, pas l'ordre des autres.
function buildVillesByRegionSitemap(
  regionSlug: string,
  chunkIdx: number,
  now: Date,
): MetadataRoute.Sitemap {
  const villesInRegion = [...getIndexableVilles()]
    .filter((v) => v.region === regionSlug)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  // Build all URL pairs (FR + EN) for the region, paire par paire pour qu'un
  // chunk contienne toujours une ville complète (pas FR sur chunk N + EN sur N+1).
  const allUrls: MetadataRoute.Sitemap = [];
  for (const ville of villesInRegion) {
    const frUrl = `${SITE_URL}/fr/implantations/${ville.region}/${ville.slug}`;
    const enUrl = `${SITE_URL}/en/locations/${ville.region}/${ville.slug}`;
    const langs = { fr: frUrl, en: enUrl, "x-default": frUrl };
    allUrls.push({
      url: frUrl,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: langs },
    });
    allUrls.push({
      url: enUrl,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: langs },
    });
  }

  // Slice par chunkIdx (1-indexed). Hors limites = array vide (sitemap ignoré).
  const start = (chunkIdx - 1) * SITEMAP_CHUNK_SIZE;
  return allUrls.slice(start, start + SITEMAP_CHUNK_SIZE);
}

// pSEO services × villes — 3 services × villes pilotes (avec copy.services).
// Sprint 14.10.1 Commit B : émet `/audit/par-ville/<ville>`,
// `/interventions/par-ville/<ville>`, `/implementation/par-ville/<ville>`
// uniquement pour les villes dont `copy.services.<service>` est présent
// (auto-promotion tier-1 dès qu'il y a un copy substantiel — décision Will
// 2026-05-08 « toutes les villes indexables »).
//
// V1 = Paris seul a copy.services → 6 URLs (3 services × 2 locales). Quand
// l'outil de génération produit les copies pour toutes les villes pilotes,
// volume cible : ~50 villes × 3 services × 2 locales = 300 URLs Phase 1,
// puis ~2150 × 3 × 2 = 12 900 URLs Phase 3 (chunking auto à activer).
// C6 cert 2026-05-08 : split en 3 sub-sitemaps par service pour anticiper
// le scale 2150 villes × 3 services × 2 locales = 12 900 URLs (chaque service
// = 4 300 URLs max, sous le cap 50 000 imposé par sitemaps.org). Search Console
// préfère des sub-sitemaps homogènes par template plutôt qu'un mega-sitemap mixte.
const SERVICE_VILLES_PATHS: Record<ServiceVillesKey, { pathFr: string; pathEn: string }> = {
  audit: { pathFr: "/audit/par-ville", pathEn: "/audit/by-city" },
  interventions: { pathFr: "/interventions/par-ville", pathEn: "/interventions/by-city" },
  implementation: { pathFr: "/implementation/par-ville", pathEn: "/implementation/by-city" },
  // Sprint S+2 City Domination — 4e verticale `un-a-un`.
  "un-a-un": { pathFr: "/un-a-un/par-ville", pathEn: "/one-to-one/by-city" },
};

function buildServicesVillesSitemap(now: Date, service: ServiceVillesKey): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const { pathFr, pathEn } = SERVICE_VILLES_PATHS[service];

  for (const ville of getIndexableVilles()) {
    // Mapping ServiceKey → copy property (cf VilleServicePageTemplate).
    // `un-a-un` est stocké sous `services.unAUn` (camelCase TS).
    const hasCopy =
      service === "un-a-un" ? !!ville.copy?.services?.unAUn : !!ville.copy?.services?.[service];
    if (!hasCopy) continue;
    const frUrl = `${SITE_URL}/fr${pathFr}/${ville.slug}`;
    const enUrl = `${SITE_URL}/en${pathEn}/${ville.slug}`;
    const langs = { fr: frUrl, en: enUrl, "x-default": frUrl };
    entries.push({
      url: frUrl,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: langs },
    });
    entries.push({
      url: enUrl,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: langs },
    });
  }
  return entries;
}
