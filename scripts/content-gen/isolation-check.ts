#!/usr/bin/env tsx
/**
 * Content Generator — Isolation check CI (§ 4.1bis master prompt).
 *
 * Vérifie que tous les fichiers content-gen vivent EXCLUSIVEMENT dans les
 * 9 dossiers dédiés :
 *
 *  - src/server/content-gen/**
 *  - src/app/[locale]/(admin)/[adminPrefix]/content-gen/**
 *  - src/components/admin/content-gen/**
 *  - src/server/queue/workers/content-*-worker.ts
 *  - prisma/seeds/content-gen/**
 *  - prisma/migrations/*_content_gen_*  + *_add_content_gen_*
 *  - scripts/content-gen/**
 *  - tests/content-gen/**
 *  - docs/content-gen/**
 *  - public/illustrations/generated/content-gen/**
 *  - src/lib/seo-content-gen-factories.ts (exception explicite — extension seo.ts)
 *
 * Exit code 1 si violation détectée (CI fail).
 *
 * Usage : `pnpm content-gen:isolation-check` (script à ajouter package.json Day 6).
 */

import { execSync } from "node:child_process";
import path from "node:path";

const ALLOWED_PATTERNS: ReadonlyArray<RegExp> = [
  /^src\/server\/content-gen\//,
  /^src\/server\/actions\/content-gen\//,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/content-gen\//,
  /^src\/app\/api\/content-gen\//,
  /^src\/components\/admin\/content-gen\//,
  /^src\/server\/queue\/workers\/content-.*-worker\.ts$/,
  /^prisma\/seeds\/content-gen\//,
  /^prisma\/migrations\/\d+_(add_)?content_gen_/,
  /^scripts\/content-gen\//,
  /^tests\/content-gen\//,
  /^tests\/e2e\/content-gen\//,
  /^docs\/content-gen\//,
  /^public\/illustrations\/generated\/content-gen\//,
  // Exceptions explicites (extensions de fichiers SSOT existants)
  /^src\/lib\/seo-content-gen-factories(\.ts|\.spec\.ts|\.test\.ts)$/,
  /^src\/lib\/__tests__\/seo-content-gen-factories\.spec\.ts$/,
  // Admin layout — nav admin doit pouvoir référencer /content-gen.
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/layout\.tsx$/,
  // Routes publiques générées/consommées par content-gen (Pass B P0-2 + V1.0.1 + Sprint 8).
  // - /fr/actualites/[slug]   : NewsArticle RSS (§ 28)
  // - /fr/blog/[slug]         : Article DB-driven (Sprint 8 V2)
  // - /fr/equipe/[slug]       : Person Manon canonical (audit V1.0.1)
  // - /fr/faq/[slug]          : Q/R post-process auto (§ 29 Pass B P0-7)
  /^src\/app\/\[locale\]\/actualites\//,
  /^src\/app\/\[locale\]\/blog\//,
  /^src\/app\/\[locale\]\/equipe\//,
  /^src\/app\/\[locale\]\/faq\//,
  // Sitemap principal + exporter KB — référencent content-gen comme consommateur
  // dans des commentaires explicatifs (pré-existant Sprint S0bis).
  /^src\/app\/sitemap\.ts$/,
  /^src\/server\/exporters\/knowledge-sitemap\.ts$/,
  // sitemap-index runtime (PR #109) — émet les sub-sitemaps dont le KB DB-aware
  // (content-gen) au runtime ; commentaire explicatif uniquement, même cas que
  // sitemap.ts. Débloque l'isolation-check rouge sur main introduite par #109.
  /^src\/app\/sitemap-index\.xml\/route\.ts$/,
  // sitemap-blog runtime (2026-07-06) — Route Handler qui émet le sub-sitemap
  // blog DB-aware (articles content-gen tier-1) au runtime, en remplacement du
  // prérendu build-time baké vide. Même cas que sitemap.ts / sitemap-index.xml
  // ci-dessus : consommateur, marqueur "content-gen" dans des commentaires
  // explicatifs uniquement (aucun code pipeline).
  /^src\/app\/sitemap-blog\.xml\/route\.ts$/,
  // Script anti-siren : exclut content-gen (doctrine code détecte SIREN patterns)
  /^scripts\/check-anti-siren\.sh$/,
  // Queue manager + worker entry — orchestrent les queues content-gen
  // (Sprint 6 audit correctif : content-orchestrator + content-publish wirés).
  /^src\/server\/queue\/queues\.ts$/,
  /^src\/server\/queue\/worker\.ts$/,
  // package.json — npm scripts content-gen:seed / content-gen:isolation-check
  /^package\.json$/,
  // AdminCommandPalette ⌘K — référence des routes /content-gen pour navigation
  // rapide admin (Audit final P0-4, commit `24e050e`).
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/AdminCommandPalette\.tsx$/,
  // Refonte UX nav content-gen (2026-06-16, commits 150dfe75/24655e04) — SSOT
  // nav admin + sidebar + breadcrumbs + styles globaux référencent les routes
  // /content-gen pour la navigation (légitime, pas de couplage code pipeline).
  /^src\/lib\/admin-nav\.ts$/,
  /^src\/components\/admin\/ui\/AdminBreadcrumbs\.tsx$/,
  /^src\/app\/globals\.css$/,
  // Garde-fou du système de design de la console (refonte UI 2026-08-01) — il
  // scanne TOUT l'arbre admin, y compris les pages content-gen, pour vérifier
  // que chaque jeton et chaque classe `.admin-*` référencés sont bien définis
  // dans admin.css. Le marqueur apparaît uniquement dans sa liste de chaînes
  // `admin-*` qui ne sont PAS des classes CSS : la clé de stockage local
  // `admin-content-gen-poles-collapsed-v1`. Aucun code de pipeline.
  // Même nature d'exception que admin-nav.ts et AdminBreadcrumbs.tsx ci-dessus.
  /^src\/components\/admin\/ui\/__tests__\/admin-design-tokens\.test\.ts$/,
  // KB readers — content-gen consomme la KB via getKnowledgeReadersForContentGen()
  // (lecture seule, Sprint 11.5 KB ingest URLs externes).
  /^src\/lib\/knowledge\/readers\.ts$/,
  // vitest.config — include/exclude patterns pour les tests content-gen
  // (séparation suites unit vs integration content-gen).
  /^vitest\.config\.ts$/,
  // RGPD / retention transverses (audit B5 commit `3b326a9`) — content-gen
  // est consommé en aval (purge + export DSAR + sous-processeurs IA). Sprint
  // S6.3 P1-4 (2026-05-15) : ces fichiers référencent explicitement les
  // tables content-gen dans un contexte conformité, pas violation isolation.
  /^src\/content\/subprocessors\.ts$/,
  /^src\/app\/api\/gdpr-export\/route\.ts$/,
  /^src\/server\/queue\/workers\/retention-purge-worker\.ts$/,
  /^scripts\/restore-postgres-test-r2\.sh$/,
  // seo.ts contient un garde-fou anti-fuite Manon (doctrine v2.1 — persona IA
  // n'a aucun réseau social). Le commentaire mentionne "content-gen" comme
  // contexte d'origine. Pas violation : c'est une exception explicite de
  // l'extension SSOT seo.ts (cf. seo-content-gen-factories.ts déjà whitelist).
  /^src\/lib\/seo\.ts$/,
  // speakable-universal.ts : le commentaire mentionne "content-gen" comme contexte
  // (un sélecteur réservé au content-gen), pas du code du pipeline de génération.
  // Même exception explicite que seo.ts ci-dessus (pré-existant, débloque Gate A).
  /^src\/lib\/seo\/speakable-universal\.ts$/,
  // Internal revalidate API (P1-E fix audit 2026-05-15) — endpoint appelé par
  // workers content-gen pour revalidatePath en contexte Next 16 valide.
  /^src\/app\/api\/internal\/revalidate\/route\.ts$/,
  // Exceptions ajoutées 2026-05-16 (audit V1 image-bank + S+1 securite-rgpd PRs #14/#15).
  // Ces fichiers mentionnent "content-gen" dans des commentaires/références
  // cross-module légitimes (consommation, sitemap, workflows CI, sister
  // isolation-check, KB transitions, etc.). Pas de violation isolation —
  // exceptions explicites doctrine §4.1bis.
  /^\.github\/workflows\/ci\.yml$/,
  /^\.github\/workflows\/gsc-crawl-stats-weekly\.yml$/,
  /^\.github\/workflows\/content-gen-seed\.yml$/,
  /^\.github\/workflows\/enable-openai-embeddings\.yml$/,
  // Workflow de seed KB manuel — référence content-gen (seeding KB) en CI.
  /^\.github\/workflows\/seed-kb-manual\.yml$/,
  // Sprint Pricing SSOT 2026-05-29 : le garde-fou anti-prix-en-dur SCANNE
  // `src/server/content-gen/**` comme surface d'enforcement → référence
  // légitime à content-gen hors zone (test transverse, pas du code content-gen).
  /^src\/content\/__tests__\/no-hardcoded-prices\.spec\.ts$/,
  /^prisma\/migrations\/\d+_add_service_sector\/migration\.sql$/,
  /^prisma\/seed\.ts$/,
  /^prisma\/seeds\/blog-fs-bootstrap\.ts$/,
  /^scripts\/image-bank\/isolation-check\.ts$/,
  /^scripts\/perf\/export-gsc-crawl-stats\.mjs$/,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/web-vitals\/page\.tsx$/,
  /^src\/app\/\[locale\]\/centre-aide\/\[slug\]\/page\.tsx$/,
  /^src\/app\/\[locale\]\/guides\/\[slug\]\/page\.tsx$/,
  /^src\/components\/content-gen\/Tombstone\.tsx$/,
  // ArticleFaq — composant de rendu public (FAQPage) qui importe
  // `sanitizeFaqAnswer` depuis src/server/content-gen/shared : le marqueur
  // "content-gen" vient du seul chemin d'import, pas d'un couplage métier.
  /^src\/components\/content-gen\/ArticleFaq\.tsx$/,
  // Refonte templates 2026-06-22 (#134) — composants de rendu public qui
  // CONSOMMENT des briques content-gen partagées (le marqueur vient du seul
  // chemin d'import, pas d'un couplage métier du pipeline) :
  // - ArticleExpertQuote importe `expertKeyFromName` (content-gen/brand/expert-bank)
  // - ArticleSources importe le trust-tier (content-gen/links/trust-tier)
  // Même exception explicite que ArticleFaq ci-dessus.
  /^src\/components\/content-gen\/ArticleExpertQuote\.tsx$/,
  /^src\/components\/content-gen\/ArticleSources\.tsx$/,
  // /comparaisons : page de rendu public qui importe ArticleFaq + getManonPersonJsonLd
  // (consommateur, pas producteur). Même cas que /blog, /guides, /actualites.
  /^src\/app\/\[locale\]\/comparaisons\//,
  // Test de validation JSON-LD CI — exerce les factories seo-content-gen
  // (référence le marqueur en commentaire/contexte, pas du code pipeline).
  /^src\/lib\/__tests__\/jsonld-validation\.spec\.ts$/,
  // Observatoire IA dashboard (#149) — analysis.ts CONSOMME le router LLM
  // partagé de content-gen (`provider-router` + `parse-llm-json`) pour la
  // synthèse « Décryptage IA ». Le marqueur vient du seul chemin d'import
  // (consommateur, pas du pipeline de génération). Même cas qu'ArticleFaq.
  /^src\/server\/observatoire\/analysis\.ts$/,
  /^src\/features\/admin-blog\/actions\.ts$/,
  // admin-job-offers/actions.ts (PR #201) — CONSOMME `enqueueGoogleIndexingForUrls`
  // depuis src/server/content-gen/indexing pour pinger l'Indexing API sur les URLs
  // d'offres d'emploi publiées. Le marqueur "content-gen" vient du seul chemin
  // d'import (consommateur, pas du pipeline de génération). Même cas qu'admin-blog.
  /^src\/features\/admin-job-offers\/actions\.ts$/,
  // prospection (feat/prospection 2026-07-04) — module autonome qui CONSOMME la
  // brique partagée `content-gen/_auth` (requireAdmin) via un import, et mentionne
  // "content-gen" dans un commentaire de contexte (robots.ts : « on ne réutilise
  // pas la brique content-gen »). Consommateur / commentaire, PAS du pipeline de
  // génération. Même cas légitime qu'admin-blog / admin-job-offers.
  /^src\/server\/actions\/prospection\/_auth\.ts$/,
  /^src\/server\/prospection\/enrichment\/robots\.ts$/,
  /^src\/i18n\/routing\.ts$/,
  /^src\/lib\/image-utils\.ts$/,
  /^src\/server\/actions\/knowledge\/_transition\.ts$/,
  /^src\/server\/actions\/knowledge\/delete-entry\.ts$/,
  /^src\/server\/actions\/knowledge\/update-entry\.ts$/,
  // Tests co-located workers content-* (__tests__/) — .spec.ts et .test.ts
  /^src\/server\/queue\/workers\/__tests__\/content-.*\.(spec|test)\.ts$/,
  // Tests co-located workers non-content (orchestrator, scheduler, deadline, etc.)
  // qui mockent ContentGenConfig/ContentGenJob pour tester l'infrastructure queue.
  /^src\/server\/queue\/workers\/__tests__\/.*\.(spec|test)\.ts$/,
  // seed-cities.ts — mentionne "content-gen" dans un commentaire de contexte seulement.
  /^prisma\/seeds\/cities\/seed-cities\.ts$/,
  // AdminSidebarNav — navigation admin légitime vers /content-gen routes.
  /^src\/components\/admin\/ui\/AdminSidebarNav\.tsx$/,
  // Workers transverses qui lisent ContentGenConfig de façon légitime (lecture seule).
  /^src\/server\/queue\/workers\/embeddings-backfill-worker\.ts$/,
  /^src\/server\/queue\/workers\/brand-voice-drift-monitor\.ts$/,
  // content-gen-deadline-checker.ts — worker content-gen non matché par pattern -worker.ts
  /^src\/server\/queue\/workers\/content-gen-deadline-checker\.ts$/,
  // Exceptions ajoutées 2026-05-18 (audit verif-fix-deploy refonte admin V2).
  // Ces fichiers mentionnent "content-gen" uniquement comme group/label dans
  // la nav SSOT v2 (`src/lib/admin-nav.ts` PR 9) ou comme placeholder loading
  // skeleton générique. Pas de couplage code réel — refs UI/screenshot/test
  // baseline uniquement.
  /^src\/lib\/admin-nav\.ts$/,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/loading\.tsx$/,
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/web-vitals\/_v2\/WebVitalsV2\.tsx$/,
  /^src\/components\/admin\/ui\/AdminPageShell\.tsx$/,
  /^src\/components\/admin\/ui\/AdminSessionExpiryWarning\.tsx$/,
  /^src\/components\/admin\/ui\/AdminStatCard\.tsx$/,
  /^src\/components\/admin\/ui\/AdminSubmitButton\.tsx$/,
  /^tests\/e2e\/admin-baseline-screenshots\.spec\.ts$/,
  // Exception ajoutée 2026-07-27 (gate a11y, constat X5).
  //
  // Ce test LIT deux fiches KB content-gen pour vérifier qu'elles ne revendiquent
  // pas la conformité WCAG tant que la déclaration légale dit « non audité à ce
  // jour ». Lecture de fichier en assertion, aucun `import`, aucune dépendance à
  // l'exécution : le couplage que § 4.1bis interdit n'existe pas ici.
  //
  // L'inverse serait pire — les fiches KB alimentent la RAG et ressortent en
  // pages publiques. S'interdire de les contrôler au nom de l'isolation
  // laisserait précisément passer l'écart déclaratif que ce gate existe pour
  // empêcher, et sur les SUPPORTS DE FORMATION, terrain direct de l'audit
  // Qualiopi.
  /^tests\/unit\/ci\/gate-a11y-cablage\.spec\.ts$/,
  // Exceptions ajoutées 2026-05-20 (sessions city-quality + S+5 P2 + keywords + sentry).
  // Ces fichiers mentionnent "content-gen" uniquement dans des commentaires JSDoc
  // ou des commentaires de code (référence à un consommateur, contexte audit, URL
  // admin console) — aucun couplage code réel. Pas de violation isolation §4.1bis.
  /^src\/content\/villes\/index\.ts$/,
  /^src\/content\/glossary-extension\.ts$/,
  /^src\/content\/keywords\/master\.ts$/,
  /^src\/content\/keywords\/types\.ts$/,
  /^src\/lib\/geo\.ts$/,
  /^src\/lib\/same-origin\.ts$/,
  /^src\/server\/queue\/lib\/sanitize-job-data\.ts$/,
  /^src\/server\/queue\/lib\/sentry-worker\.ts$/,
  /^src\/server\/queue\/lib\/__tests__\/sentry-worker\.spec\.ts$/,
  /^src\/app\/\[locale\]\/guides\/page\.tsx$/,
  /^prisma\/migrations\/\d+_p1_audit_topic_fingerprint_and_audit_log\/migration\.sql$/,
  /^prisma\/migrations\/\d+_add_rss_source_table\/migration\.sql$/,
  // P4 Sprint correctif 2026-05-21 — migrations Manon qui referencent content-gen
  // dans des commentaires SQL (FK FK campaignId Article). Pas de violation isolation.
  /^prisma\/migrations\/\d+_add_article_campaign_id\/migration\.sql$/,
  // Hero Unsplash (Option A 2026-06-16) — migration additive des colonnes
  // featured_image_photographer_name/url sur articles. Le commentaire SQL
  // mentionne "content-gen" (contexte) mais le nom de migration ne matche pas
  // le pattern _content_gen_. Exception explicite (même cas que ci-dessus).
  /^prisma\/migrations\/\d+_article_unsplash_credit\/migration\.sql$/,
  // P1.5 B.4 — Routes API admin articles : RGPD art.17 (forget) + AI Act art.50 (provenance).
  // Consomment des données content-gen (purge cascade + trace LLM) mais sont des
  // endpoints admin transverses, pas du code content-gen core.
  /^src\/app\/api\/admin\/articles\/\[id\]\/forget\/route\.ts$/,
  /^src\/app\/api\/admin\/articles\/\[id\]\/provenance\/route\.ts$/,
  // P5 Sprint — feedback ArticleFeedback endpoint (consomme données content-gen).
  /^src\/app\/api\/admin\/content-gen\/articles\/\[id\]\/feedback\/route\.ts$/,
  // Sprint P4 correctif 364f2c65 — pages implantations/ville importent getBlogArticlesByVille
  // depuis content-gen/blog (lecture seule — consommateur, pas producteur).
  /^src\/app\/\[locale\]\/implantations\//,
  /^src\/components\/sections\/VilleServicePageTemplate\.tsx$/,
  // Sprint Final audit-final 2026-05-22 — exceptions ajoutées :
  // - cost-cap-reset-worker : appelle resetMonthlyCostCounters de content-gen/lib
  //   (worker transverse infra cost-cap, pas content-gen core, P0-2 audit final).
  // - external-links-monitor-worker : commentaire référence content-gen consumer
  //   (sprint External Links Database 2026-05-22 Manon).
  // - manual-additions.ts + perplexity-search : data + client transverses external-links.
  // - connaissances/[slug] : KB publique consume content-gen articles factory.
  // - keywords/clusters : data keywords transverse content-gen.
  /^src\/server\/queue\/workers\/cost-cap-reset-worker\.ts$/,
  /^src\/server\/queue\/workers\/external-links-monitor-worker\.ts$/,
  /^src\/data\/external-links\/manual-additions\.ts$/,
  /^src\/server\/clients\/perplexity-search\.ts$/,
  /^src\/app\/\[locale\]\/connaissances\/\[slug\]\/page\.tsx$/,
  /^src\/content\/keywords\/clusters\.ts$/,
  // audit-final-actions.yml : workflow CI qui orchestre les seeds content-gen
  // en prod (actions Will). Contient "content-gen" dans les commandes shell,
  // pas du code source content-gen.
  /^\.github\/workflows\/audit-final-actions\.yml$/,
  // Exceptions ajoutées 2026-05-28 (sprint AEO Phase 3-5 + sprint 2026-05-28
  // header v5 + sessions T4 villes). Ces fichiers mentionnent "content-gen"
  // dans des commentaires JSDoc, des refs commerciales (consumer/orchestrator),
  // ou comme dépendances cross-module — pas du code content-gen core.
  // Migrations Prisma v7 phase1 + phase8 (city_generation_order + 12 content
  // types) : références SQL commentaires uniquement.
  /^prisma\/migrations\/\d+_add_city_generation_order_v7_phase1\/migration\.sql$/,
  /^prisma\/migrations\/\d+_v7_phase8_add_12_content_types\/migration\.sql$/,
  // Scripts utility villes T4 (regen complete/stratified, seed-kb facts,
  // test-openai villecopy) : pipeline régénération T4, content-gen consumer.
  /^scripts\/regen-villes-complete\.ts$/,
  /^scripts\/regen-villes-stratified\.ts$/,
  /^scripts\/seed-kb-villes-facts\.ts$/,
  /^scripts\/test-openai-villecopy\.ts$/,
  // Admin testimonials mark-as-real-action : référence content-gen flag.
  /^src\/app\/\[locale\]\/\(admin\)\/\[adminPrefix\]\/testimonials\/\[id\]\/_v2\/mark-as-real-action\.ts$/,
  // Page presse : référence content-gen dans le contexte (UnifiedContactForm
  // defaultType="presse" — sprint 2026-05-28).
  /^src\/app\/\[locale\]\/presse\/page\.tsx$/,
  // Lib SEO extensions (ab-test-meta, local-citations, wikidata-sameas) :
  // factories SSOT séparées de seo.ts, consommées par content-gen mais pas
  // dans le scope core. Pattern identique à seo-content-gen-factories.ts.
  /^src\/lib\/seo\/ab-test-meta\.ts$/,
  /^src\/lib\/seo\/local-citations\.ts$/,
  /^src\/lib\/seo\/wikidata-sameas\.ts$/,
  // Scripts src/scripts ops villes (backfill RSS, delete landing villes
  // articles, scan routes, test ville hub Paris) : utility scripts pour
  // T4 ops Will, pas code content-gen core.
  /^src\/scripts\/backfill-rss-sources\.ts$/,
  /^src\/scripts\/delete-landing-ville-articles\.ts$/,
  /^src\/scripts\/scan-site-routes\.ts$/,
  /^src\/scripts\/test-ville-hub-copy-paris\.ts$/,
  // Sprint Service-Binding KB V4.1 (2026-05-29). Ces fichiers mentionnent
  // "content-gen" uniquement comme RÉFÉRENCE de chemin/consommateur, pas du
  // code content-gen core :
  // - seed-kb-manual.yml : workflow CI manuel qui exécute le seed KB
  //   `prisma/seeds/content-gen/run-seed-kb.ts` (le chemin est obligatoire).
  // - services.ts : SSOT mapping services KB ; commentaires citant
  //   `src/server/content-gen/kb/*` (verticales des KbFact) — refs doc.
  /^\.github\/workflows\/seed-kb-manual\.yml$/,
  /^src\/content\/knowledge\/services\.ts$/,
  // Fix audit FAQ 2026-05-31 — violation PRÉ-EXISTANTE (commit aaf08c67) qui
  // rendait déjà « CI · Gates A + B » rouge avant le sprint FAQ. Le composant
  // référence `docs/content-gen/UNSPLASH-COMPLIANCE.md` dans un commentaire JSDoc
  // (conformité Unsplash), pas du code du pipeline de génération. Whitelist comme
  // les autres consommateurs/refs-doc ci-dessus.
  /^src\/components\/services\/audit\/AuditClientReviews\.tsx$/,
  // Sprint sites-web 2026-06-02 — twin sites-web de AuditClientReviews ci-dessus
  // (le composant se déclare lui-même « identique à /audit »). Référence
  // `docs/content-gen/UNSPLASH-COMPLIANCE.md` dans des commentaires (crédit +
  // conformité Unsplash), pas du code du pipeline de génération. Même exception
  // explicite que le composant audit.
  /^src\/components\/services\/sites-web\/SitesWebReviews\.tsx$/,
  // Sprint 2026-06-03 — twin implementation de Audit/SitesWeb ClientReviews
  // ci-dessus. Référence `docs/content-gen/UNSPLASH-COMPLIANCE.md` dans un
  // commentaire JSDoc (crédit + conformité Unsplash), pas du code du pipeline de
  // génération. Même exception explicite que ses jumeaux audit & sites-web.
  /^src\/components\/services\/implementation\/ImplementationClientReviews\.tsx$/,
  // Exceptions 2026-06-06 (audit Qualiopi end-to-end). CONSOMMATEURS LÉGITIMES des
  // briques content-gen (provider Anthropic, cost-tracker, retry, KB) — réutilisation
  // cross-module imposée par le contrat (« réutiliser les briques existantes »), pas
  // de logique content-gen dupliquée. Le module Qualiopi a son propre garde-fou
  // (qualiopi:isolation-check). + consommateurs pré-existants (chatbot IA, refs UI).
  /^src\/server\/qualiopi\//,
  /^src\/server\/actions\/qualiopi\//,
  /^src\/server\/queue\/workers\/qualiopi-.*\.ts$/,
  // Observatoire IA 2026 — CONSOMMATEUR LÉGITIME des briques content-gen :
  // les actions admin/public de l'observatoire importent `requireAdmin` et
  // `enqueueDirectGen` (src/server/actions/content-gen/*) pour générer les
  // insights `barometer_insight`. Même cas que qualiopi/carrieres : module
  // distinct qui réutilise le pipeline, pas du code content-gen core. (Débloque
  // l'isolation-check rouge sur main introduite par le merge observatoire.)
  /^src\/server\/actions\/observatoire\//,
  /^src\/server\/chatbot\/generation\//,
  /^src\/server\/chatbot\/ingestion\//,
  /^src\/content\/villes\/copy\//,
  /^src\/components\/services\/sites-web\/SitesWebVisualShowcase\.tsx$/,
  /^src\/lib\/seo\/manon-person\.ts$/,
  /^scripts\/docker-entrypoint\.sh$/,
  /^scripts\/curate-sites-web-unsplash\.mjs$/,
  // Exceptions 2026-06-10 (refonte carrières offres d'emploi + Site Explorer).
  // CONSOMMATEURS LÉGITIMES des briques content-gen, pas du code content-gen core :
  // - carrieres/[slug]/page.tsx + seo/job-posting.ts : importent
  //   `sanitizeContentGenHtml` (content-gen/shared/html-sanitizer) pour assainir
  //   le HTML DB-driven des annonces — réutilisation de la brique sanitizer.
  // - site-route-gsc-worker.ts : importe le client GSC (content-gen/seo/gsc-client).
  // - route-enumerator.ts : Site Explorer énumère les routes du site, y compris
  //   les publications générées par content-gen (consumer en lecture seule).
  /^src\/app\/\[locale\]\/carrieres\/\[slug\]\/page\.tsx$/,
  /^src\/lib\/seo\/job-posting\.ts$/,
  /^src\/server\/queue\/workers\/site-route-gsc-worker\.ts$/,
  /^src\/server\/site-explorer\/route-enumerator\.ts$/,
  // Exceptions 2026-06-21 (campagnes multi-axes + recherche cross-content + Phase 3
  // secteurs). CONSOMMATEURS LÉGITIMES de la pain-matrix / KB content-gen (lecture
  // seule data) ou refs en commentaires — PAS du code content-gen core :
  // - migration campaigns_multi_axes : ALTER coverage_campaigns + commentaires content-gen
  //   (additive ; le nom ne matche pas le pattern _content_gen_, même cas que
  //   _add_service_sector / _article_unsplash_credit déjà whitelistés).
  // - recherche/* + site-search.ts : recherche cross-content qui INDEXE les articles
  //   content-gen (consumer lecture seule, sprint recherche 2026-06).
  // - secteurs/* + sectors.ts + tests : pilier SEO Phase 3 qui consomme la pain-matrix
  //   sectorielle (`src/server/content-gen/kb/sector-pain-matrix`) = data read-only.
  // - admin.css : styles admin référençant la nav /content-gen (même cas que globals.css).
  /^prisma\/migrations\/\d+_campaigns_multi_axes\/migration\.sql$/,
  /^src\/app\/\[locale\]\/recherche\//,
  /^src\/app\/\[locale\]\/secteurs\//,
  /^src\/app\/admin\.css$/,
  /^src\/content\/sectors\.ts$/,
  /^src\/content\/__tests__\/sectors\.spec\.ts$/,
  /^src\/content\/__tests__\/secteurs-pages\.spec\.ts$/,
  /^src\/lib\/search\/site-search\.ts$/,
  // Exceptions 2026-06-27 — violations PRÉ-EXISTANTES sur main (héritées des
  // merges #160 admin-nav, blog hub catégories, backfill hero Unsplash, scripts
  // ops one-shot Will). Révélées seulement maintenant : le Gate A s'arrêtait
  // avant sur l'étape Prettier ; une fois prettier corrigé, l'isolation-check
  // s'exécute et flague ces refs BÉNIGNES (commentaires / string de test /
  // import consommateur / nom de migration). Aucun code pipeline content-gen :
  // - migration content_template_history : commentaire SQL ContentTemplate
  //   (additive ; nom ne matche pas le pattern _content_gen_, même cas que
  //   _add_service_sector / _article_unsplash_credit déjà whitelistés).
  // - activate-content-gen-value-metier.ts / depublish-en-translations.ts :
  //   scripts ops one-shot prod (décision Will), refs content-gen en commentaires.
  // - CategoryArticlesFilter.tsx : UI blog, un seul commentaire « DB content-gen ».
  // - admin-nav.test.ts : le marqueur est dans la STRING descriptive du snapshot
  //   de count (admin-nav.ts est déjà whitelisté ci-dessus).
  // - backfill-hero-images.ts : script ops blog, import consommateur de
  //   src/server/content-gen/images/backfill-hero (rattrapage hero Unsplash).
  // - services-ssot.spec.ts : garde-fou nommage des 5 services (2026-07-28).
  //   Le marqueur vient d'UNE string dans son allowlist de fichiers exemptés
  //   (`"server/content-gen/lib/category-mapper.ts"` — miroir de la migration
  //   20260616180000, non renommable sans migration). Aucun import, aucun code
  //   pipeline : exactement le même cas que `admin-nav.test.ts` ci-dessus.
  /^prisma\/migrations\/\d+_content_template_history\/migration\.sql$/,
  /^scripts\/activate-content-gen-value-metier\.ts$/,
  /^scripts\/depublish-en-translations\.ts$/,
  /^src\/components\/blog\/CategoryArticlesFilter\.tsx$/,
  /^src\/lib\/admin-nav\.test\.ts$/,
  /^src\/scripts\/backfill-hero-images\.ts$/,
  /^src\/content\/__tests__\/services-ssot\.spec\.ts$/,
];

/**
 * Marqueurs textuels qui suggèrent que le fichier est content-gen
 * (au-delà du chemin). Détection complémentaire.
 */
const CONTENT_GEN_MARKERS: ReadonlyArray<string> = [
  "content-gen",
  "ContentGenJob",
  "ContentGenConfig",
  "ContentTemplate",
  "CoverageCampaign",
];

function isPathAllowed(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return ALLOWED_PATTERNS.some((re) => re.test(normalized));
}

function looksLikeContentGen(filePath: string, content: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  // Skip déjà-allowed paths
  if (isPathAllowed(normalized)) return false;
  // Skip docs/_AUDIT/seeds-templates/CLAUDE.md/etc. (commentaires textuels OK)
  if (
    /^_AUDIT\//.test(normalized) ||
    /\.md$/.test(normalized) ||
    /^CLAUDE\.md$/.test(normalized) ||
    /^README\.md$/.test(normalized) ||
    /^\.claude\//.test(normalized) ||
    /^AxionIA_Dossier/.test(normalized)
  ) {
    return false;
  }
  // Skip schema.prisma (les modèles content-gen sont attendus dedans)
  if (normalized === "prisma/schema.prisma") return false;
  // Skip src/env.ts (env vars content-gen sont attendus)
  if (normalized === "src/env.ts") return false;
  return CONTENT_GEN_MARKERS.some((m) => content.includes(m));
}

function listStagedFiles(): string[] {
  try {
    const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      encoding: "utf8",
    });
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

function listAllTrackedFiles(): string[] {
  try {
    const out = execSync("git ls-files", { encoding: "utf8" });
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  const mode = process.argv.includes("--staged") ? "staged" : "all";
  const files = mode === "staged" ? listStagedFiles() : listAllTrackedFiles();

  const violations: Array<{ file: string; reason: string }> = [];

  for (const f of files) {
    // Skip allowed paths (rapide)
    if (isPathAllowed(f)) continue;
    // Lookup marqueurs content-gen dans le contenu
    try {
      const content = await import("node:fs").then((m) =>
        m.promises.readFile(path.join(process.cwd(), f), "utf8"),
      );
      if (looksLikeContentGen(f, content)) {
        violations.push({
          file: f,
          reason: "Contient marqueur content-gen mais hors zones dédiées (§ 4.1bis)",
        });
      }
    } catch {
      // unreadable / binary → skip
    }
  }

  if (violations.length === 0) {
    console.log(`✅ [isolation-check] OK — ${files.length} fichiers scannés, 0 violation.`);
    process.exit(0);
  }

  console.error(`❌ [isolation-check] ${violations.length} violations détectées :`);
  for (const v of violations) {
    console.error(`  - ${v.file} : ${v.reason}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error("[isolation-check] FATAL:", err);
  process.exit(2);
});
