// Worker BullMQ — détection anomalies routes publiques (Sprint Site Explorer 2026-05-22).
//
// Cron daily 03:00 UTC (après l'inspection worker 02:00).
// Détecte 9 types d'anomalies sur les routes publiques :
//   - 404 : pages avec httpStatus=404
//   - duplicate_meta_title : 2+ pages avec même metaTitle
//   - duplicate_meta_description : 2+ pages avec même metaDescription
//   - duplicate_h1 : 2+ pages avec même H1
//   - orphan_page : pages sans liens internes entrants
//   - thin_content : wordCount < 300 sur pages publiques
//   - no_jsonld : jsonLdCount=0 sur pages article
//   - no_ai_disclaimer : hasAiDisclaimer=false sur pages AI-générées (articles)
//   - no_external_links : externalLinkCount < 2 sur articles publiés
//
// Stub-aware : skip si DATABASE_URL contient "stub.invalid".

import { Worker } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";
import { OG_LARGEUR_MINIMALE_GRANDE_CARTE } from "@/lib/og-format";
import type { SiteRouteAnomalyDetectorJobData } from "../types";

function isStubBuild(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") ?? false;
}

// ─── Upsert anomalie (idempotent) ─────────────────────────────────────────────

async function upsertAnomaly(params: {
  siteRouteId: string;
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
}) {
  // On nettoie d'abord les anomalies non-résolues du même type pour cette route
  await prisma.siteRouteAnomaly.deleteMany({
    where: {
      siteRouteId: params.siteRouteId,
      type: params.type,
      resolvedAt: null,
    },
  });

  await prisma.siteRouteAnomaly.create({
    data: {
      siteRouteId: params.siteRouteId,
      type: params.type,
      severity: params.severity,
      description: params.description,
    },
  });
}

// ─── Worker BullMQ ────────────────────────────────────────────────────────────

export function startSiteRouteAnomalyDetectorWorker() {
  const worker = new Worker<SiteRouteAnomalyDetectorJobData>(
    "site-route-anomaly-detector",
    async () => {
      if (isStubBuild()) {
        console.log("[site-route-anomaly-detector] stub build detected, skipping.");
        return;
      }

      const stats = {
        not_found: 0,
        duplicate_meta_title: 0,
        duplicate_meta_description: 0,
        duplicate_h1: 0,
        orphan_page: 0,
        thin_content: 0,
        no_jsonld: 0,
        no_ai_disclaimer: 0,
        no_external_links: 0,
        og_image_absente: 0,
        og_image_injoignable: 0,
        og_image_trop_petite: 0,
        og_dimensions_mensongeres: 0,
        og_image_tierce: 0,
      };

      // 1) 404 : pages avec httpStatus=404
      const notFoundRoutes = await prisma.siteRoute.findMany({
        where: { visibility: "public", httpStatus: 404 },
        select: { id: true, pathRendered: true, pathPattern: true },
      });
      for (const route of notFoundRoutes) {
        await upsertAnomaly({
          siteRouteId: route.id,
          type: "404",
          severity: "high",
          description: `Page 404 : ${route.pathRendered ?? route.pathPattern}`,
        });
        stats.not_found++;
      }

      // 2) metaTitle dupliqués (groupby metaTitle, count > 1)
      const dupTitles = await prisma.$queryRaw<Array<{ meta_title: string; count: bigint }>>`
        SELECT meta_title, COUNT(*) as count
        FROM site_routes
        WHERE meta_title IS NOT NULL AND visibility = 'public'
        GROUP BY meta_title
        HAVING COUNT(*) > 1
      `;
      for (const dup of dupTitles) {
        const routes = await prisma.siteRoute.findMany({
          where: { metaTitle: dup.meta_title, visibility: "public" },
          select: { id: true, pathPattern: true },
        });
        for (const route of routes) {
          await upsertAnomaly({
            siteRouteId: route.id,
            type: "duplicate_meta_title",
            severity: "medium",
            description: `metaTitle dupliqué "${dup.meta_title}" sur ${Number(dup.count)} pages`,
          });
          stats.duplicate_meta_title++;
        }
      }

      // 3) metaDescription dupliquées
      const dupDescs = await prisma.$queryRaw<Array<{ meta_description: string; count: bigint }>>`
        SELECT meta_description, COUNT(*) as count
        FROM site_routes
        WHERE meta_description IS NOT NULL AND visibility = 'public'
        GROUP BY meta_description
        HAVING COUNT(*) > 1
      `;
      for (const dup of dupDescs) {
        const routes = await prisma.siteRoute.findMany({
          where: { metaDescription: dup.meta_description, visibility: "public" },
          select: { id: true, pathPattern: true },
        });
        for (const route of routes) {
          await upsertAnomaly({
            siteRouteId: route.id,
            type: "duplicate_meta_description",
            severity: "medium",
            description: `metaDescription dupliquée sur ${Number(dup.count)} pages`,
          });
          stats.duplicate_meta_description++;
        }
      }

      // 4) H1 dupliqués
      const dupH1s = await prisma.$queryRaw<Array<{ h1: string; count: bigint }>>`
        SELECT h1, COUNT(*) as count
        FROM site_routes
        WHERE h1 IS NOT NULL AND visibility = 'public'
        GROUP BY h1
        HAVING COUNT(*) > 1
      `;
      for (const dup of dupH1s) {
        const routes = await prisma.siteRoute.findMany({
          where: { h1: dup.h1, visibility: "public" },
          select: { id: true, pathPattern: true },
        });
        for (const route of routes) {
          await upsertAnomaly({
            siteRouteId: route.id,
            type: "duplicate_h1",
            severity: "medium",
            description: `H1 dupliqué "${dup.h1}" sur ${Number(dup.count)} pages`,
          });
          stats.duplicate_h1++;
        }
      }

      // 5) Pages orphelines (internalLinkCount = 0 AND type != 'dynamic_template')
      const orphanRoutes = await prisma.siteRoute.findMany({
        where: {
          visibility: "public",
          internalLinkCount: 0,
          type: { in: ["static", "dynamic_db", "dynamic_filesystem"] },
          status: "live",
          // Exclure les pages légitimement isolées (mentions légales, etc.)
          section: { notIn: ["mentions-legales", "cgv", "rgpd", "politique-confidentialite"] },
        },
        select: { id: true, pathPattern: true, pathRendered: true },
        take: 100,
      });
      for (const route of orphanRoutes) {
        await upsertAnomaly({
          siteRouteId: route.id,
          type: "orphan_page",
          severity: "medium",
          description: `Page orpheline (0 lien interne sortant) : ${route.pathRendered ?? route.pathPattern}`,
        });
        stats.orphan_page++;
      }

      // 6) Thin content (wordCount < 300)
      //
      // ⚠️ `dynamic_filesystem` etait exclu du filtre `type`, ce qui mettait
      // 2 555 routes publiques live — l'essentiel du site — hors de portee du
      // detecteur. Consequence mesuree le 2026-07-26 : les 60 pages
      // `/fr/glossaire/[slug]`, sous le seuil, n'ont jamais ete flaguees, alors
      // qu'elles etaient l'unique deficit d'indexation du site (constat F49).
      // Le detecteur ne voyait pas ce qu'il etait cense detecter.
      //
      // Le `take` passe de 100 a 500. Il ne tronquait RIEN avec l'ancien filtre
      // (17 `static` + 9 `dynamic_db` = 26 lignes) ; c'est l'elargissement qui le
      // rend insuffisant — 112 routes thin au total, dont 86
      // `dynamic_filesystem`. Compte en prod le 2026-07-26.
      const thinRoutes = await prisma.siteRoute.findMany({
        where: {
          visibility: "public",
          wordCount: { lt: 300, not: null },
          status: "live",
          type: { in: ["static", "dynamic_db", "dynamic_filesystem"] },
        },
        select: { id: true, pathPattern: true, wordCount: true },
        take: 500,
      });
      for (const route of thinRoutes) {
        await upsertAnomaly({
          siteRouteId: route.id,
          type: "thin_content",
          severity: "medium",
          description: `Contenu thin : ${route.wordCount ?? 0} mots (seuil 300) pour ${route.pathPattern}`,
        });
        stats.thin_content++;
      }

      // 7) Pas de JSON-LD sur les articles/guides/cas-concrets
      const noJsonLdRoutes = await prisma.siteRoute.findMany({
        where: {
          visibility: "public",
          jsonLdCount: 0,
          status: "live",
          section: { in: ["blog", "guides", "cas-concrets", "glossaire"] },
        },
        select: { id: true, pathPattern: true },
        take: 100,
      });
      for (const route of noJsonLdRoutes) {
        await upsertAnomaly({
          siteRouteId: route.id,
          type: "no_jsonld",
          severity: "medium",
          description: `Aucun JSON-LD détecté sur ${route.pathPattern}`,
        });
        stats.no_jsonld++;
      }

      // 8) AiDisclaimer absent sur articles DB (sourceDbTable = 'articles')
      const noAiDisclaimerRoutes = await prisma.siteRoute.findMany({
        where: {
          visibility: "public",
          hasAiDisclaimer: false,
          status: "live",
          sourceDbTable: "articles",
        },
        select: { id: true, pathPattern: true, pathRendered: true },
        take: 100,
      });
      for (const route of noAiDisclaimerRoutes) {
        await upsertAnomaly({
          siteRouteId: route.id,
          type: "no_ai_disclaimer",
          severity: "medium",
          description: `AiContentDisclaimer absent sur article IA : ${route.pathRendered ?? route.pathPattern}`,
        });
        stats.no_ai_disclaimer++;
      }

      // 9) Pas de liens externes sur articles publiés
      const noExtLinksRoutes = await prisma.siteRoute.findMany({
        where: {
          visibility: "public",
          externalLinkCount: { lt: 2 },
          status: "live",
          sourceDbTable: "articles",
          wordCount: { gt: 500 }, // uniquement sur articles substantiels
        },
        select: { id: true, pathPattern: true, externalLinkCount: true },
        take: 100,
      });
      for (const route of noExtLinksRoutes) {
        await upsertAnomaly({
          siteRouteId: route.id,
          type: "no_external_links",
          severity: "low",
          description: `Peu de liens externes (${route.externalLinkCount ?? 0} < 2) : ${route.pathPattern}`,
        });
        stats.no_external_links++;
      }

      // ── 10) Aperçu de partage (recensement OG 2026-08-17) ──────────────────
      //
      // Ces cinq règles ne portent QUE sur des routes déjà relevées
      // (`ogInspectedAt` non nul). Une route jamais inspectée n'a rien dit :
      // la traiter comme « sans image » inventerait des anomalies sur les
      // 16 000 routes que l'inspecteur n'a pas encore atteintes.

      // 10a) Aucune og:image du tout → le lien se partage en URL nue.
      const sansImageOg = await prisma.siteRoute.findMany({
        where: {
          visibility: "public",
          status: "live",
          ogInspectedAt: { not: null },
          ogImage: null,
        },
        select: { id: true, pathPattern: true },
        take: 500,
      });
      for (const route of sansImageOg) {
        await upsertAnomaly({
          siteRouteId: route.id,
          type: "og_image_absente",
          severity: "high",
          description: `Aucune image de partage : ${route.pathPattern} s'affiche en lien nu sur WhatsApp et LinkedIn`,
        });
        stats.og_image_absente++;
      }

      // 10b) L'image répond autre chose que 200 → aperçu vide, alors que la
      //      page, elle, déclare fièrement une image.
      const imageInjoignable = await prisma.siteRoute.findMany({
        where: {
          visibility: "public",
          status: "live",
          ogImage: { not: null },
          ogImageStatus: { not: 200 },
          ogInspectedAt: { not: null },
        },
        select: { id: true, pathPattern: true, ogImageStatus: true, ogImage: true },
        take: 500,
      });
      for (const route of imageInjoignable) {
        await upsertAnomaly({
          siteRouteId: route.id,
          type: "og_image_injoignable",
          severity: "high",
          description:
            `L'image de partage de ${route.pathPattern} répond ` +
            `${route.ogImageStatus ?? "rien"} : l'aperçu est vide (${route.ogImage ?? ""})`,
        });
        stats.og_image_injoignable++;
      }

      // 10c) Moins de 1200 px de large → LinkedIn et Facebook remplacent la
      //      grande carte par une vignette. C'était le cas des 134 articles de
      //      blog servis en 1080 de large jusqu'au 2026-08-17.
      const imageTropPetite = await prisma.siteRoute.findMany({
        where: {
          visibility: "public",
          status: "live",
          ogImageWidth: { not: null, lt: OG_LARGEUR_MINIMALE_GRANDE_CARTE },
        },
        select: { id: true, pathPattern: true, ogImageWidth: true, ogImageHeight: true },
        take: 500,
      });
      for (const route of imageTropPetite) {
        await upsertAnomaly({
          siteRouteId: route.id,
          type: "og_image_trop_petite",
          severity: "medium",
          description:
            `Image de partage ${route.ogImageWidth}×${route.ogImageHeight} sur ${route.pathPattern} : ` +
            `sous ${OG_LARGEUR_MINIMALE_GRANDE_CARTE} px de large, LinkedIn n'affiche qu'une vignette`,
        });
        stats.og_image_trop_petite++;
      }

      // 10d) Les balises annoncent une taille que le fichier n'a pas.
      //
      // 🔑 C'est LE défaut du recensement : les 1 667 pages annonçaient
      // 1200×630 pour des fichiers en 1200×675 ou 1080×607. Les réseaux
      // réservent la vignette d'après ce qui est déclaré, avant de télécharger.
      const routesMesurees = await prisma.siteRoute.findMany({
        where: {
          visibility: "public",
          status: "live",
          ogImageWidth: { not: null },
          ogDeclaredWidth: { not: null },
        },
        select: {
          id: true,
          pathPattern: true,
          ogImageWidth: true,
          ogImageHeight: true,
          ogDeclaredWidth: true,
          ogDeclaredHeight: true,
        },
        take: 500,
      });
      for (const route of routesMesurees) {
        if (
          route.ogImageWidth === route.ogDeclaredWidth &&
          route.ogImageHeight === route.ogDeclaredHeight
        ) {
          continue;
        }
        await upsertAnomaly({
          siteRouteId: route.id,
          type: "og_dimensions_mensongeres",
          severity: "high",
          description:
            `${route.pathPattern} annonce ${route.ogDeclaredWidth}×${route.ogDeclaredHeight} ` +
            `mais le fichier fait ${route.ogImageWidth}×${route.ogImageHeight}`,
        });
        stats.og_dimensions_mensongeres++;
      }

      // 10e) Image hébergée par un tiers : l'aperçu casse le jour où le tiers
      //      retire la photo, sans que rien ne rougisse chez nous.
      const imageTierce = await prisma.siteRoute.findMany({
        where: {
          visibility: "public",
          status: "live",
          ogImage: { not: null, startsWith: "http" },
          NOT: { ogImage: { startsWith: SITE_URL } },
          ogInspectedAt: { not: null },
        },
        select: { id: true, pathPattern: true, ogImage: true },
        take: 500,
      });
      for (const route of imageTierce) {
        await upsertAnomaly({
          siteRouteId: route.id,
          type: "og_image_tierce",
          severity: "low",
          description:
            `L'aperçu de ${route.pathPattern} est hébergé hors de notre domaine ` +
            `(${(route.ogImage ?? "").slice(0, 80)}) : il casse si le tiers retire l'image`,
        });
        stats.og_image_tierce++;
      }

      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      console.log(
        `[site-route-anomaly-detector] done: ${total} anomalies — ` +
          `404=${stats.not_found} dup_title=${stats.duplicate_meta_title} ` +
          `dup_desc=${stats.duplicate_meta_description} dup_h1=${stats.duplicate_h1} ` +
          `orphan=${stats.orphan_page} thin=${stats.thin_content} ` +
          `no_jsonld=${stats.no_jsonld} no_ai=${stats.no_ai_disclaimer} no_ext=${stats.no_external_links} ` +
          `og_absente=${stats.og_image_absente} og_injoignable=${stats.og_image_injoignable} ` +
          `og_petite=${stats.og_image_trop_petite} og_dims=${stats.og_dimensions_mensongeres} ` +
          `og_tierce=${stats.og_image_tierce}`,
      );
    },
    {
      connection: getBullConnectionOrThrow(),
      concurrency: 1,
      lockDuration: 300_000, // 5 min max
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  );

  worker.on("ready", () => console.log("[site-route-anomaly-detector-worker] ready"));
  worker.on("failed", (job, err) => {
    console.error(`[site-route-anomaly-detector-worker] failed: ${err.message}`);
    captureWorkerError("site-route-anomaly-detector", "site-route-anomaly-detector", job, err);
  });

  return worker;
}
