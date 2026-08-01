// Sitemap-index racine — listing de tous les sub-sitemaps émis via
// `generateSitemaps()` dans `app/sitemap.ts`.
//
// Pourquoi ce fichier existe et pas `app/sitemap.xml/route.ts` :
//   Next 16 réserve le path `/sitemap.xml` à la convention metadata
//   `app/sitemap.ts` (`generateSitemaps()` génère `/sitemap/<id>.xml`).
//   Tenter un Route Handler à `app/sitemap.xml/route.ts` produit un
//   build error « Conflicting route and metadata at /sitemap.xml ».
//   Solution : exposer l'index racine à `/sitemap-index.xml` et
//   référencer ce path dans `robots.ts` (Sitemap directive).
//
//   Sans cet index, Googlebot ne découvre que le sub-sitemap pointé
//   par robots.txt — il ne saurait pas que les autres sub-sitemaps
//   `/sitemap/<id>.xml` existent. Avec cet index, un seul fetch
//   `Sitemap: /sitemap-index.xml` suffit pour découvrir les ~17 500
//   routes SSG (cities, services × cities, blog, case studies, etc.).
//
// Cet endpoint réutilise la même fonction `generateSitemaps()` que
// `app/sitemap.ts`, garantissant que l'index reste synchronisé avec
// les sub-sitemaps réellement émis.
//
// Sub-sitemaps custom (hors `generateSitemaps()`) — référencés manuellement :
//   - `/sitemap-news.xml` : Route Handler XML brut conforme Google News
//     (namespace `xmlns:news`, fenêtre 48h stricte, max 1000 URLs).
//     Ne peut PAS passer par `MetadataRoute.Sitemap` (pas de support
//     `xmlns:news`). Cf. `app/sitemap-news.xml/route.ts` + audit
//     Sitemap+IndexNow 2026-05-15 AGENT 4 §4.1.3 P0-3.

import sitemap, {
  generateSitemaps,
  buildExcludeSlugsByType,
  editorialLastmodForSitemapId,
} from "../sitemap";
import { SITE_URL } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { listKnowledgeSitemapEntries } from "@/server/exporters/knowledge-sitemap";
// Gating anti-vide des sitemaps news (fenêtres glissantes 48h / 90j → vides en
// creux d'actu). On réutilise les MÊMES builders que les routes → cohérence
// index↔route garantie (cf. filtre customSitemaps dans GET).
import { listRecentNewsEntries } from "@/app/sitemap-news.xml/route";
import { listEvergreenNewsEntries } from "@/app/sitemap-news-evergreen.xml/route";

// Sub-sitemaps custom (Route Handlers XML brut, hors `generateSitemaps()`).
// Référencés manuellement pour que Googlebot les découvre via l'index racine.
//
// - `/sitemap-news.xml`        : Google News (namespace `xmlns:news`, fenêtre 48h)
//
// Image Sitemap 1.1 (FR/EN) retiré audit indexation FR 2026-05-15 P0-3 :
// référencés mais Route Handlers inexistants → 404 systématique côté Googlebot.
// Réintroduire QUAND la banque d'images V2 (PROMPT-IMAGE-BANK-MASTER-2026)
// livrera les builders correspondants.
const CUSTOM_SITEMAPS: ReadonlyArray<string> = [
  "/sitemap-news.xml",
  // Blog DB-aware (articles tier-1 + catégories content-gen). Déplacé de la
  // convention metadata `generateSitemaps()` vers un Route Handler runtime le
  // 2026-07-06 (cf. `app/sitemap-blog.xml/route.ts`) : depuis le vidage de
  // BLOG_POSTS (2026-07-03), le blog est 100 % DB → le prérendu au build stub
  // sortait un `<urlset>` VIDE, baké dans l'image et resservi jusqu'à la 1re
  // revalidation ISR (« Balise XML manquante : url » côté GSC).
  // ⚠️ Listé CONDITIONNELLEMENT (cf. GET) : uniquement si le builder blog émet
  // au moins une URL — sinon Google lirait un `<urlset>` vide et le flaggerait.
  // Réapparaît automatiquement dès qu'un article tier-1 est publié.
  "/sitemap-blog.xml",
  // News evergreen (audit maillage/indexation 2026-07-03) — les Articles
  // `isNews=true` ne vivaient QUE dans `/sitemap-news.xml` (fenêtre stricte 48h
  // Google News) ; passé 48h ils disparaissaient de TOUS les sitemaps (le sub-
  // sitemap `blog` exclut `isNews:true`). Ce sub-sitemap prolonge la découverte
  // long-tail à ~90 jours en `<urlset>` STANDARD (pas de namespace `xmlns:news` :
  // finalité découverte organique, pas Google News). Cf. `app/sitemap-news-evergreen.xml`.
  "/sitemap-news-evergreen.xml",
  // KB DB-aware (entrées KB publiques, audience=public). Déplacé de la convention
  // metadata `generateSitemaps()` (où le compte au build stub.invalid = 0 → 404
  // fantômes) vers un Route Handler runtime. Cf. `app/sitemap-knowledge.xml/route.ts`.
  // ⚠️ Listé CONDITIONNELLEMENT (cf. GET) : uniquement si `listKnowledgeSitemapEntries()`
  // émet au moins une URL (après dédup vs builders TS). Tant qu'il n'y a aucune
  // ressource KB publique émise (`/ressources` vide OU toutes dédupliquées), on ne
  // le référence PAS — sinon Google lirait un `<urlset>` vide et le flaggerait
  // « Balise XML manquante : url ». Il réapparaît automatiquement dès publication.
  "/sitemap-knowledge.xml",
  // Image Sitemap 1.1 — image-bank V1 (réintroduit Sprint 4 V1 2026-05-16,
  // builders `app/sitemaps/images-{fr,en}.xml/route.ts` livrés).
  "/sitemaps/images-fr.xml",
  // ⚠️ Listé CONDITIONNELLEMENT (cf. GET) : uniquement si EN_LOCALE_ENABLED=true.
  // Depuis la désactivation d'EN (2026-05-16), la route `images-en.xml` retourne
  // volontairement un `<urlset>` VIDE (elle ne doit pas déclarer d'URLs /en/gallery/
  // qui 301→FR). Or l'index le listait inconditionnellement → Google lisait un
  // urlset vide et le flaggait « Balise XML manquante : url » (2026-07-06). On ne
  // le référence donc que quand EN est réactivé. Symétrique du gating KB/blog.
  "/sitemaps/images-en.xml",
  // Image Sitemap — services (73 images marketing) + villes France (2 157 communes).
  // image-bank-complet audit 2026-05-20.
  "/sitemap-images-services.xml",
  // Image Sitemap — visuels d'articles de blog (Article.featuredImage), tier-1.
  // Audit maillage/indexation 2026-07-03 : seul manque images restant (les héros
  // d'articles n'étaient annoncés dans aucun sitemap). Cf. `app/sitemap-images-blog.xml`.
  "/sitemap-images-blog.xml",
  "/sitemap-images-villes-t1.xml",
  "/sitemap-images-villes-t2.xml",
  "/sitemap-images-villes-t3-t4.xml",
  // Module recrutement commercial (devenir-commercial-ia) — hubs T1+T2 indexables
  // + France + candidature. Route Handler isolé (ne touche pas sitemap.ts).
  "/sitemap-recrutement.xml",
  // Offres d'emploi (/carrieres) — DB-driven (offres publiées indexables).
  "/sitemap-carrieres.xml",
  // Presse DB-driven — migré de la convention metadata vers un Route Handler
  // runtime le 2026-07-31 (audit indexation GSC) : la route metadata était bakée
  // VIDE au build stub pendant que le gate runtime la listait (incohérence
  // index↔route observée en live). Même pattern que blog/knowledge. ⚠️ Listé
  // CONDITIONNELLEMENT (cf. GET) : uniquement si ≥ 1 communiqué publié émis.
  "/sitemap-presse.xml",
  // Avis clients (/avis) — DB-driven runtime : hub + chaque avis publié (avec
  // photo pour Google Images) + facettes curées. Toujours ≥ 2 URLs (hub +
  // deposer) → jamais un urlset vide. Cf. `app/sitemap-avis.xml/route.ts`.
  "/sitemap-avis.xml",
];

// Rendu DYNAMIQUE au runtime (2026-07-06). Auparavant `force-static` : l'index
// était pré-rendu au build stub.invalid (ADR 0026) où TOUS les gates DB-aware
// (KB, blog, news, news-evergreen) voient un compte = 0 → ces sub-sitemaps étaient
// EXCLUS de l'index fraîchement déployé, et ne réapparaissaient qu'après la 1re
// revalidation ISR (jusqu'à 1h), à CHAQUE deploy. En `force-dynamic`, le gating
// s'évalue avec la vraie DB à chaque requête → blog/news/KB listés immédiatement.
// La charge origin est absorbée par le cache CDN (`s-maxage=600`, cf. Response).
export const dynamic = "force-dynamic";
export const revalidate = 600;

// EN désactivé (AGENTS.md §EN locale désactivé 2026-05-16) → le sub-sitemap
// `images-en.xml` est volontairement vide ; on ne le référence pas dans l'index
// tant qu'EN n'est pas réactivé (cf. filtre customSitemaps dans GET).
const EN_LOCALE_ENABLED = process.env["EN_LOCALE_ENABLED"] === "true";

/**
 * Audit indexation 2026-05-15 P1-14 — lastmod différencié par catégorie.
 *
 * Avant ce patch : un seul `new Date().toISOString()` partagé par TOUS les
 * sub-sitemaps → Google ignore le signal `lastmod` (tous identiques = suspect).
 *
 * Maintenant : on lit la `MAX(updatedAt)` réelle par source DB. Fail-soft :
 * si la query échoue (P2021 / DB down), on retombe sur un fallback déterministe.
 *
 * Audit indexation 2026-05-18 P0-2 — le fallback était `new Date()` (worker boot
 * time, uniforme sur 13/15 sub-sitemaps → Google désactive le signal lastmod).
 * Corrigé alors en `BUILD_TIME`.
 *
 * Audit fraîcheur 2026-06-08 — `BUILD_TIME` restait du date-gaming : les sub-
 * sitemaps statiques/pSEO (pages, faq, help, villes, services-villes) se
 * déclaraient « modifiés » à CHAQUE deploy sans changement de contenu. Sur un
 * site jeune à faible crawl-budget, Google re-crawle alors de l'inchangé.
 * Fix : fallback figé sur une date éditoriale STABLE (= `EDITORIAL_BASELINE` de
 * `sitemap.ts`, gardée en sync manuellement). Les sources DB (news/knowledge/blog)
 * conservent leur `MAX(updatedAt)` réel (signal honnête, gold-standard intact).
 * Cf. `_AUDIT/PLAN-FRESHNESS-EXHAUSTIF-2026-06-08.md`.
 */
// Duplication SUPPRIMÉE (audit indexation 2026-07-31) — ce fichier codait en dur
// `EDITORIAL_BASELINE_ISO = "2026-06-08..."` avec un commentaire « garder en sync
// manuellement » avec `sitemap.ts`. On importe désormais `editorialLastmodForSitemapId`
// depuis `sitemap.ts` : une seule source, et elle porte la fraîcheur RÉELLE par
// famille (dernier commit git des sources, cf. `scripts/gen-content-freshness.mjs`).
function getFallbackLastmod(): string {
  return editorialLastmodForSitemapId("pages").toISOString();
}

async function getDifferentiatedLastmod(): Promise<{
  news: string;
  knowledge: string;
  blog: string;
  fallback: string;
}> {
  const fallback = getFallbackLastmod();
  const result = {
    news: fallback,
    knowledge: fallback,
    blog: fallback,
    fallback,
  };
  try {
    const newsMax = await prisma.article.findFirst({
      where: { isNews: true, status: "published" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });
    if (newsMax?.updatedAt) result.news = newsMax.updatedAt.toISOString();
  } catch {
    // best-effort
  }
  try {
    const blogMax = await prisma.article.findFirst({
      where: { isNews: false, status: "published" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });
    if (blogMax?.updatedAt) result.blog = blogMax.updatedAt.toISOString();
  } catch {
    // best-effort
  }
  try {
    const kbMax = await prisma.knowledgeEntry.findFirst({
      where: { status: { in: ["published", "deprecated"] }, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });
    if (kbMax?.updatedAt) result.knowledge = kbMax.updatedAt.toISOString();
  } catch {
    // best-effort
  }
  return result;
}

function lastmodForGeneratedId(
  id: string,
  lastmods: Awaited<ReturnType<typeof getDifferentiatedLastmod>>,
): string {
  if (id === "blog") return lastmods.blog;
  if (id.startsWith("knowledge-")) return lastmods.knowledge;
  // pages / faq / help / cas-concrets / villes-* / services-villes-* → fraîcheur
  // RÉELLE de la famille (dernier commit git de ses sources), résolue par
  // `editorialLastmodForSitemapId` dans `sitemap.ts` — source unique partagée avec
  // les sub-sitemaps eux-mêmes, donc index et routes ne peuvent plus diverger.
  // Une famille inchangée garde sa date ancienne (pas de date-gaming) ; une famille
  // modifiée voit sa date avancer (le signal manquait depuis le 2026-06-08).
  return editorialLastmodForSitemapId(id).toISOString();
}

export async function GET(): Promise<Response> {
  const sitemaps = await generateSitemaps();
  const lastmods = await getDifferentiatedLastmod();

  // Le sitemap KB n'est référencé que s'il émet RÉELLEMENT au moins une URL.
  //
  // Audit indexation 2026-06-20 — on gate désormais sur le nombre d'entrées
  // EFFECTIVEMENT émises par `listKnowledgeSitemapEntries()` (= APRÈS dédup vs
  // builders TS + filtre FR-translation + URL publique valide), et NON plus sur
  // le compte brut `countKnowledgePublicEntries()`. Constat live : des entrées
  // KB publiques toutes dédupliquées (slugs déjà émis par blog/cas-concrets/faq)
  // donnaient `count > 0` mais `list = 0` → l'index listait un `<urlset>` VIDE
  // que Google flagge « Balise XML manquante : url » — exactement ce que ce gate
  // devait empêcher. On réutilise ici le MÊME calcul que la route
  // `sitemap-knowledge.xml` → cohérence index↔route garantie. Stub-safe
  // (`listKnowledgeSitemapEntries()` => [] au build stub → non listé ; recompté
  // au runtime via ISR/revalidate).
  // Durcissement 2026-07-03 — le sitemap-index NE DOIT JAMAIS 500 (c'est l'entrée
  // que Google lit à chaque crawl). Le fail-soft de `knowledge-sitemap.ts` couvre
  // P2021/P1001/P1012/ECONNREFUSED, mais PAS un `PrismaClientInitializationError`
  // (« Can't reach database server ») qui remonterait ici et 500-erait l'index
  // entier lors d'un hoquet DB (restart/migration deploy). On isole donc le gating :
  // si le compte échoue, on omet le sitemap-knowledge conditionnel et on sert
  // l'index quand même (il réapparaît au prochain render réussi via ISR).
  let kbEmittableCount = 0;
  try {
    kbEmittableCount = (await listKnowledgeSitemapEntries(buildExcludeSlugsByType())).length;
  } catch {
    kbEmittableCount = 0;
  }

  // Blog DB-aware — même gating anti-vide que le KB. On réutilise le MÊME builder
  // que la route `sitemap-blog.xml` (`sitemap({id:"blog"})`) → cohérence index↔route
  // garantie. Stub-safe (au build → `[]` → non listé ; recompté au runtime via ISR).
  // Fail-soft : un hoquet DB ne doit JAMAIS 500 l'index (entrée lue à chaque crawl).
  let blogEmittableCount = 0;
  try {
    blogEmittableCount = (await sitemap({ id: Promise.resolve("blog") })).length;
  } catch {
    blogEmittableCount = 0;
  }

  // Presse DB-aware (fix 2026-07-06) — les communiqués sont admin-only/DB (le
  // fallback fixtures a été retiré du rendu, cf. `server/press/queries.ts`). Le
  // builder `presse` lit désormais la DB → vide tant qu'aucun communiqué n'est
  // publié en console (état actuel prod). Même gating anti-vide que blog/KB : on
  // ne liste `/sitemap/presse.xml` que s'il émet ≥ 1 URL, sinon Google lirait un
  // `<urlset>` vide (« Balise XML manquante : url »). Réapparaît automatiquement
  // dès qu'un communiqué est publié. Fail-soft (jamais 500 l'index).
  let presseEmittableCount = 0;
  try {
    presseEmittableCount = (await sitemap({ id: Promise.resolve("presse") })).length;
  } catch {
    presseEmittableCount = 0;
  }

  // News (Google News, fenêtre 48h) + news-evergreen (90j) — vides en creux d'actu.
  // Même gating anti-vide que KB/blog : on ne les liste que s'ils émettent ≥ 1 URL,
  // sinon Google lit un `<urlset>` vide et le flagge « Balise XML manquante : url »
  // (cas observé le 30/06 sur sitemap-news pendant un creux). Fail-soft.
  let newsEmittableCount = 0;
  try {
    newsEmittableCount = (await listRecentNewsEntries()).length;
  } catch {
    newsEmittableCount = 0;
  }
  let evergreenEmittableCount = 0;
  try {
    evergreenEmittableCount = (await listEvergreenNewsEntries()).length;
  } catch {
    evergreenEmittableCount = 0;
  }

  const customSitemaps = CUSTOM_SITEMAPS.filter((path) => {
    if (path === "/sitemap-knowledge.xml") return kbEmittableCount > 0;
    if (path === "/sitemap-blog.xml") return blogEmittableCount > 0;
    if (path === "/sitemap-presse.xml") return presseEmittableCount > 0;
    if (path === "/sitemap-news.xml") return newsEmittableCount > 0;
    if (path === "/sitemap-news-evergreen.xml") return evergreenEmittableCount > 0;
    // `images-en.xml` est vide tant qu'EN est désactivé (301→FR) → ne pas le
    // lister (sinon urlset vide flaggé par GSC). Réapparaît si EN réactivé.
    if (path === "/sitemaps/images-en.xml") return EN_LOCALE_ENABLED;
    return true;
  });

  // NB : `presse` n'apparaît plus dans `generateSitemaps()` (2026-07-31) — son
  // gate anti-vide vit désormais dans le filtre `customSitemaps` ci-dessus.
  const generatedBlocks = sitemaps.map(({ id }) => {
    const lm = lastmodForGeneratedId(id, lastmods);
    return `  <sitemap>
    <loc>${SITE_URL}/sitemap/${id}.xml</loc>
    <lastmod>${lm}</lastmod>
  </sitemap>`;
  });

  const customBlocks = customSitemaps.map((path) => {
    // sitemap-news.xml           → max(updatedAt) Article isNews
    // sitemap-news-evergreen.xml → même source (Article isNews) → même signal
    // sitemap-knowledge.xml      → max(updatedAt) KnowledgeEntry (signal fraîcheur réel)
    const lm =
      path === "/sitemap-news.xml" || path === "/sitemap-news-evergreen.xml"
        ? lastmods.news
        : path === "/sitemap-knowledge.xml"
          ? lastmods.knowledge
          : // Blog (articles tier-1) + images blog : suivent les articles →
            // max(updatedAt) blog (signal de fraîcheur réel).
            path === "/sitemap-blog.xml" || path === "/sitemap-images-blog.xml"
            ? lastmods.blog
            : lastmods.fallback;
    return `  <sitemap>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${lm}</lastmod>
  </sitemap>`;
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...generatedBlocks, ...customBlocks].join("\n")}
</sitemapindex>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Audit indexation 2026-05-18 P1-13 — réduction `s-maxage=86400` (24h)
      // → `s-maxage=600` (10 min). Avant : Cloudflare cachait l'index 24h ce qui
      // masquait les nouvelles URLs jusqu'à 24h après publish. Maintenant : CDN
      // refresh sous 10 min après publish d'un Article tier-1 ou promotion ville.
      // Charge origin négligeable car ISR Next 16 (`revalidate=3600`) sert depuis
      // memory cache du worker.
      "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
